import { describe, expect, it } from 'vitest';
import { fromAgent, parsePack, toAgentBody } from './personas';

/**
 * The mapping is the seam worth testing: a pack on disk becomes the body
 * `POST /api/v1/agents` expects, and a saved agent becomes the persona the
 * console lists. Everything else in that file is network.
 */

const profileYaml = `id: hostile
name: Hostile Reviewer
stance: Assumes the change is wrong until the diff proves otherwise.
origin: fixture
source: null
`;

const brief = '# Hostile Reviewer\n\nYou believe the change in front of you is wrong.\n';

const hostile = {
  id: 'hostile',
  name: 'Hostile Reviewer',
  stance: 'Assumes the change is wrong until the diff proves otherwise.',
  origin: 'fixture',
} as const;

describe('parsePack', () => {
  it('reads the persona out of a profile.yaml', () => {
    // `source: null` is a fixture saying it was grown from nothing.
    expect(parsePack(profileYaml)).toEqual(hostile);
  });

  it.each([
    ['../../etc/passwd', 'parent traversal'],
    ['..', 'bare parent'],
    ['hostile/../../secrets', 'traversal after a valid segment'],
    ['/etc/passwd', 'absolute path'],
    ['Hostile', 'uppercase, which no ResourceName allows'],
  ])('refuses the id %s (%s)', (id) => {
    // The id becomes both a filesystem path segment and an agent name.
    expect(() => parsePack(profileYaml.replace('hostile', id))).toThrow(/persona/i);
  });
});

describe('toAgentBody', () => {
  it('names the saved agent after the persona id', () => {
    // `persona-` also guarantees a legal ResourceName: it must start with a
    // letter and be at least two characters, neither of which a persona id is.
    expect(toAgentBody(hostile, brief).name).toBe('persona-hostile');
  });

  it('carries the brief as instructions under a metadata header', () => {
    const { manifest } = toAgentBody(hostile, brief);

    expect(manifest.instructions).toContain('You believe the change in front of you is wrong.');
    expect(manifest.instructions).toContain('stance: Assumes the change is wrong');
  });

  it('saves a persona as instructions, never as a skill', () => {
    // `skills` requires `config.sandbox.enabled`, so a skill-backed persona is
    // dropped silently in plan-only scope. Saving personas as agents does not
    // change that, and this is the assertion that keeps it honest.
    const { manifest } = toAgentBody(hostile, brief);

    expect(manifest).not.toHaveProperty('skills');
    expect(manifest.model.name).toContain('/');
  });

  it('refuses a field that would forge the metadata header', () => {
    // Personas also arrive as an object on `POST /api/personas`, where nothing
    // has split the fields into lines yet. A newline in `name` would inject its
    // own `origin:` line into the header this module parses back out.
    const forged = { ...hostile, name: 'Fake\norigin: built' };

    expect(() => toAgentBody(forged, brief)).toThrow(/persona/i);
  });
});

describe('fromAgent', () => {
  it('round-trips a persona through the saved agent', () => {
    expect(fromAgent(toAgentBody(parsePack(profileYaml), brief))).toEqual(hostile);
  });

  it('ignores an agent that is not a persona', () => {
    // The registry is shared with the council agent and anything a human saves
    // in the TrueForge console.
    expect(fromAgent({ name: 'outside-council', manifest: { instructions: 'You convene' } })).toBe(
      null,
    );
  });

  it('ignores a persona-named agent with no metadata header', () => {
    expect(fromAgent({ name: 'persona-hand-made', manifest: { instructions: 'no header' } })).toBe(
      null,
    );
  });
});
