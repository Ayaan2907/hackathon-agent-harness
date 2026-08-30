import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Zod-validated environment variables. Single source of truth.
 *
 * Usage:
 *   import { env } from '@/lib/config/env';
 *
 * Rules:
 *   - Never read `process.env.X` directly outside this file.
 *   - A new env var needs a Zod entry below AND an entry in `.env.example`.
 *   - Everything is optional with a default, so the app boots with zero secrets.
 *     A missing key degrades one feature; it never stops the server.
 *
 * Bright Data / Daytona / OpenAI credentials deliberately do NOT live here.
 * Those are configured inside the TrueForge harness, which owns those calls.
 * The app only needs to know where the harness is.
 */

/**
 * Strip empty-string env values so `.optional()` schemas hit their defaults
 * instead of failing URL / min-length validation. `.env` files commonly set
 * `FOO=` for unset vars, and `process.env.FOO` then resolves to `""`.
 */
function stripEmpty(source: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
}

/**
 * A per-process secret, memoised on `globalThis`.
 *
 * Next compiles each route into its own module instance, so a module-level
 * random value differs between `/api/council` and `/api/mcp` — the harness then
 * presents the secret one route minted and the other rejects it with a 401.
 * `globalThis` is shared across those instances, so this is one value per
 * process, which is what "generated per process" has to mean here.
 */
function processLedgerSecret(): string {
  const store = globalThis as typeof globalThis & { __outsideLedgerSecret?: string };
  store.__outsideLedgerSecret ??= randomBytes(32).toString('hex');
  return store.__outsideLedgerSecret;
}

const schema = z.object({
  /** Base URL of the running TrueForge harness. `npx @truefoundry/trueforge` serves :8790. */
  TRUEFORGE_BASE_URL: z.url().default('http://localhost:8790'),
  /** Only needed if the harness is deployed behind auth. Local runs need nothing. */
  TRUEFORGE_API_KEY: z.string().optional(),
  /**
   * Where the harness should reach this app's MCP endpoint. Never derived from
   * the incoming request: that URL is caller-controlled, and a poisoned Host
   * header would register an attacker's server under our name.
   */
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  /**
   * Shared secret the harness presents to `/api/mcp`. Defaults to a fresh random
   * value per process, so the app boots with no secrets configured. Set it
   * explicitly to keep the harness registration stable across restarts.
   */
  /**
   * Whether the council may attach the Bright Data MCP server.
   *
   * Off by default. The server lists its tools happily but executing them
   * returns 407 from Bright Data's proxy, so attaching it only produces a
   * stream of transport errors on every repo-scope turn. Set to `auto` once
   * the credential actually works, and the route will attach it when the
   * harness has it configured.
   */
  /**
   * The repository repo scope clones into the sandbox. Falls back to this
   * checkout's `origin` remote. Set it when the app runs somewhere other than
   * the repository the council should read.
   */
  COUNCIL_REPO_URL: z.string().optional(),
  COUNCIL_WEB_SEARCH: z.enum(['off', 'auto']).default('off'),
  LEDGER_SHARED_SECRET: z.string().min(16).default(processLedgerSecret),
});

const parsed = schema.safeParse(stripEmpty(process.env));

if (!parsed.success) {
  throw new Error(
    `[env] invalid environment variables:\n${z.prettifyError(parsed.error)}\n\n` +
      'Fill .env.local. See .env.example.',
  );
}

export const env = parsed.data;
