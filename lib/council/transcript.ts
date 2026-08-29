import { mergeApprovals, statusFromTurnDone, type PendingCall } from './events';

/**
 * The conversation, folded out of harness events.
 *
 * One projection serves both directions, because both carry the same event
 * union: a live SSE turn arriving one frame at a time, and a whole session
 * rehydrated from `GET /sessions/{id}/events`. Two differences between them are
 * load-bearing and neither is announced by the event type:
 *
 *  - Live, `model.message` is a start marker with no content and the text
 *    arrives as `model.message.delta`. In history it is the finished message
 *    and there are no deltas at all. So text is appended wherever it appears
 *    and an empty `model.message` is skipped.
 *  - History comes back newest event first. `projectTranscript` owns that,
 *    rather than leaving a `.reverse()` for each caller to remember.
 */

/** One voice within an exchange: the root agent, or one subagent. */
export interface TranscriptThread {
  id: string;
  /** Subagent name from `thread.created`; the root thread is `Council`. */
  title: string;
  text: string;
  done: boolean;
}

/**
 * One question and everything that answered it.
 *
 * Not the same unit as a harness turn. An approval splits one question across
 * two turns — the ask that parks and the resume that finishes it — and the
 * reader only ever asked once, so both fold into a single exchange.
 */
export interface Exchange {
  /** The turn that opened the exchange. Stable for the life of the conversation. */
  id: string;
  /** The newest turn in it. An approval resumes against this, not against `id`. */
  turnId: string;
  question: string;
  threads: TranscriptThread[];
  status: 'streaming' | 'waiting' | 'done' | 'error';
  /** Present only when `status` is `error`. */
  error?: string;
  /** Calls parked on a human. Non-empty exactly when `status` is `waiting`. */
  pending: PendingCall[];
}

interface TurnInputItem {
  type?: string;
  content?: string;
}

/** The fields of the event union this module reads. Everything else is ignored. */
export interface HarnessEvent {
  type?: string;
  thread_id?: string | null;
  turn_id?: string;
  title?: string;
  content?: unknown;
  input?: TurnInputItem[];
  agent_info?: { name?: string };
  state?: { status?: string; message?: string };
  tool_calls?: { id: string; function?: { name?: string } }[];
}

/** One entry of `GET /sessions/{id}/events`. */
export interface SessionEventItem {
  turn_id: string;
  event: HarnessEvent;
}

const ROOT_TITLE = 'Council';

function withThread(exchange: Exchange, id: string, patch: Partial<TranscriptThread>): Exchange {
  const known = exchange.threads.find((t) => t.id === id);
  const base = known ?? {
    id,
    title: id === 'main' ? ROOT_TITLE : id,
    text: '',
    done: false,
  };
  const next = { ...base, ...patch, text: base.text + (patch.text ?? '') };

  return {
    ...exchange,
    threads: known
      ? exchange.threads.map((t) => (t.id === id ? next : t))
      : [...exchange.threads, next],
  };
}

/** Everything a harness turn's `input` says the human just did. */
function questionOf(event: HarnessEvent) {
  return event.input?.find((item) => item.type === 'user.message')?.content;
}

function isApprovalResume(event: HarnessEvent) {
  return event.input?.some((item) => item.type === 'user.tool_approval') ?? false;
}

/** Folds one event into the conversation. Events must arrive in order. */
export function reduceTranscript(transcript: Exchange[], event: HarnessEvent): Exchange[] {
  const open = transcript.at(-1);

  if (event.type === 'turn.created') {
    const turnId = event.turn_id ?? '';
    const question = questionOf(event);

    // A resume carries no question — it continues the answer that parked, so it
    // takes over the open exchange rather than opening an empty one. Its turn
    // id becomes the one a later approval chains onto, and the calls it just
    // answered stop being pending.
    if (question === undefined && isApprovalResume(event) && open) {
      return [...transcript.slice(0, -1), { ...open, turnId, status: 'streaming', pending: [] }];
    }

    return [
      ...transcript,
      {
        id: turnId,
        turnId,
        question: question ?? '',
        threads: [],
        status: 'streaming',
        pending: [],
      },
    ];
  }

  if (!open) return transcript;

  const patched = (next: Exchange) => [...transcript.slice(0, -1), next];
  const threadId = event.thread_id ?? 'main';

  switch (event.type) {
    case 'thread.created':
      return patched(
        withThread(open, threadId, { title: event.agent_info?.name ?? event.title ?? threadId }),
      );

    case 'model.message':
    case 'model.message.delta':
      // Live, `model.message` opens a reply and carries nothing; in history it
      // carries the whole thing. Skipping the empty one keeps both honest.
      return typeof event.content === 'string' && event.content
        ? patched(withThread(open, threadId, { text: event.content }))
        : transcript;

    case 'thread.done':
      // Only carry a title if this event has one, or the name set by
      // `thread.created` is replaced with the opaque thread id.
      return patched(
        withThread(open, threadId, { done: true, ...(event.title ? { title: event.title } : {}) }),
      );

    case 'tool.approval_required':
      return patched({
        ...open,
        pending: mergeApprovals(open.pending, event),
        status: 'waiting',
      });

    case 'turn.done': {
      // A turn that only stopped to ask still reports `status: "done"`, so the
      // parked calls decide this, not the harness's own word for it.
      if (open.pending.length > 0) return patched({ ...open, status: 'waiting' });

      const status = statusFromTurnDone(event);
      return patched({
        ...open,
        status,
        ...(status === 'error' && event.state?.message ? { error: event.state.message } : {}),
      });
    }

    default:
      return transcript;
  }
}

/**
 * Rehydrates a conversation from `GET /sessions/{id}/events`.
 *
 * Takes the payload exactly as the harness returns it — newest event first —
 * because the orientation belongs inside the tested seam. Reversing it at each
 * call site is the kind of mistake that populates every field and still shows
 * the conversation backwards.
 */
export function projectTranscript(items: SessionEventItem[]): Exchange[] {
  return items.reduceRight(
    (transcript, item) => reduceTranscript(transcript, item.event),
    [] as Exchange[],
  );
}
