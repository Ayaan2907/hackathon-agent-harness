import { describe, expect, it } from 'vitest';
import { approvalsFrom, mergeApprovals, statusFromTurnDone } from './events';

/**
 * Seam: turning harness events into UI decisions.
 *
 * The shape here was corrected by the harness itself. When a council fans out,
 * each subagent parks its own write on its own thread, so a turn emits several
 * `tool.approval_required` events with *different* `thread_id`s. Resuming with
 * anything less than the full set is rejected:
 *
 *   "Send batch must resolve all pending tool calls awaiting user input.
 *    Missing: call_..."
 *
 * So pending approvals are a flat list of (thread, call) pairs, not one thread
 * with several calls.
 */

describe('approvalsFrom', () => {
  it('tags each call with the thread that parked it', () => {
    const calls = approvalsFrom({
      thread_id: 't1',
      tool_calls: [
        { id: 'a', function: { name: 'record_decision' } },
        { id: 'b', function: { name: 'record_decision' } },
      ],
    });

    expect(calls).toEqual([
      { threadId: 't1', toolCallId: 'a', toolName: 'record_decision' },
      { threadId: 't1', toolCallId: 'b', toolName: 'record_decision' },
    ]);
  });

  it('falls back to the ledger tool name when the event omits it', () => {
    expect(approvalsFrom({ thread_id: 't1', tool_calls: [{ id: 'a' }] })[0]?.toolName).toBe(
      'record_decision',
    );
  });

  it('treats a missing thread id as the root thread', () => {
    expect(approvalsFrom({ tool_calls: [{ id: 'a' }] })[0]?.threadId).toBe('main');
  });

  it('returns nothing when there is nothing pending', () => {
    expect(approvalsFrom({ thread_id: 't1', tool_calls: [] })).toEqual([]);
  });
});

describe('mergeApprovals', () => {
  it('accumulates across threads, which is what the harness demands', () => {
    const one = mergeApprovals([], { thread_id: 't1', tool_calls: [{ id: 'a' }] });
    const two = mergeApprovals(one, { thread_id: 't2', tool_calls: [{ id: 'b' }] });
    const three = mergeApprovals(two, { thread_id: 't3', tool_calls: [{ id: 'c' }] });

    expect(three.map((c) => [c.threadId, c.toolCallId])).toEqual([
      ['t1', 'a'],
      ['t2', 'b'],
      ['t3', 'c'],
    ]);
  });

  it('does not duplicate a call the harness repeats', () => {
    const one = mergeApprovals([], { thread_id: 't1', tool_calls: [{ id: 'a' }] });
    const again = mergeApprovals(one, { thread_id: 't1', tool_calls: [{ id: 'a' }] });

    expect(again).toHaveLength(1);
  });

  it('keeps what it had when an event carries no calls', () => {
    const one = mergeApprovals([], { thread_id: 't1', tool_calls: [{ id: 'a' }] });

    expect(mergeApprovals(one, { thread_id: 't1', tool_calls: [] })).toEqual(one);
  });
});

describe('statusFromTurnDone', () => {
  it('reports a completed turn as done', () => {
    expect(statusFromTurnDone({ state: { status: 'done' } })).toBe('done');
  });

  it('reports a failed turn as an error, not a success', () => {
    expect(statusFromTurnDone({ state: { status: 'error' } })).toBe('error');
  });

  it('reports a cancelled turn as an error', () => {
    expect(statusFromTurnDone({ state: { status: 'cancelled' } })).toBe('error');
  });

  it('defaults to done when the harness sends no state', () => {
    expect(statusFromTurnDone({})).toBe('done');
  });
});
