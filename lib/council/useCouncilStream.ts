'use client';

import { useCallback, useRef, useState } from 'react';
import { planTurn, type Selection } from './planTurn';
import { parseFrames } from './sse';
import { reduceTranscript, type Exchange, type HarnessEvent } from './transcript';
import type { Scope } from './types';

/**
 * Drives one council conversation and everything that follows it.
 *
 * One turn produces one SSE stream carrying every voice. Each subagent gets its
 * own `thread_id`, announced by `thread.created` and closed by `thread.done`,
 * so the voices are separated by grouping on that id rather than by opening a
 * connection per persona.
 *
 * An approval does not pause the stream — it ends it. The harness closes with
 * `turn.done` and the decision starts a *new* turn with its own stream. Both
 * fold into the same exchange, so the reader sees one question and one answer
 * rather than an answer that stops mid-sentence and a second one that starts
 * from nowhere.
 *
 * All of that folding lives in `transcript.ts`, which is where it can be
 * tested. This hook owns the network and the session id, nothing more.
 */

type Status = 'idle' | 'streaming' | 'waiting' | 'done' | 'error';

export function useCouncilStream() {
  const [transcript, setTranscript] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const sessionId = useRef<string | undefined>(undefined);
  /**
   * What the live session was created for, so `planTurn` can spot a change.
   * Undefined for a rehydrated session: its agent spec is not in the event log,
   * so the next ask forks rather than assume the scope still matches.
   */
  const selection = useRef<Selection | undefined>(undefined);

  const consume = useCallback(async (res: Response) => {
    const header = res.headers.get('x-session-id');
    if (header) sessionId.current = header;

    if (!res.body || !res.headers.get('content-type')?.includes('event-stream')) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setError(String(body.error ?? 'harness error'));
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    const drain = (chunk: string, flush = false) => {
      buffer += chunk;
      const { events, rest } = parseFrames(flush ? `${buffer}\n\n` : buffer);
      buffer = flush ? '' : rest;
      if (events.length === 0) return;

      // One update per chunk rather than one per event. A single turn streams
      // hundreds of deltas and each would otherwise be its own render.
      setTranscript((prev) => (events as HarnessEvent[]).reduce(reduceTranscript, prev));
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      drain(value);
    }
    // The last frame may arrive without a trailing blank line.
    if (buffer.trim()) drain('', true);
  }, []);

  const post = useCallback(
    async (body: unknown) => {
      setError(undefined);
      setBusy(true);
      try {
        const res = await fetch('/api/council', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        await consume(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'stream failed');
      } finally {
        setBusy(false);
      }
    },
    [consume],
  );

  const ask = useCallback(
    (question: string, scope: Scope, personaIds: string[]) => {
      const plan = planTurn({
        current:
          sessionId.current && selection.current
            ? { sessionId: sessionId.current, ...selection.current }
            : undefined,
        next: { scope, personaIds },
      });

      // Forking drops the session so the route builds a fresh spec; continuing
      // keeps it, and the harness chains the turn onto the session's last one.
      if (plan.mode === 'new') {
        sessionId.current = undefined;
        // A fork is a different conversation bound to a different agent spec.
        // Leaving the old answers on screen would show history this session
        // does not have.
        setTranscript([]);
      }
      selection.current = { scope, personaIds };

      return post({
        kind: 'ask',
        question,
        scope,
        personaIds,
        ...(plan.mode === 'continue' ? { sessionId: plan.sessionId } : {}),
      });
    },
    [post],
  );

  const current = transcript.at(-1);

  const decide = useCallback(
    (decision: 'allow' | 'deny') => {
      if (!current || current.pending.length === 0 || !sessionId.current) return;
      // Every parked call, across every subagent thread — the harness rejects a
      // resume that leaves any of them unanswered. The calls stay pending until
      // the resume turn arrives and clears them, so a failed post is still
      // recoverable rather than a write stranded with no way to authorise it.
      return post({
        kind: 'approve',
        sessionId: sessionId.current,
        previousTurnId: current.turnId,
        calls: current.pending.map(({ threadId, toolCallId }) => ({ threadId, toolCallId })),
        decision,
      });
    },
    [current, post],
  );

  /** Reopens a past session and rebuilds its conversation from the event log. */
  const resume = useCallback(async (id: string) => {
    setError(undefined);
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(String(body.error ?? `HTTP ${res.status}`));
        return;
      }
      sessionId.current = id;
      selection.current = undefined;
      setTranscript(body.transcript as Exchange[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not reopen the session');
    } finally {
      setBusy(false);
    }
  }, []);

  const settled = current?.status ?? 'idle';
  const status: Status = error
    ? 'error'
    : busy
      ? 'streaming'
      : // A turn left mid-stream — rehydrated from history, or a connection
        // that dropped — is not running *here*; this window holds no reader for
        // it. Idle keeps the console usable instead of disabling the ask box
        // against a stream nobody is consuming.
        settled === 'streaming'
        ? 'idle'
        : settled;

  return {
    transcript,
    // Read from the ref rather than mirrored into state. Every write to it is
    // immediately followed by a transcript update, so the render that shows it
    // is always the one after it changed.
    sessionId: sessionId.current,
    pending: current?.pending ?? [],
    status,
    error,
    ask,
    decide,
    resume,
  };
}
