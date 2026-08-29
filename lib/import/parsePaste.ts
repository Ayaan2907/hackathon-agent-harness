import { contentText } from './contentText';
import type { TranscriptMessage } from './types';

/**
 * Normalises whatever was on the clipboard into a transcript.
 *
 * Three shapes, tried in order: a JSON dump, markdown with role headings, and
 * — when neither fits — the paste itself as one turn. That last branch is the
 * point of the function: a paste is user-supplied and unpredictable, so the
 * guarantee is that nothing is silently dropped, not that every format is
 * understood.
 *
 * The heuristics are allowed to be wrong. A prose line reading `System: down`
 * becomes a turn boundary, which is untidy and harmless — the text still
 * reaches the seed, and the seed quotes all of it as data either way.
 */

const ROLES = /^(user|human|assistant|claude|system|tool)\s*(?::\s*(.*))?$/i;

/** What people call the same two speakers. */
const ALIAS: Record<string, string> = { human: 'user', claude: 'assistant' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Recognises `## User`, `**Assistant:**`, `Human: hi` — one marker per line. */
function roleLine(line: string): { role: string; rest: string } | undefined {
  const bare = line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*/g, '')
    .trim();

  const match = ROLES.exec(bare);
  const role = match?.[1]?.toLowerCase();
  if (!role) return undefined;

  return { role: ALIAS[role] ?? role, rest: (match?.[2] ?? '').trim() };
}

function fromJson(text: string): TranscriptMessage[] | undefined {
  if (!/^[[{]/.test(text)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }

  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.messages)
      ? parsed.messages
      : undefined;
  if (!list) return undefined;

  const messages = list.flatMap((entry): TranscriptMessage[] => {
    if (!isRecord(entry)) return [];
    const text = contentText(entry.content);
    if (!text) return [];
    const role = typeof entry.role === 'string' ? entry.role.toLowerCase() : 'transcript';
    return [{ role: ALIAS[role] ?? role, text }];
  });

  // Recognised as JSON but empty of prose — fall through so the raw text is
  // still carried rather than importing nothing.
  return messages.length ? messages : undefined;
}

function fromMarkdown(text: string): TranscriptMessage[] | undefined {
  const messages: TranscriptMessage[] = [];
  const preamble: string[] = [];
  let current: TranscriptMessage | undefined;

  for (const line of text.split('\n')) {
    const hit = roleLine(line);
    if (hit) {
      current = { role: hit.role, text: hit.rest };
      messages.push(current);
    } else if (current) {
      current.text += `\n${line}`;
    } else {
      preamble.push(line);
    }
  }

  if (messages.length === 0) return undefined;

  const turns = messages
    .map((m) => ({ role: m.role, text: m.text.trim() }))
    .filter((m) => m.text.length > 0);

  // Anything before the first role marker is still conversation content.
  const intro = preamble.join('\n').trim();
  return intro ? [{ role: 'transcript', text: intro }, ...turns] : turns;
}

export function parsePaste(text: string): TranscriptMessage[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  return fromJson(trimmed) ?? fromMarkdown(trimmed) ?? [{ role: 'transcript', text: trimmed }];
}
