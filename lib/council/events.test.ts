import { describe, expect, it } from 'vitest';
import { approvalsFrom, statusFromTurnDone } from './events';

/**
 * Seam: turning two harness events into UI decisions.
 *
 * Both were Qodo findings on #9. Keeping only `tool_calls[0]` silently strands
 * every other gated call — the turn stays parked with no way to release it.
 * Treating any `turn.done` as success reports a failed turn as a finished one.
 */

describe('approvalsFrom', () => {
  it('returns every pending call, not just the first', () => {
    const event = {
      type: 'tool.approval_required',
      thread_id: 't1',
      tool_calls: [
        { id: 'call_a', function: { name: 'record_decision' } },
        { id: 'call_b', function: { name: 'record_decision' } },
      ],
    };

    expect(approvalsFrom(event)).toEqual({
      threadId: 't1',
      calls: [
        { toolCallId: 'call_a', toolName: 'record_decision' },
        { toolCallId: 'call_b', toolName: 'record_decision' },
      ],
    });
  });

  it('falls back to the ledger tool name when the event omits it', () => {
    const event = { type: 'tool.approval_required', thread_id: 't1', tool_calls: [{ id: 'c' }] };

    expect(approvalsFrom(event)?.calls[0]?.toolName).toBe('record_decision');
  });

  it('returns undefined when there is nothing pending', () => {
    expect(approvalsFrom({ type: 'tool.approval_required', thread_id: 't1', tool_calls: [] })).toBeUndefined();
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
