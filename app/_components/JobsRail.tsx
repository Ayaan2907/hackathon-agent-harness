'use client';

import { jobStateLabel } from '@/lib/council/job-state';
import type { Job } from '@/lib/council/types';

/**
 * Quiet rail for async persona builds. It never blocks the council. A job that
 * fails leaves the fixture personas in place.
 */
export function JobsRail({ jobs }: { jobs: Job[] }) {
  return (
    <div>
      <h2 className="text-ink-muted mb-3 font-mono text-xs tracking-wide uppercase">Jobs</h2>

      {jobs.length === 0 ? (
        <p className="text-ink-faint text-xs leading-relaxed">
          No persona builds running. Point one at a public URL and it grows in the background.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id} className="border-line border-b pb-3 last:border-0">
              <p className="text-ink truncate text-xs" title={job.source}>
                {job.source}
              </p>
              <p className="text-ink-faint mt-1 font-mono text-[10px]">{jobStateLabel(job)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
