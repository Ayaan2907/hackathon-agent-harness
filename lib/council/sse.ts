/**
 * Minimal SSE frame parser, per the WHATWG event-stream rules we actually need.
 *
 * Frames are separated by a blank line, which may use either LF or CRLF. A
 * frame can carry several `data:` lines, and the spec joins them with a
 * newline. The colon may or may not be followed by a space. Anything else —
 * `id:`, `event:`, `:` comments — we ignore.
 *
 * Dropping a frame here is not cosmetic: losing `tool.approval_required` means
 * the approval never surfaces and the gated write can never be authorised.
 */

/** Returns the events completed by this chunk, plus the incomplete tail. */
export function parseFrames(buffer: string): { events: unknown[]; rest: string } {
  // Normalise line endings first so one split handles both LF and CRLF streams.
  const normalised = buffer.replace(/\r\n/g, '\n');
  const frames = normalised.split('\n\n');
  const rest = frames.pop() ?? '';

  const events: unknown[] = [];

  for (const frame of frames) {
    const payload = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');

    if (!payload) continue;

    try {
      events.push(JSON.parse(payload));
    } catch {
      // A malformed frame is skipped; the rest of the stream still matters.
    }
  }

  return { events, rest };
}
