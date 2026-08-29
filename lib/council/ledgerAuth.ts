import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/config/env';

/**
 * The credential the harness presents when it calls our MCP endpoint.
 *
 * Without this, `POST /api/mcp` is an open write endpoint: anyone who can reach
 * the app can invoke `record_decision` and append to the ledger, which routes
 * around the approval gate entirely. The gate in the agent spec governs how
 * *TrueForge* calls the tool — it does not protect the HTTP route.
 *
 * The value comes from `lib/config/env.ts`, which defaults it to a fresh random
 * secret per process so the app still boots with zero secrets set. That means it
 * changes on restart, which is exactly why registration is an upsert rather than
 * a create-if-absent.
 */

export const LEDGER_AUTH_HEADER = 'x-outside-ledger-token';

export const LEDGER_SECRET = env.LEDGER_SHARED_SECRET;

/** Constant-time compare, so a wrong token cannot be found one byte at a time. */
export function isAuthorised(presented: string | null): boolean {
  if (!presented) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(LEDGER_SECRET);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
