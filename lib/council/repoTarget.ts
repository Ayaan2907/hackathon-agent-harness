/**
 * Which repository repo scope clones into the sandbox.
 *
 * This used to be a constant pointing at this project's own GitHub URL, which
 * meant the control labelled "This repo" cloned the wrong repository for every
 * user but its author — the product's central claim, quietly false.
 *
 * The sandbox holds no git credentials, so an SSH remote cannot be cloned there.
 * Rewriting to HTTPS is the difference between working and failing inside a
 * sandbox where the user never sees the error.
 */

/** `git@host:owner/name.git` — the scp-style form git prints by default. */
const SCP_STYLE = /^[A-Za-z0-9._-]+@([A-Za-z0-9.-]+):(.+)$/;

export function toCloneUrl(remote: string): string | null {
  const raw = remote.trim();
  if (!raw) return null;

  const scp = SCP_STYLE.exec(raw);
  if (scp) return `https://${scp[1]}/${scp[2]}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // Credentials in a remote would end up inside the agent's instructions, and
  // from there in the transcript and anything built from it. `git@` on an ssh
  // remote is a conventional username, not a secret.
  if (url.password) return null;
  if (url.username && !(url.protocol === 'ssh:' && url.username === 'git')) return null;

  if (url.protocol === 'https:') return url.toString();
  if (url.protocol === 'ssh:') return `https://${url.host}${url.pathname}`;

  return null;
}
