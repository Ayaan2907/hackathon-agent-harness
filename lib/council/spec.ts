import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import type { Scope } from './types';

/**
 * Builds the inline agent spec for one council ask.
 *
 * The scope toggle is a real capability difference, not a prompt instruction:
 *
 *   repo → sandbox on, the ledger MCP server attached
 *   plan → sandbox off, no MCP servers at all
 *
 * So a plan-only answer cannot read a file or write to the ledger even if the
 * model tries. It has no such tools.
 *
 * Personas are delivered as instructions rather than TrueForge skills on
 * purpose: `skills` requires `config.sandbox.enabled: true`, so a skill-backed
 * persona would be silently dropped in plan-only scope and the two halves of
 * the toggle would be comparing different voices.
 */

/** Verified against `GET /api/v1/models` on the running harness. */
const MODEL = 'openai/gpt-5-4-mini';

/** Gated by literal name so the pause does not depend on write-annotation inference. */
const LEDGER_TOOL = 'record_decision';

/** The sandbox starts empty, so repo scope clones this to have something to read. */
const REPO_URL = 'https://github.com/Ayaan2907/hackathon-agent-harness.git';

/**
 * Persona ids arrive on an HTTP body and are joined into a filesystem path, so
 * an id like `../../etc/passwd` would read whatever it liked and hand the
 * contents to the model as instructions. Two independent guards: a strict
 * shape, and a check that the resolved path really is inside `profiles/`.
 */
const PERSONA_ID = /^[a-z0-9][a-z0-9-]*$/;

const PROFILES_DIR = resolve(process.cwd(), 'profiles');

async function personaInstructions(id: string): Promise<string> {
  if (!PERSONA_ID.test(id)) {
    throw new Error(`Unknown persona: ${JSON.stringify(id)}`);
  }

  const path = resolve(PROFILES_DIR, id, 'SKILL.md');
  const inside = relative(PROFILES_DIR, path);
  if (inside.startsWith('..') || resolve(PROFILES_DIR, inside) !== path) {
    throw new Error(`Unknown persona: ${JSON.stringify(id)}`);
  }

  try {
    return await readFile(path, 'utf8');
  } catch {
    // Do not leak whether some other path exists.
    throw new Error(`Unknown persona: ${JSON.stringify(id)}`);
  }
}

const ROOT_INSTRUCTIONS = `You convene a review council.

You have been given a question and a set of reviewer personas. Delegate to one
subagent per persona — all of them, in parallel, in a single round. Pass that
persona's full brief as the subagent's instructions and give it the question
verbatim.

Do not answer in your own voice and do not average the personas into a
consensus. A council is only useful when its voices disagree. When the
subagents return, present each voice separately under its own heading, then
state in one line where they actually conflict.`;

const SCOPE_RULES: Record<Scope, string> = {
  repo: `Scope: THIS REPO. You have a sandbox, and it starts empty.

Before answering, clone the repository and read it:

    git clone --depth 1 ${REPO_URL} repo && ls repo

Then read the files that actually bear on the question and cite their paths.
Never claim what is in a file you did not open. If a path you expected is
missing, say so — do not guess and do not stop to ask.

When you have an answer, call ${LEDGER_TOOL} once to append the decision to the
ledger. That write is irreversible and will stop for human approval — that pause
is expected, not an error. Do not ask permission first; make the call and let
the approval gate do its job.`,

  plan: `Scope: PLAN ONLY. You have no file tools and no sandbox. Reason from the
question alone. Say plainly when something depends on code you were not shown,
and never guess at the contents of a codebase you cannot see.`,
};

export async function buildCouncilSpec(opts: {
  scope: Scope;
  personaIds: string[];
  /** Absolute URL of this app's MCP endpoint, reachable from the harness. */
  mcpUrl: string;
}) {
  const briefs = await Promise.all(
    opts.personaIds.map(async (id) => `## Persona: ${id}\n\n${await personaInstructions(id)}`),
  );

  const instructions = [ROOT_INSTRUCTIONS, SCOPE_RULES[opts.scope], ...briefs].join('\n\n---\n\n');

  return {
    model: { name: MODEL, params: { temperature: 0.4 } },
    instructions,
    // Plan-only gets no MCP servers at all — the ledger is unreachable by construction.
    mcp_servers:
      opts.scope === 'repo'
        ? [
            {
              name: 'outside-ledger',
              enable_tools: ['@all'],
              require_approval_for_tools: [LEDGER_TOOL],
              // Deferred discovery leaves the model to fetch the schema itself, and
              // it reliably decided not to bother — so the approval gate never fired.
              // One tool; preloading it costs almost nothing.
              preload: true,
            },
          ]
        : [],
    config: {
      sandbox: { enabled: opts.scope === 'repo' },
      dynamic_sub_agents: { enabled: true },
      // Left on, the agent stalls the turn on `ask_user_question` the moment a
      // file is missing — which parks the stream before it ever reaches the
      // approval gate. The console has no answer channel, so this stays off.
      ask_user_questions: { enabled: false },
    },
  };
}
