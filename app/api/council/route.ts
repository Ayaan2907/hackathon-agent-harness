import { z } from 'zod';
import { env } from '@/lib/config/env';
import { buildCouncilSpec } from '@/lib/council/spec';
import { LEDGER_AUTH_HEADER, LEDGER_SECRET } from '@/lib/council/ledgerAuth';

/**
 * Proxies one council ask — and any approval resume — between the browser and
 * the harness.
 *
 * The browser cannot talk to the harness directly: `TRUEFORGE_BASE_URL` is
 * server-only and may carry a token. Everything streams through this route on
 * the app's own origin.
 *
 * One session, one turn, N subagents — not N sessions. Every event carries a
 * `thread_id`, so a single stream already separates the voices, and the browser
 * keeps one connection instead of one per persona.
 */

export const runtime = 'nodejs';
/** SSE must not be buffered or statically optimized. */
export const dynamic = 'force-dynamic';

const API = `${env.TRUEFORGE_BASE_URL}/api/v1`;
const MCP_NAME = 'outside-ledger';

const Ask = z.object({
  kind: z.literal('ask'),
  question: z.string().min(1).max(4000),
  scope: z.enum(['repo', 'plan']),
  personaIds: z.array(z.string().min(1).max(64)).min(1).max(4),
});

const Approve = z.object({
  kind: z.literal('approve'),
  sessionId: z.string().min(1),
  previousTurnId: z.string().min(1),
  threadId: z.string().min(1),
  toolCallId: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
  reason: z.string().max(500).optional(),
});

const Body = z.discriminatedUnion('kind', [Ask, Approve]);

function headers() {
  return {
    'content-type': 'application/json',
    ...(env.TRUEFORGE_API_KEY ? { authorization: `Bearer ${env.TRUEFORGE_API_KEY}` } : {}),
  };
}

async function harness(path: string, init: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    throw new Error(`harness ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res;
}

/**
 * Registers this app's MCP endpoint with the harness, once, on first ask.
 *
 * Doing it here rather than by hand in Settings means a judge who clones the
 * repo and runs `npx @truefoundry/trueforge` gets a working approval gate with
 * no manual setup step.
 */
async function ensureLedgerRegistered(mcpUrl: string) {
  // Upsert rather than create-if-absent. A registration left by another
  // checkout, port, or process carries a stale URL and a stale secret, and
  // matching on name alone would happily reuse it — pointing record_decision at
  // the wrong server, or at one whose token we no longer hold.
  await harness('/settings/mcp-servers', {
    method: 'PUT',
    body: JSON.stringify({
      manifest: {
        type: 'remote',
        name: MCP_NAME,
        url: mcpUrl,
        description: 'Append-only decision ledger for the Outside council.',
        auth: { type: 'header', headers: { [LEDGER_AUTH_HEADER]: LEDGER_SECRET } },
      },
    }),
  });
}

/** Creates the turn and hands the harness SSE body straight to the browser. */
function passthrough(upstream: Response, extra: Record<string, string> = {}) {
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      ...extra,
    },
  });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 422 });
  }
  const body = parsed.data;

  try {
    if (body.kind === 'approve') {
      const turn = await harness(`/sessions/${body.sessionId}/turns`, {
        method: 'POST',
        body: JSON.stringify({
          previous_turn_id: body.previousTurnId,
          stream: true,
          input: [
            {
              type: 'user.tool_approval',
              thread_id: body.threadId,
              tool_call_id: body.toolCallId,
              approval:
                body.decision === 'allow'
                  ? { status: 'allow' }
                  : { status: 'deny', reason: body.reason ?? 'Declined by the supervisor.' },
            },
          ],
        }),
      });
      return passthrough(turn, { 'x-session-id': body.sessionId });
    }

    // From configuration, never from request.url — the incoming Host is
    // caller-controlled and this URL is persisted in the harness.
    const mcpUrl = new URL('/api/mcp', env.APP_BASE_URL).toString();
    if (body.scope === 'repo') await ensureLedgerRegistered(mcpUrl);

    const spec = await buildCouncilSpec({
      scope: body.scope,
      personaIds: body.personaIds,
      mcpUrl,
    });

    const session = await harness('/sessions', {
      method: 'POST',
      body: JSON.stringify({ agent: { spec } }),
    });
    const sessionId = (await session.json()).data.id as string;

    const turn = await harness(`/sessions/${sessionId}/turns`, {
      method: 'POST',
      body: JSON.stringify({
        stream: true,
        input: [{ type: 'user.message', content: body.question }],
      }),
    });

    // The browser needs the session id to resume after an approval, and SSE
    // gives it no other channel — so it rides on a response header.
    return passthrough(turn, { 'x-session-id': sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown harness error';
    return Response.json({ error: message }, { status: 502 });
  }
}
