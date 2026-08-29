import { describe, expect, it } from 'vitest';
import { LEDGER_SECRET, isAuthorised } from './ledgerAuth';

/**
 * Seam: the check standing between a public HTTP route and an irreversible
 * write. Qodo flagged that the new authorization branch had no test at all —
 * a regression here silently reopens the hole the branch was added to close.
 */

describe('isAuthorised', () => {
  it('accepts the configured secret', () => {
    expect(isAuthorised(LEDGER_SECRET)).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(isAuthorised(null)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isAuthorised('')).toBe(false);
  });

  it('rejects a wrong secret of the same length', () => {
    const wrong = 'x'.repeat(LEDGER_SECRET.length);
    expect(isAuthorised(wrong)).toBe(false);
  });

  it('rejects a correct prefix', () => {
    // Length mismatch must not short-circuit into a pass.
    expect(isAuthorised(LEDGER_SECRET.slice(0, -1))).toBe(false);
  });

  it('generates a secret long enough to be worth having', () => {
    expect(LEDGER_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
