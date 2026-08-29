import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/**
 * A minimal MCP server, served by this app and attached to the council agent.
 *
 * Why this exists: `require_approval_for_tools` is a per-MCP-server field in
 * TrueForge. Sandbox and file tools are built in, not MCP, so they cannot be
 * approval-gated. Without an MCP server exposing a genuinely irreversible tool,
 * `tool.approval_required` never fires and the console has no approval moment to
 * show — which is a mandatory part of the submission.
 *
 * The agent gates this tool by literal name rather than by the `@write`
 * selector, so the gate does not depend on the model or the transport inferring
 * a write annotation correctly.
 *
 * Speaks JSON-RPC 2.0 over HTTP by hand. The official SDK would add a
 * dependency for three methods.
 */

const PROTOCOL_VERSION = '2025-06-18';

/** Where `record_decision` appends. Relative to the repo root, git-ignored. */
const LEDGER = join(process.cwd(), '.outside', 'decisions.jsonl');

const RecordDecision = z.object({
  persona: z.string().min(1).max(80),
  decision: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(2000),
});

const TOOLS = [
  {
    name: 'record_decision',
    description:
      'Append a council decision to the project decision ledger on disk. This is ' +
      'irreversible: the ledger is append-only and this entry cannot be edited or ' +
      'removed once written. Call it only when a decision is final.',
    inputSchema: {
      type: 'object',
      properties: {
        persona: { type: 'string', description: 'Which council voice is recording this.' },
        decision: { type: 'string', description: 'The decision, one sentence.' },
        rationale: { type: 'string', description: 'Why, one or two sentences.' },
      },
      required: ['persona', 'decision', 'rationale'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
];

async function recordDecision(args: unknown) {
  const parsed = RecordDecision.safeParse(args);
  if (!parsed.success) {
    return { isError: true, content: [{ type: 'text', text: z.prettifyError(parsed.error) }] };
  }

  const entry = { ...parsed.data, recorded_at: new Date().toISOString() };
  await mkdir(dirname(LEDGER), { recursive: true });
  await appendFile(LEDGER, `${JSON.stringify(entry)}\n`, 'utf8');

  return {
    content: [{ type: 'text', text: `Recorded to the ledger at ${entry.recorded_at}.` }],
  };
}

/** JSON-RPC error codes we actually use. */
const METHOD_NOT_FOUND = -32601;

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: unknown; method?: string; params?: unknown };
  const { id, method } = body;

  // Notifications carry no id and expect no response body.
  if (id === undefined) return new Response(null, { status: 202 });

  const reply = (result: unknown) => Response.json({ jsonrpc: '2.0', id, result });

  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'outside-ledger', version: '0.1.0' },
      });

    case 'tools/list':
      return reply({ tools: TOOLS });

    case 'tools/call': {
      const params = body.params as { name?: string; arguments?: unknown } | undefined;
      if (params?.name !== 'record_decision') {
        return Response.json({
          jsonrpc: '2.0',
          id,
          error: { code: METHOD_NOT_FOUND, message: `Unknown tool: ${params?.name}` },
        });
      }
      return reply(await recordDecision(params.arguments));
    }

    default:
      return Response.json({
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `Unknown method: ${method}` },
      });
  }
}
