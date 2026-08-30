import { describe, expect, it } from 'vitest';
import { parseSessionId } from './sessionId';

/**
 * Seam: the only thing standing between a caller-supplied string and a
 * credentialed upstream URL.
 *
 * The id is interpolated into `/sessions/{id}/events` on a request that carries
 * our harness credential. An id containing `../` walks out of that path and can
 * reach any other harness endpoint — `/settings/model-providers` holds provider
 * API keys. A query or fragment character truncates the intended path instead.
 */

describe('parseSessionId', () => {
  it('accepts a real harness id', () => {
    expect(parseSessionId('01m17v7rp9c5c1djna9yh92tx9')).toBe('01m17v7rp9c5c1djna9yh92tx9');
  });

  it('accepts the .local suffix the harness uses on turn ids', () => {
    expect(parseSessionId('01m17v7rp9c5c1djna9yh92tx9.local')).not.toBeNull();
  });

  it.each([
    ['../../settings/model-providers', 'walks to provider credentials'],
    ['..', 'bare parent'],
    ['a/b', 'path separator'],
    ['id?limit=1', 'query truncation'],
    ['id#frag', 'fragment truncation'],
    ['%2e%2e%2fsettings', 'encoded traversal'],
    ['id with space', 'whitespace'],
    ['', 'empty'],
  ])('rejects %s (%s)', (bad) => {
    expect(parseSessionId(bad)).toBeNull();
  });

  it('rejects an absurdly long id rather than forwarding it', () => {
    expect(parseSessionId('a'.repeat(200))).toBeNull();
  });
});
