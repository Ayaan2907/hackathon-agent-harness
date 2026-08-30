import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClaudeCode } from './parseClaudeCode';

/**
 * The fixture mirrors the record shapes of a real
 * `~/.claude/projects/<slug>/<uuid>.jsonl` — every `type` seen in one, the two
 * `message.content` shapes, and all four content-block kinds — with invented
 * content. Nothing here is read from a real session at test time.
 *
 * Its last line is deliberately half-written. These files are appended while a
 * session runs, so reading one mid-write is the normal case, not the edge case.
 */

const session = readFileSync(
  new URL('./__fixtures__/claude-code-session.jsonl', import.meta.url),
  'utf8',
);

describe('parseClaudeCode', () => {
  it('reads the conversation in order, prose only', () => {
    expect(parseClaudeCode(session)).toEqual([
      { role: 'user', text: 'Why does the cart total drop to zero after a refresh?' },
      {
        role: 'assistant',
        text: 'The total is recomputed from an empty basket before hydration finishes.',
      },
      { role: 'user', text: 'Fix it and add a test.' },
      {
        role: 'assistant',
        text: 'Done. The basket is read after hydration now, and the refresh path has a test.',
      },
    ]);
  });

  it('survives a truncated final line and keeps everything before it', () => {
    const lines = session.trimEnd().split('\n');
    const lastLine = lines[lines.length - 1] ?? '';

    // Guard the fixture itself: this test is worthless if that line parses.
    expect(() => JSON.parse(lastLine)).toThrow();
    expect(parseClaudeCode(session)).toHaveLength(4);
  });

  it('ignores record types that are not conversation', () => {
    const noise = parseClaudeCode(
      [
        '{"type":"mode","mode":"plan"}',
        '{"type":"bridge-session","bridgeSessionId":"x"}',
        '{"type":"queue-operation","content":"queued text"}',
        '{"type":"last-prompt","lastPrompt":"queued text"}',
        '{"type":"attachment","attachment":{"path":"a.ts"}}',
        '{"type":"something-added-next-release","message":{"role":"user","content":"hi"}}',
      ].join('\n'),
    );

    expect(noise).toEqual([]);
  });

  it('drops thinking, tool calls, tool results and images', () => {
    const text = parseClaudeCode(session)
      .map((m) => m.text)
      .join('\n');

    expect(text).not.toContain('Private reasoning');
    expect(text).not.toContain('items.reduce');
    expect(text).not.toContain('iVBORw0KGgo');
  });

  it('skips injected meta turns and subagent sidechains', () => {
    const text = parseClaudeCode(session)
      .map((m) => m.text)
      .join('\n');

    expect(text).not.toContain('never typed');
    expect(text).not.toContain('Subagent chatter');
  });

  it('returns nothing for an empty file', () => {
    expect(parseClaudeCode('')).toEqual([]);
    expect(parseClaudeCode('\n\n  \n')).toEqual([]);
  });

  it('returns nothing rather than throwing when no line parses', () => {
    expect(parseClaudeCode('not json at all\n{"half":')).toEqual([]);
  });
});
