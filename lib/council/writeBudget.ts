/**
 * Approvals a human has granted but that no ledger write has spent yet.
 *
 * The shared secret on `/api/mcp` proves the caller is the harness. It does not
 * prove that the approval gate actually ran, so on its own it would let anyone
 * holding the secret write to the ledger. This closes that: a write must spend
 * an approval, and approvals are only ever granted by the approve branch of
 * `/api/council` after a human clicked.
 *
 * ponytail: a single process-wide counter, not a per-call binding. MCP
 * `tools/call` carries no `tool_call_id`, so a write cannot be tied to the
 * specific call that was approved — a grant from one session could in principle
 * be spent by a write from another. The invariant that holds is "no write
 * without a human approval", which is the one the product actually claims.
 * Bind per call if TrueForge ever forwards the tool call id to the MCP server.
 */

/**
 * Held on `globalThis` for the same reason the ledger secret is: `/api/council`
 * grants and `/api/mcp` spends, and Next compiles those routes into separate
 * module instances. A module-level counter would mean the grant and the spend
 * never see each other, and every approved write would be refused.
 */
const store = globalThis as typeof globalThis & { __outsideWriteBudget?: number };
store.__outsideWriteBudget ??= 0;

/** Called once per tool call a human allowed. */
export function grantWrite(): void {
  store.__outsideWriteBudget = (store.__outsideWriteBudget ?? 0) + 1;
}

/** Spends one approval. False means no human authorised a write. */
export function consumeWrite(): boolean {
  const current = store.__outsideWriteBudget ?? 0;
  if (current <= 0) return false;
  store.__outsideWriteBudget = current - 1;
  return true;
}

export function outstandingWrites(): number {
  return store.__outsideWriteBudget ?? 0;
}

/** Tests only. */
export function resetWriteBudget(): void {
  store.__outsideWriteBudget = 0;
}
