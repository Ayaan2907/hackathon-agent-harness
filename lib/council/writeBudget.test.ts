import { beforeEach, describe, expect, it } from 'vitest';
import { consumeWrite, grantWrite, outstandingWrites, resetWriteBudget } from './writeBudget';

/**
 * Seam: the rule that a ledger write must be paid for by a human approval.
 *
 * Qodo's point on PR #9 was that the shared secret authenticates *the harness*
 * but does not prove the approval gate ran — so possession of the secret alone
 * would authorise a write. MCP `tools/call` carries no `tool_call_id`, so a
 * write cannot be bound to the specific call that was approved. What can be
 * enforced is the weaker, still meaningful invariant: every write consumes an
 * approval a human actually granted.
 */

beforeEach(resetWriteBudget);

describe('write budget', () => {
  it('refuses a write when nothing was approved', () => {
    expect(consumeWrite()).toBe(false);
  });

  it('allows exactly one write per approval', () => {
    grantWrite();

    expect(consumeWrite()).toBe(true);
    expect(consumeWrite()).toBe(false);
  });

  it('does not let one approval fund repeated writes', () => {
    grantWrite();
    consumeWrite();

    expect(consumeWrite()).toBe(false);
    expect(consumeWrite()).toBe(false);
  });

  it('accumulates when several calls are approved at once', () => {
    grantWrite();
    grantWrite();

    expect(consumeWrite()).toBe(true);
    expect(consumeWrite()).toBe(true);
    expect(consumeWrite()).toBe(false);
  });

  it('reports what is outstanding', () => {
    expect(outstandingWrites()).toBe(0);
    grantWrite();
    expect(outstandingWrites()).toBe(1);
    consumeWrite();
    expect(outstandingWrites()).toBe(0);
  });

  it('never goes negative when a write is refused', () => {
    consumeWrite();

    expect(outstandingWrites()).toBe(0);
  });
});
