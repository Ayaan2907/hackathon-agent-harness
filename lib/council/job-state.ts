import type { Job, JobState } from './types';

const LABELS: Record<JobState, string> = {
  pending: 'queued',
  scraping: 'reading public sources',
  packing: 'writing the pack',
  ready: 'ready',
  failed: 'failed',
};

/**
 * One line of status for the jobs rail.
 *
 * A failed job explains itself, because the recovery path, carrying on with the
 * fixture personas, is only obvious if the user knows what broke.
 */
export function jobStateLabel(job: Job): string {
  if (job.state === 'failed') {
    return job.error ? `failed: ${job.error}` : 'failed, using fixture personas';
  }
  return LABELS[job.state];
}

/** A job is done moving when it is either usable or dead. */
export function isTerminal(state: JobState): boolean {
  return state === 'ready' || state === 'failed';
}
