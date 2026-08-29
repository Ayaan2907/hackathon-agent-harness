import type { Job, Persona } from './types';

/**
 * Personas that ship with the repo so the council is never empty — including
 * when a persona build job fails. Real packs live in `profiles/<id>/`.
 */
export const FIXTURE_PERSONAS: Persona[] = [
  {
    id: 'hostile',
    name: 'Hostile Reviewer',
    stance: 'Assumes the change is wrong until the diff proves otherwise.',
    origin: 'fixture',
  },
  {
    id: 'shipper',
    name: 'Shipper',
    stance: 'Asks what can be cut to land this today.',
    origin: 'fixture',
  },
];

export const FIXTURE_JOBS: Job[] = [];
