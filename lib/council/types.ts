/** How a council answer is allowed to reason. */
export type Scope = 'repo' | 'plan';

/** A reviewer voice. Packs live in `profiles/<id>/` as SKILL.md + profile.yaml. */
export interface Persona {
  id: string;
  name: string;
  /** One line, shown under the chip. What this voice is for. */
  stance: string;
  /** `fixture` ships with the repo; `built` was grown from a public source. */
  origin: 'fixture' | 'built';
}

/** Lifecycle of an async persona build. Mirrors the job rail in the UI. */
export type JobState = 'pending' | 'scraping' | 'packing' | 'ready' | 'failed';

export interface Job {
  id: string;
  /** The public URL the persona is being grown from. */
  source: string;
  state: JobState;
  /** Present only when `state` is `failed`. */
  error?: string;
}
