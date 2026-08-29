import { describe, expect, it } from 'vitest';
import { planTurn } from './planTurn';

/**
 * Seam: the decision of whether an ask continues the current conversation or
 * starts a new one.
 *
 * This is the whole of multi-turn. A session is bound to its agent spec at
 * creation, so a change of scope or council membership cannot be applied to a
 * running session — it has to fork. Getting that backwards either loses the
 * conversation on every ask, or silently answers under the previous scope.
 */

const selection = { scope: 'repo' as const, personaIds: ['hostile', 'shipper'] };

describe('planTurn', () => {
  it('starts a new session when there is no session yet', () => {
    expect(planTurn({ current: undefined, next: selection })).toEqual({ mode: 'new' });
  });

  it('continues the session when the selection is unchanged', () => {
    const current = { sessionId: 'sess_1', ...selection };

    expect(planTurn({ current, next: selection })).toEqual({
      mode: 'continue',
      sessionId: 'sess_1',
    });
  });

  it('forks a new session when the scope changes', () => {
    const current = { sessionId: 'sess_1', ...selection };

    // The spec is fixed at session creation, so a plan-only ask cannot run on a
    // session created with a sandbox.
    expect(planTurn({ current, next: { ...selection, scope: 'plan' } })).toEqual({ mode: 'new' });
  });

  it('forks a new session when the council membership changes', () => {
    const current = { sessionId: 'sess_1', ...selection };

    expect(planTurn({ current, next: { ...selection, personaIds: ['hostile'] } })).toEqual({
      mode: 'new',
    });
  });

  it('treats persona order as irrelevant', () => {
    const current = { sessionId: 'sess_1', ...selection };

    // Chip click order must not silently throw away the conversation.
    expect(planTurn({ current, next: { ...selection, personaIds: ['shipper', 'hostile'] } })).toEqual(
      { mode: 'continue', sessionId: 'sess_1' },
    );
  });
});
