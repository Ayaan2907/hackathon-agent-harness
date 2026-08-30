import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '@/lib/config/env';
import { toCloneUrl } from './repoTarget';

/**
 * Works out what "This repo" means for this deployment.
 *
 * Configuration wins; otherwise the checkout the app is running in. Resolved
 * once per process because it cannot change without a restart.
 */
const run = promisify(execFile);

let cached: string | null | undefined;

export async function resolveRepoUrl(): Promise<string | null> {
  if (cached !== undefined) return cached;

  if (env.COUNCIL_REPO_URL) {
    cached = toCloneUrl(env.COUNCIL_REPO_URL);
    return cached;
  }

  try {
    const { stdout } = await run('git', ['config', '--get', 'remote.origin.url'], {
      cwd: process.cwd(),
      timeout: 2000,
    });
    cached = toCloneUrl(stdout);
  } catch {
    // No git, no remote, or not a checkout. Repo scope will say so.
    cached = null;
  }
  return cached;
}
