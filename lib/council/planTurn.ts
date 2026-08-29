import type { Scope } from './types';

/**
 * Decides whether an ask continues the current conversation or starts a new one.
 *
 * A TrueForge session is bound to its agent spec at creation, and the scope
 * toggle and council membership are both part of that spec. So a change to
 * either cannot be applied to a running session — it has to fork. Everything
 * else chains onto the existing session, which is what makes the console a
 * conversation rather than a series of one-shot asks.
 */

export interface Selection {
  scope: Scope;
  personaIds: string[];
}

export type TurnPlan = { mode: 'new' } | { mode: 'continue'; sessionId: string };

function sameCouncil(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((id, i) => id === sorted[i]);
}

export function planTurn({
  current,
  next,
}: {
  current: (Selection & { sessionId: string }) | undefined;
  next: Selection;
}): TurnPlan {
  if (!current) return { mode: 'new' };
  if (current.scope !== next.scope) return { mode: 'new' };
  if (!sameCouncil(current.personaIds, next.personaIds)) return { mode: 'new' };
  return { mode: 'continue', sessionId: current.sessionId };
}
