import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { z } from 'zod';
import { harness } from '@/lib/harness/client';
import type { Persona } from './types';

/**
 * Personas as saved TrueForge agents.
 *
 * A pack in `profiles/` is the seed, not the store. Each persona is written to
 * the harness as an agent named `persona-<id>`, so a persona someone writes in
 * the console outlives the process without this repo growing a database.
 *
 * A saved persona is still `instructions`, never `skills`. A TrueForge skill is
 * a git URL cloned inside the sandbox, and `skills` requires
 * `config.sandbox.enabled`, so a skill-backed persona would be dropped silently
 * in plan-only scope. Saving the persona as an agent does not change that.
 *
 * Verified against `/api/v1/openapi.json` on TrueForge 0.1.4, and by running
 * the four calls: `POST /agents` takes `{ name, manifest }` and 409s on a name
 * that already exists, `PUT /agents/{id}` takes `{ manifest }` alone, and both
 * `PUT` and `DELETE` key on the generated id rather than the name.
 */

/** Verified against `GET /api/v1/models`. Shared with the council spec. */
export const MODEL = 'openai/gpt-5-4-mini';

/**
 * Saved agent names are `persona-<id>`. The prefix is also what makes the name
 * legal: a `ResourceName` must start with a letter and be at least two
 * characters, and a persona id has to satisfy neither.
 */
const NAME_PREFIX = 'persona-';

/**
 * A persona id becomes a path segment under `profiles/` and a suffix of the
 * saved agent name, so it has to be safe for both. `ResourceName` caps the
 * whole name at 64 characters and forbids a trailing `-`.
 */
const PERSONA_ID = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

const PROFILES_DIR = resolve(process.cwd(), 'profiles');

/** No newline may reach the metadata header — it would forge extra fields. */
const line = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !/[\n\r]/.test(value), 'must be one line');

/** The metadata every persona carries, wherever it arrives from. */
export const Meta = z.object({
  id: z.string().regex(PERSONA_ID),
  name: line(80),
  stance: line(240),
  origin: z.enum(['fixture', 'built']),
});

/**
 * Resolves a file inside a persona pack, refusing any id that escapes
 * `profiles/`. Ids arrive on an HTTP body, so an id like `../../etc/passwd`
 * would otherwise read whatever it liked and hand it to a model as
 * instructions. Two independent guards: a strict shape, and a check that the
 * resolved path really is under `profiles/`.
 */
export function packPath(id: string, file: 'SKILL.md' | 'profile.yaml'): string {
  if (!PERSONA_ID.test(id)) {
    throw new Error(`Unknown persona: ${JSON.stringify(id)}`);
  }

  const path = resolve(PROFILES_DIR, id, file);
  const inside = relative(PROFILES_DIR, path);
  if (inside.startsWith('..') || resolve(PROFILES_DIR, inside) !== path) {
    throw new Error(`Unknown persona: ${JSON.stringify(id)}`);
  }

  return path;
}

/**
 * Flat `key: value` scalars, which is all a `profile.yaml` and all a metadata
 * header ever contain. A YAML parser would be a dependency for five lines.
 */
function parseFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const raw of text.split('\n')) {
    const at = raw.indexOf(':');
    if (at < 1 || raw.startsWith('#')) continue;

    const value = raw
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    // `source: null` is how a fixture pack says "grown from nothing".
    if (value && value !== 'null') fields[raw.slice(0, at).trim()] = value;
  }

  return fields;
}

function parseMeta(fields: unknown): Persona {
  const parsed = Meta.safeParse(fields);
  if (!parsed.success) {
    throw new Error(`Invalid persona: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function agentName(id: string): string {
  if (!PERSONA_ID.test(id)) {
    throw new Error(`Unknown persona: ${JSON.stringify(id)}`);
  }
  return `${NAME_PREFIX}${id}`;
}

/**
 * A persona and its brief → the body `POST /api/v1/agents` expects.
 *
 * The metadata rides in a header on the instructions because a TrueForge agent
 * record is `{ id, name, manifest }` and has nowhere else to put it. The
 * manifest is deliberately model plus instructions and nothing else: no skills,
 * no sandbox, no MCP servers. Capability belongs to the council spec, which
 * decides it per scope.
 */
export function toAgentBody(persona: Persona, brief: string) {
  const meta = parseMeta(persona);
  const header = Object.entries(meta).map(([key, value]) => `${key}: ${value}`);

  return {
    name: agentName(meta.id),
    manifest: {
      // Reasoning models reject temperature; see lib/council/spec.ts.
      model: { name: MODEL, params: { reasoning_effort: 'medium' } },
      instructions: ['---', ...header, '---', '', brief].join('\n'),
    },
  };
}

/** `profile.yaml` → the persona it describes. */
export function parsePack(profileYaml: string): Persona {
  return parseMeta(parseFields(profileYaml));
}

/**
 * The inverse. Returns null for anything in the registry that is not one of
 * ours — the council agent, or something a human saved in the TrueForge
 * console — rather than throwing and taking the whole list down with it.
 */
export function fromAgent(agent: {
  name: string;
  manifest?: { instructions?: string };
}): Persona | null {
  const instructions = agent.manifest?.instructions;
  if (!agent.name.startsWith(NAME_PREFIX) || !instructions?.startsWith('---\n')) return null;

  const end = instructions.indexOf('\n---\n', 3);
  if (end < 0) return null;

  const parsed = Meta.safeParse(parseFields(instructions.slice(4, end)));
  // The header must agree with the name it is filed under.
  if (!parsed.success || `${NAME_PREFIX}${parsed.data.id}` !== agent.name) return null;

  return parsed.data;
}

async function listPersonas(): Promise<Persona[]> {
  const { data } = await harness.agents.list();
  return data.map((agent) => fromAgent(agent)).filter((persona) => persona !== null);
}

/** A pack on disk, or null when the directory is missing either half. */
async function readPack(id: string): Promise<{ profileYaml: string; brief: string } | null> {
  try {
    const [profileYaml, brief] = await Promise.all([
      readFile(packPath(id, 'profile.yaml'), 'utf8'),
      readFile(packPath(id, 'SKILL.md'), 'utf8'),
    ]);
    return { profileYaml, brief };
  } catch {
    return null;
  }
}

/**
 * Seeds `profiles/` into an empty registry and returns what is saved.
 *
 * Only when it is empty: reseeding on every boot would overwrite an edited
 * persona with the fixture it started as. The flip side is that deleting every
 * persona brings the fixtures back, which is the direction worth failing in —
 * the console is never left with no voices.
 */
export async function seedPersonas(): Promise<Persona[]> {
  const saved = await listPersonas();
  if (saved.length > 0) return saved;

  const entries = await readdir(PROFILES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pack = await readPack(entry.name);
    if (pack) await harness.agents.create(toAgentBody(parsePack(pack.profileYaml), pack.brief));
  }

  return listPersonas();
}

/** Creates the persona, or replaces the manifest of one already saved. */
export async function savePersona(persona: Persona, brief: string): Promise<void> {
  const body = toAgentBody(persona, brief);
  const { data } = await harness.agents.list();
  const existing = data.find((agent) => agent.name === body.name);

  // POST rejects a name that exists, and PUT keys on the generated id and
  // rejects `name` as an unrecognised key. Two calls, two different bodies.
  if (existing) await harness.agents.update(existing.id, { manifest: body.manifest });
  else await harness.agents.create(body);
}

export async function deletePersona(id: string): Promise<void> {
  const name = agentName(id);
  const { data } = await harness.agents.list();
  const existing = data.find((agent) => agent.name === name);

  if (existing) await harness.agents.delete(existing.id);
}
