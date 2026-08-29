import { describe, expect, it } from 'vitest';
import { isTerminal, jobStateLabel } from './jobState';
import type { Job } from './types';

function job(overrides: Partial<Job>): Job {
  return { id: 'j1', source: 'https://example.com/a', state: 'pending', ...overrides };
}

describe('jobStateLabel', () => {
  it('labels each in-flight state', () => {
    expect(jobStateLabel(job({ state: 'pending' }))).toBe('queued');
    expect(jobStateLabel(job({ state: 'scraping' }))).toBe('reading public sources');
    expect(jobStateLabel(job({ state: 'packing' }))).toBe('writing the pack');
    expect(jobStateLabel(job({ state: 'ready' }))).toBe('ready');
  });

  it('surfaces the error on a failed job', () => {
    expect(jobStateLabel(job({ state: 'failed', error: 'source returned 403' }))).toBe(
      'failed — source returned 403',
    );
  });

  it('names the fallback when a failed job has no error', () => {
    expect(jobStateLabel(job({ state: 'failed' }))).toBe('failed — using fixture personas');
  });
});

describe('isTerminal', () => {
  it('treats ready and failed as terminal', () => {
    expect(isTerminal('ready')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
  });

  it('treats in-flight states as non-terminal', () => {
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('scraping')).toBe(false);
    expect(isTerminal('packing')).toBe(false);
  });
});
