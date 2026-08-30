import { z } from 'zod';
import { env } from '@/lib/config/env';
import { parseSessionId } from '@/lib/council/sessionId';
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

/** How many event pages to follow before giving up on a very long session. */
const MAX_PAGES = 20;

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
  pagination: z.object({ next_page_token: z.string().nullish() }).partial().optional(),
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

    const id = parseSessionId(raw);
    if (!id) return Response.json({ error: 'bad session id' }, { status: 422 });

    // One page silently truncated any session past ~100 events — and a
    // transcript that quietly drops its older half is worse than no transcript,
    // because nothing on screen says it happened. Follow the token instead,
    // bounded so a pathological session cannot spin here.
    const events: SessionEventItem[] = [];
    let token: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ limit: '100' });
      if (token) query.set('page_token', token);

      const body = EventPage.parse(
        await harness(`/sessions/${encodeURIComponent(id)}/events?${query}`),
      );
      events.push(...(body.data as unknown as SessionEventItem[]));

      token = body.pagination?.next_page_token ?? undefined;
      if (!token) break;
    }

    return Response.json({
      id,
      truncated: Boolean(token),
      // The harness returns newest event first; `projectTranscript` owns that.
      transcript: projectTranscript(events),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown harness error';
    return Response.json({ error: message }, { status: 502 });
  }
}
