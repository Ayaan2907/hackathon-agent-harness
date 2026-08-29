/**
 * Turning two harness events into the decisions the console acts on.
 *
 * Kept out of the streaming hook so both are testable without a network, and
 * because getting either wrong is silent: a stranded approval leaves the turn
 * parked forever, and a mis-read terminal state reports a failure as a success.
 */

/** The gated tool, used when an approval event omits the function name. */
const LEDGER_TOOL = 'record_decision';

export interface PendingCall {
  toolCallId: string;
  toolName: string;
}

export interface PendingApproval {
  threadId: string;
  /** Every call the harness is waiting on — all of them need a decision. */
  calls: PendingCall[];
}

interface ApprovalEvent {
  type?: string;
  thread_id?: string | null;
  tool_calls?: { id: string; function?: { name?: string } }[];
}

export function approvalsFrom(event: ApprovalEvent): PendingApproval | undefined {
  const calls = (event.tool_calls ?? []).map((call) => ({
    toolCallId: call.id,
    toolName: call.function?.name ?? LEDGER_TOOL,
  }));

  if (calls.length === 0) return undefined;

  return { threadId: event.thread_id ?? 'main', calls };
}

/** A turn can end in failure; only a `done` state is actually a success. */
export function statusFromTurnDone(event: { state?: { status?: string } }): 'done' | 'error' {
  const status = event.state?.status;
  if (!status) return 'done';
  return status === 'done' ? 'done' : 'error';
}
