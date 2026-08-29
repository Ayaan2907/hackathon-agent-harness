/**
 * One turn of an imported conversation, after normalisation.
 *
 * `role` is deliberately a plain string rather than a union: a dump can name
 * its speakers anything, and the role is only ever rendered as a label inside
 * quoted text. Nothing branches on it.
 */
export interface TranscriptMessage {
  role: string;
  text: string;
}

/**
 * A transcript collapsed into the one thing TrueForge can seed a session with.
 *
 * `InitialUserMessage` accepts exactly `{ type: 'user.message', content }` —
 * there is no assistant role, verified against `/api/v1/openapi.json` on
 * v0.1.4. So an imported conversation cannot be replayed as history. It becomes
 * a single quoted user message, which makes import a summarisation feature
 * rather than a continuation one.
 *
 * The message goes on the *agent spec* (`AgentSpec.messages`), not on the
 * session create body, which takes only `{ agent }`.
 */
export interface Seed {
  message: { type: 'user.message'; content: string };
  /** How many transcript turns went in, before any truncation. */
  messageCount: number;
  /** True when the cap dropped the older end of the conversation. */
  truncated: boolean;
}
