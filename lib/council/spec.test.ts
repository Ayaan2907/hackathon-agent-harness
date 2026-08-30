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
    expect(spec.mcp_servers).toContainEqual(
      expect.objectContaining({
        name: 'outside-ledger',
        require_approval_for_tools: ['record_decision'],
      }),
    );
  });

  it('gives repo scope read-only web research and no new approval surface', async () => {
    // webSearch is opt-in now: an unconfigured MCP server 422s session creation.
    const spec = await buildCouncilSpec({ ...base, scope: 'repo', webSearch: true });

    // `@read-only` is the enable selector, so only tools the server annotates
    // read-only are reachable at all — today that is all five Bright Data
    // tools. `require_approval_for_tools` is left at the harness default of
    // `["@write", "@destructive"]`, which currently matches nothing here: the
    // council gains sources, not a second thing to approve. The default is
    // still what stops a write tool added later from arriving ungated.
    expect(spec.mcp_servers).toContainEqual({ name: 'bright-data', enable_tools: ['@read-only'] });
  });

  it('gives plan-only scope no sandbox and no write tools at all', async () => {
    const spec = await buildCouncilSpec({ ...base, scope: 'plan' });

    // Not "no ledger" — no MCP servers of any kind, Bright Data included. A
    // plan-only answer cannot read a file, reach the web, or write anywhere.
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
      buildCouncilSpec({
        scope: 'plan',
        personaIds: [id],
        mcpUrl: 'http://localhost:3000/api/mcp',
      }),
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
});

describe('model params and optional web search', () => {
  it('asks for reasoning effort, never temperature', async () => {
    // Every model in the harness catalog is a reasoning model, and the provider
    // rejects temperature on those: "temperature is not supported for
    // reasoning models". It was being silently stripped on every single turn.
    const spec = await buildCouncilSpec({ ...base, scope: 'plan' });

    expect(spec.model.params).not.toHaveProperty('temperature');
    expect(spec.model.params.reasoning_effort).toBeDefined();
  });

  it('omits Bright Data when the harness does not have it', async () => {
    // Naming an unconfigured MCP server fails session creation outright with
    // 422 Unknown MCP server, so a clone pointed at a bare harness would lose
    // repo scope entirely — and the README promises it works on a fresh clone.
    const spec = await buildCouncilSpec({ ...base, scope: 'repo', webSearch: false });

    expect(spec.mcp_servers.map((s) => s.name)).toEqual(['outside-ledger']);
  });

  it('includes Bright Data read-only when it is available', async () => {
    const spec = await buildCouncilSpec({ ...base, scope: 'repo', webSearch: true });
    const web = spec.mcp_servers.find((s) => s.name === 'bright-data');

    expect(web?.enable_tools).toEqual(['@read-only']);
  });

  it('never gives plan-only scope the web, even when it is available', async () => {
    const spec = await buildCouncilSpec({ ...base, scope: 'plan', webSearch: true });

    expect(spec.mcp_servers).toEqual([]);
    expect(spec.config.sandbox.enabled).toBe(false);
  });
});
