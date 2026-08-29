import { describe, expect, it } from 'vitest';
import { buildCouncilSpec } from './spec';

/**
 * The scope toggle is the one branch where being wrong is a real problem: if
 * plan-only scope kept the sandbox or the ledger MCP server, a "plan only"
 * answer could read the repo or write to disk. These assert the capability
 * difference is real rather than a sentence in the prompt.
 */

const base = { personaIds: ['hostile'], mcpUrl: 'http://localhost:3000/api/mcp' };

describe('buildCouncilSpec', () => {
  it('gives repo scope a sandbox and the approval-gated ledger', async () => {
    const spec = await buildCouncilSpec({ ...base, scope: 'repo' });

    expect(spec.config.sandbox.enabled).toBe(true);
    expect(spec.mcp_servers).toHaveLength(1);
    expect(spec.mcp_servers[0]?.require_approval_for_tools).toContain('record_decision');
  });

  it('gives plan-only scope no sandbox and no write tools at all', async () => {
    const spec = await buildCouncilSpec({ ...base, scope: 'plan' });

    expect(spec.config.sandbox.enabled).toBe(false);
    expect(spec.mcp_servers).toEqual([]);
  });

  it('never leaves the agent able to stall the turn on a question', async () => {
    const spec = await buildCouncilSpec({ ...base, scope: 'repo' });

    // With this on, the agent parks the stream on `ask_user_question` before it
    // ever reaches the approval gate. The console has no answer channel.
    expect(spec.config.ask_user_questions.enabled).toBe(false);
  });

  it('loads each requested persona brief into the instructions', async () => {
    const spec = await buildCouncilSpec({
      ...base,
      personaIds: ['hostile', 'shipper'],
      scope: 'plan',
    });

    expect(spec.instructions).toContain('Persona: hostile');
    expect(spec.instructions).toContain('Persona: shipper');
    // The brief itself, not just the name — a missing file would fail the read.
    expect(spec.instructions).toContain('Hostile Reviewer');
  });
});

describe('buildCouncilSpec persona ids', () => {
  it.each([
    ['../../etc/passwd', 'parent traversal'],
    ['..', 'bare parent'],
    ['hostile/../../secrets', 'traversal after a valid segment'],
    ['/etc/passwd', 'absolute path'],
    ['nested/persona', 'subdirectory'],
  ])('rejects %s (%s)', async (id) => {
    // personaIds come straight off an HTTP body and are joined into a
    // filesystem path, so anything that escapes profiles/ must be refused
    // before it reaches readFile.
    await expect(
      buildCouncilSpec({ scope: 'plan', personaIds: [id], mcpUrl: 'http://localhost:3000/api/mcp' }),
    ).rejects.toThrow(/persona/i);
  });

  it('rejects an id that does not exist rather than reading elsewhere', async () => {
    await expect(
      buildCouncilSpec({
        scope: 'plan',
        personaIds: ['no-such-persona'],
        mcpUrl: 'http://localhost:3000/api/mcp',
      }),
    ).rejects.toThrow(/persona/i);
  });
})
