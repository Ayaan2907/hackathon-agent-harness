import { z } from 'zod';
import { deletePersona, Meta, savePersona, seedPersonas } from '@/lib/council/personas';

/**
 * The persona registry, backed by saved TrueForge agents.
 *
 * `GET` seeds `profiles/` into an empty harness and lists what is there, so a
 * fresh clone has a council without a setup step. `POST` and `DELETE` are the
 * path to personas the repo never shipped.
 *
 * A persona body becomes a model's system prompt, which is why this route is a
 * deliberate human action rather than something a scraper can drive. Text
 * pulled off a public page has to pass through a person editing it before it
 * arrives here.
 */

export const runtime = 'nodejs';
/** Never prerender: this route reads and writes the harness. */
export const dynamic = 'force-dynamic';

const Body = Meta.omit({ origin: true }).extend({
  /** The brief that becomes the saved agent's instructions. */
  brief: z.string().min(1).max(20_000),
});

/** The harness is a separate process; when it is down, say so as a 502. */
function failed(error: unknown) {
  const message = error instanceof Error ? error.message : 'unknown harness error';
  return Response.json({ error: message }, { status: 502 });
}

export async function GET() {
  try {
    return Response.json({ personas: await seedPersonas() });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 422 });
  }

  const { brief, ...fields } = parsed.data;
  // Not `fixture`: a persona saved here did not ship with the repo.
  const persona = { ...fields, origin: 'built' } as const;

  try {
    await savePersona(persona, brief);
    return Response.json({ persona }, { status: 201 });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: Request) {
  const id = Meta.shape.id.safeParse(new URL(request.url).searchParams.get('id'));
  if (!id.success) {
    return Response.json({ error: 'unknown persona' }, { status: 422 });
  }

  try {
    // The harness delete is idempotent, and so is this: gone stays gone.
    await deletePersona(id.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failed(error);
  }
}
