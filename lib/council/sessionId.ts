/**
 * Bounds a caller-supplied session id before it becomes part of a credentialed
 * upstream URL.
 *
 * The id is interpolated into `/sessions/{id}/events` on a request carrying our
 * harness credential, so anything that can leave that path is a way to read
 * other harness endpoints — `/settings/model-providers` holds provider API
 * keys. An allowlist is the only version of this that is easy to be sure about:
 * harness ids are ULIDs, sometimes with a `.local` suffix.
 */
const SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function parseSessionId(raw: string): string | null {
  if (!SHAPE.test(raw)) return null;
  // `..` passes the shape test but is still a traversal segment.
  if (raw.split('.').some((segment) => segment === '')) return null;
  if (raw === '..' || raw.includes('..')) return null;
  return raw;
}
