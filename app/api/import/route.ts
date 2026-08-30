import { z } from 'zod';
import { parseClaudeCode } from '@/lib/import/parseClaudeCode';
import { parsePaste } from '@/lib/import/parsePaste';
import { toSeedMessage } from '@/lib/import/seedMessage';

/**
 * Turns a conversation dump into the one message TrueForge can seed a session
 * with.
 *
 * It stops there on purpose. `POST /api/council` is the only place a session is
 * created, because a session is bound to its agent spec — scope, personas,
 * sandbox, the ledger server — and all of that lives in `buildCouncilSpec`. A
 * second create path here would be the same module wearing two coats, and it
 * would produce sessions the council console has no way to continue. Import's
 * job is the transform; the seed goes into the ask box and the existing turn
 * loop takes it from there.
 *
 * The transform runs on the server so the size cap and the fencing are enforced
 * where they cannot be skipped by calling the endpoint directly.
 */

export const runtime = 'nodejs';

const SOURCES = {
  paste: { parse: parsePaste, label: 'a paste' },
  'claude-code': { parse: parseClaudeCode, label: 'a Claude Code session' },
};

const Body = z.object({
  source: z.enum(['paste', 'claude-code']),
  /**
   * Two megabytes. A Claude Code session file passes that inside a day of work,
   * and only 4000 characters survive into the seed — so this is a limit on what
   * the process will hold, not on what is useful.
   */
  text: z.string().min(1).max(2_000_000),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 422 });
  }

  const { parse, label } = SOURCES[parsed.data.source];
  const transcript = parse(parsed.data.text);
  if (transcript.length === 0) {
    return Response.json({ error: 'Nothing readable in that import.' }, { status: 422 });
  }

  const seed = toSeedMessage(transcript, { label });
  return Response.json({
    content: seed.message.content,
    messageCount: seed.messageCount,
    truncated: seed.truncated,
  });
}
