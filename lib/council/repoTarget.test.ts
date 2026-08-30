import { describe, expect, it } from 'vitest';
import { toCloneUrl } from './repoTarget';

/**
 * Seam: which repository "This repo" actually clones.
 *
 * It was hard-coded to this project's own GitHub URL, so the control labelled
 * "This repo" cloned *our* repo for every user — the product's central claim,
 * that the council reads your codebase, was false for everyone but its author.
 *
 * The sandbox has no credentials, so an SSH remote cannot be cloned there; it
 * has to be rewritten to HTTPS or the turn fails inside the sandbox where the
 * user cannot see why.
 */

describe('toCloneUrl', () => {
  it('passes an https remote through', () => {
    expect(toCloneUrl('https://github.com/acme/widgets.git')).toBe(
      'https://github.com/acme/widgets.git',
    );
  });

  it('rewrites an scp-style ssh remote, which the sandbox cannot authenticate', () => {
    expect(toCloneUrl('git@github.com:acme/widgets.git')).toBe(
      'https://github.com/acme/widgets.git',
    );
  });

  it('rewrites an ssh:// remote', () => {
    expect(toCloneUrl('ssh://git@gitlab.com/acme/widgets.git')).toBe(
      'https://gitlab.com/acme/widgets.git',
    );
  });

  it('keeps a host other than github', () => {
    expect(toCloneUrl('git@gitlab.com:team/thing.git')).toBe('https://gitlab.com/team/thing.git');
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['/Users/me/code/thing', 'a local path with no host'],
    ['not a url', 'nonsense'],
  ])('returns null for %s (%s)', (raw) => {
    // Better to tell the user repo scope has no target than to hand the
    // sandbox something that fails halfway through a clone.
    expect(toCloneUrl(raw)).toBeNull();
  });

  it('refuses a url carrying credentials rather than leaking them into a prompt', () => {
    expect(toCloneUrl('https://user:token@github.com/acme/widgets.git')).toBeNull();
  });
})
