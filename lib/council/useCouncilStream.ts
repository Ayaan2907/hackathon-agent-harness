'use client';

import { useCallback, useRef, useState } from 'react';
import type { Scope } from './types';

/**
 * Drives one council ask and everything that follows it.
 *
 * One turn produces one SSE stream carrying every voice. Each subagent gets its
 * own `thread_id`, announced by `thread.created` and closed by `thread.done`,
 * so the voices are separated by grouping on that id rather than by opening a
 * connection per persona.
 *
 * An approval does not pause the stream — it ends it. The harness closes with
 * `turn.done` and the decision starts a *new* turn with its own stream. Both
 * are folded into the same `threads` map so the transcript reads as one
 * conversation.
 */

export interface Thread {
  id: string;
  /** Subagent name from `thread.created`; the root thread is `main`. */
  title: string;
  text: string;
  done: boolean;
}

export interface Pending {
  toolName: string;
  toolCallId: string;
  threadId: string;
  summary: string;
}

type Status = 'idle' | 'streaming' | 'waiting' | 'done' | 'error';

/** Events we act on. Everything else streams past. */
interface Event {
  type: string;
  thread_id?: string | null;
  content?: string;
  turn_id?: string;
  title?: string;
  agent_info?: { name?: string };
  state?: { output?: { content?: string } };
  tool_calls?: { id: string; function?: { name?: string } }[];
}

export function useCouncilStream() {
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [pending, setPending] = useState<Pending | undefined>();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | undefined>();

  const sessionId = useRef<string | undefined>(undefined);
  const turnId = useRef<string | undefined>(undefined);

  const upsert = useCallback((id: string, patch: Partial<Thread>) => {
    setThreads((prev) => {
      const existing = prev[id] ?? { id, title: id === 'main' ? 'Council' : id, text: '', done: false };
      return { ...prev, [id]: { ...existing, ...patch, text: existing.text + (patch.text ?? '') } };
    });
  }, []);

  const consume = useCallback(
    async (res: Response) => {
      const header = res.headers.get('x-session-id');
      if (header) sessionId.current = header;

      if (!res.body || !res.headers.get('content-type')?.includes('event-stream')) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(String(body.error ?? 'harness error'));
        setStatus('error');
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;

        // SSE frames are separated by a blank line; keep the trailing partial.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;

          let event: Event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          const id = event.thread_id ?? 'main';

          switch (event.type) {
            case 'turn.created':
              if (event.turn_id) turnId.current = event.turn_id;
              break;
            case 'thread.created':
              upsert(id, { title: event.agent_info?.name ?? event.title ?? id });
              break;
            case 'model.message.delta':
              if (event.content) upsert(id, { text: event.content });
              break;
            case 'thread.done':
              upsert(id, { title: event.title ?? id, done: true });
              break;
            case 'tool.approval_required': {
              const call = event.tool_calls?.[0];
              if (call) {
                setPending({
                  toolCallId: call.id,
                  threadId: id,
                  toolName: call.function?.name ?? 'record_decision',
                  summary: 'This writes to the decision ledger and cannot be undone.',
                });
                setStatus('waiting');
              }
              break;
            }
            case 'turn.done':
              // A turn that ends while an approval is outstanding is parked, not finished.
              setStatus((s) => (s === 'waiting' ? 'waiting' : 'done'));
              break;
          }
        }
      }
    },
    [upsert],
  );

  const post = useCallback(
    async (body: unknown) => {
      setError(undefined);
      try {
        const res = await fetch('/api/council', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        await consume(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'stream failed');
        setStatus('error');
      }
    },
    [consume],
  );

  const ask = useCallback(
    (question: string, scope: Scope, personaIds: string[]) => {
      setThreads({});
      setPending(undefined);
      setStatus('streaming');
      return post({ kind: 'ask', question, scope, personaIds });
    },
    [post],
  );

  const decide = useCallback(
    (decision: 'allow' | 'deny') => {
      if (!pending || !sessionId.current || !turnId.current) return;
      const p = pending;
      setPending(undefined);
      setStatus('streaming');
      return post({
        kind: 'approve',
        sessionId: sessionId.current,
        previousTurnId: turnId.current,
        threadId: p.threadId,
        toolCallId: p.toolCallId,
        decision,
      });
    },
    [pending, post],
  );

  return { threads: Object.values(threads), pending, status, error, ask, decide };
}
