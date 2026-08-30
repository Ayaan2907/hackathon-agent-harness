import { contentText } from './contentText';
import type { TranscriptMessage } from './types';

/**
 * Flattens a Claude Code session log into a readable transcript.
 *
 * The files live at `~/.claude/projects/<path-slug>/<session-uuid>.jsonl`, one
 * JSON record per line. Only `user` and `assistant` records carry conversation;
 * `attachment`, `system`, `mode`, `last-prompt`, `bridge-session`,
 * `queue-operation` and friends are bookkeeping. Unknown types are ignored
 * rather than guessed at, so a new record type in a future release adds noise
 * to the file and nothing to the transcript.
 *
 * Three things are deliberately left out of a turn:
 *
 *  - `isMeta` records, which are context the tool injected, not something the
 *    operator typed.
 *  - `isSidechain` records, which are a subagent's own conversation.
 *  - every content block that is not `text` — thinking, tool calls, tool
 *    results, images. In a real session those outnumber the prose several to
 *    one and would eat the entire seed budget.
 *
 * A line that does not parse is skipped, not fatal. The file is appended while
 * the session runs, so its last line is routinely a partial write.
 */
export function parseClaudeCode(jsonl: string): TranscriptMessage[] {
  const transcript: TranscriptMessage[] = [];

  for (const line of jsonl.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let record: unknown;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (typeof record !== 'object' || record === null) continue;
    const entry = record as Record<string, unknown>;

    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    if (entry.isMeta || entry.isSidechain) continue;

    const message = entry.message;
    if (typeof message !== 'object' || message === null) continue;

    const text = contentText((message as { content?: unknown }).content);
    if (!text) continue;

    const role = (message as { role?: unknown }).role;
    transcript.push({ role: typeof role === 'string' ? role : entry.type, text });
  }

  return transcript;
}
