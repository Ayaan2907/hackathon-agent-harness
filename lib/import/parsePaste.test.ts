import { describe, expect, it } from 'vitest';
import { parsePaste } from './parsePaste';

/**
 * A paste is whatever the user had on the clipboard. The only real invariant is
 * that nothing is silently dropped: if the shape is not recognised, the text
 * still has to arrive in the transcript verbatim.
 */

describe('parsePaste', () => {
  it('reads a JSON array of role/content messages', () => {
    const text = JSON.stringify([
      { role: 'user', content: 'Why is the build red?' },
      { role: 'assistant', content: 'A type error in the parser.' },
    ]);

    expect(parsePaste(text)).toEqual([
      { role: 'user', text: 'Why is the build red?' },
      { role: 'assistant', text: 'A type error in the parser.' },
    ]);
  });

  it('reads a { messages: [...] } wrapper', () => {
    const text = JSON.stringify({ messages: [{ role: 'user', content: 'Ship it?' }] });

    expect(parsePaste(text)).toEqual([{ role: 'user', text: 'Ship it?' }]);
  });

  it('flattens structured content blocks and drops the non-text ones', () => {
    const text = JSON.stringify([
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'private reasoning' },
          { type: 'text', text: 'The cap is 4000 characters.' },
          { type: 'tool_use', name: 'Read', input: { file: 'a.ts' } },
        ],
      },
    ]);

    expect(parsePaste(text)).toEqual([{ role: 'assistant', text: 'The cap is 4000 characters.' }]);
  });

  it('splits markdown on role headings', () => {
    const text = [
      '## User',
      '',
      'What breaks first under load?',
      '',
      '## Assistant',
      '',
      'The connection cap, at six windows.',
    ].join('\n');

    expect(parsePaste(text)).toEqual([
      { role: 'user', text: 'What breaks first under load?' },
      { role: 'assistant', text: 'The connection cap, at six windows.' },
    ]);
  });

  it('normalises human and claude to the two roles a reader expects', () => {
    const text = ['**Human:** ping', '', '**Claude:** pong'].join('\n');

    expect(parsePaste(text)).toEqual([
      { role: 'user', text: 'ping' },
      { role: 'assistant', text: 'pong' },
    ]);
  });

  it('keeps unmarked prose verbatim as a single turn', () => {
    const text = 'Just some notes.\nNo roles anywhere.';

    expect(parsePaste(text)).toEqual([{ role: 'transcript', text }]);
  });

  it('falls back to text rather than throwing on JSON that does not parse', () => {
    // A truncated copy-paste of a JSON dump: opens like JSON, is not JSON.
    const text = '[{"role":"user","content":"half a mes';

    expect(parsePaste(text)).toEqual([{ role: 'transcript', text }]);
  });

  it('drops nothing when it falls back', () => {
    const text = '# Notes\n\nuser said the thing\n\nassistant replied\n';

    const joined = parsePaste(text)
      .map((m) => m.text)
      .join('\n');

    expect(joined.replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim());
  });

  it('returns nothing for whitespace', () => {
    expect(parsePaste('   \n\n  ')).toEqual([]);
  });
});
