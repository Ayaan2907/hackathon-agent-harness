import { z } from 'zod';
import { env } from '@/lib/config/env';
import { projectTranscript, type SessionEventItem } from '@/lib/council/transcript';

/**
 * Reads past conversations back out of the harness.
 *
 * `GET /api/sessions` lists them; `GET /api/sessions?id=…` rebuilds one into
 * the same transcript the live stream produces, so reopening a session shows
 * what was said instead of starting over.
 *
 * Read-only, and deliberately. Approvals still go through `/api/council`, which
 * only accepts sessions this process started — so a session rehydrated after a
 * restart can be read but not resumed. That is the safe direction to fail, and
 * widening it belongs in the route that owns the check, not here.
 *
 * Raw fetch rather than the SDK, matching `/api/council`. The SDK camel-cases
 * every key — `threadId`, `turnId`, `requiredActions` — while the SSE stream
 * the console already consumes is snake_case. Taking both would mean teaching
 * the projection two vocabularies for one wire format.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API = `${env.TRUEFORGE_BASE_URL}/api/v1`;

/** Session ids are path segments upstream; bound them before they get there. */
const SessionId = z.string().min(1).max(64);

const SessionPage = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      updated_at: z.string(),
    }),
  ),
});

const EventPage = z.object({
  data: z.array(
    z.object({
      turn_id: z.string(),
      // The event union is validated by the projection, which treats every
      // field as optional because it has to survive a partial page anyway.
      event: z.record(z.string(), z.unknown()),
    }),
  ),
});

async function harness(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: env.TRUEFORGE_API_KEY ? { authorization: `Bearer ${env.TRUEFORGE_API_KEY}` } : {},
  });
  if (!res.ok) {
    throw new Error(`harness ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('id');

  try {
    if (raw === null) {
      const page = SessionPage.parse(await harness('/sessions?limit=25'));
      return Response.json({
        sessions: page.data.map(({ id, title, updated_at }) => ({
          id,
          title,
          updatedAt: updated_at,
        })),
      });
    }

    const id = SessionId.safeParse(raw);
    if (!id.success) return Response.json({ error: 'bad session id' }, { status: 422 });

    // ponytail: one page, so a session past ~100 events rehydrates only its
    // recent turns. Follow `pagination.next_page_token` when that bites.
    const page = EventPage.parse(await harness(`/sessions/${id.data}/events?limit=100`));

    return Response.json({
      id: id.data,
      // The harness returns newest event first; `projectTranscript` owns that.
      transcript: projectTranscript(page.data as unknown as SessionEventItem[]),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown harness error';
    return Response.json({ error: message }, { status: 502 });
  }
}
