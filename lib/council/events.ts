/**
 * Turning harness events into the decisions the console acts on.
 *
 * Kept out of the streaming hook so both are testable without a network, and
 * because getting either wrong is silent: a stranded approval leaves the turn
 * parked forever, and a mis-read terminal state reports a failure as success.
 */

/** The gated tool, used when an approval event omits the function name. */
const LEDGER_TOOL = 'record_decision';

/**
 * One call waiting on a human.
 *
 * The thread travels with the call: when a council fans out, each subagent
 * parks its own write on its own thread, and the resume has to name the right
 * thread for each one.
 */
export interface PendingCall {
  threadId: string;
  toolCallId: string;
  toolName: string;
}

interface ApprovalEvent {
  type?: string;
  thread_id?: string | null;
  tool_calls?: { id: string; function?: { name?: string } }[];
}

export function approvalsFrom(event: ApprovalEvent): PendingCall[] {
  const threadId = event.thread_id ?? 'main';

  return (event.tool_calls ?? []).map((call) => ({
    threadId,
    toolCallId: call.id,
    toolName: call.function?.name ?? LEDGER_TOOL,
  }));
}

/**
 * Folds a new approval event into what is already pending.
 *
 * A turn parks once per subagent that wants to write, so several events arrive
 * with different thread ids. The harness refuses a resume that misses any of
 * them — "Send batch must resolve all pending tool calls awaiting user input" —
 * so these accumulate across threads rather than replacing each other.
 */
export function mergeApprovals(existing: PendingCall[], event: ApprovalEvent): PendingCall[] {
  const seen = new Set(existing.map((c) => c.toolCallId));
  const added = approvalsFrom(event).filter((c) => !seen.has(c.toolCallId));

  return added.length === 0 ? existing : [...existing, ...added];
}

/** The calls one voice has parked, with that voice named. */
export interface PendingVoice {
  threadId: string;
  /** The subagent's name, or `Council` for the root thread. */
  name: string;
  calls: PendingCall[];
}

/**
 * Says *who* is waiting, not just how many calls are.
 *
 * The gate fires on whichever thread wanted the write — `main` when the agent
 * asks for itself, a subagent thread when a council fans out — and a strip that
 * only counts calls gives the reader nothing to weigh the decision against.
 * Threads come from the exchange, where `thread.created` named them.
 */
export function pendingVoices(
  pending: PendingCall[],
  threads: { id: string; title: string }[],
): PendingVoice[] {
  const voices: PendingVoice[] = [];

  for (const call of pending) {
    const known = voices.find((v) => v.threadId === call.threadId);
    if (known) {
      known.calls.push(call);
      continue;
    }

    // A rehydrated session can miss the `thread.created` that named a voice.
    // A short form of the id is worse than a name and far better than hiding an
    // approval the turn cannot finish without.
    const title =
      threads.find((t) => t.id === call.threadId)?.title ?? `thread ${call.threadId.slice(0, 8)}`;

    voices.push({ threadId: call.threadId, name: title, calls: [call] });
  }

  return voices;
}

/** A turn can end in failure; only a `done` state is actually a success. */
export function statusFromTurnDone(event: { state?: { status?: string } }): 'done' | 'error' {
  const status = event.state?.status;
  if (!status) return 'done';
  return status === 'done' ? 'done' : 'error';
}
