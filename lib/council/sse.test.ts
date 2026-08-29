import { describe, expect, it } from 'vitest';
import { parseFrames } from './sse';

/**
 * Seam: bytes off the wire to parsed events.
 *
 * Qodo flagged the inline version for recognising only `\n\n` and only the
 * first `data:` line. A dropped frame is not a cosmetic bug — losing
 * `tool.approval_required` means the approval never appears and the write can
 * never be authorised, and losing `turn.done` leaves the console busy forever.
 */

describe('parseFrames', () => {
  it('parses a single LF-delimited frame', () => {
    const { events, rest } = parseFrames('data: {"type":"turn.done"}\n\n');

    expect(events).toEqual([{ type: 'turn.done' }]);
    expect(rest).toBe('');
  });

  it('parses CRLF-delimited frames', () => {
    const { events } = parseFrames('data: {"type":"turn.done"}\r\n\r\n');

    expect(events).toEqual([{ type: 'turn.done' }]);
  });

  it('concatenates multiple data lines in one frame', () => {
    // SSE splits long payloads across data lines; joined with newline per spec.
    const { events } = parseFrames('data: {"type":\ndata: "turn.done"}\n\n');

    expect(events).toEqual([{ type: 'turn.done' }]);
  });

  it('accepts data lines with no space after the colon', () => {
    const { events } = parseFrames('data:{"type":"turn.done"}\n\n');

    expect(events).toEqual([{ type: 'turn.done' }]);
  });

  it('keeps a partial trailing frame as rest', () => {
    const chunk = 'data: {"type":"a"}\n\ndata: {"type":"b"';
    const { events, rest } = parseFrames(chunk);

    expect(events).toEqual([{ type: 'a' }]);
    expect(rest).toBe('data: {"type":"b"');
  });

  it('reassembles a frame split across two chunks', () => {
    const first = parseFrames('data: {"ty');
    const second = parseFrames(first.rest + 'pe":"turn.done"}\n\n');

    expect(first.events).toEqual([]);
    expect(second.events).toEqual([{ type: 'turn.done' }]);
  });

  it('ignores id and comment lines', () => {
    const { events } = parseFrames(': keep-alive\nid: 7\ndata: {"type":"a"}\n\n');

    expect(events).toEqual([{ type: 'a' }]);
  });

  it('skips a frame whose payload is not valid JSON without losing later frames', () => {
    const { events } = parseFrames('data: not json\n\ndata: {"type":"a"}\n\n');

    expect(events).toEqual([{ type: 'a' }]);
  });
});
