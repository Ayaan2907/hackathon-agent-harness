/**
 * Reduces a message body to the text a human would read.
 *
 * Both paste and Claude Code dumps carry either a plain string or an array of
 * typed content blocks. Only `text` blocks survive: `thinking`, `tool_use`,
 * `tool_result` and `image` are dropped on purpose. In a real session those
 * outnumber the prose several to one, and the seed has a few thousand
 * characters to spend — spending them on tool payloads would leave no room for
 * the conversation itself.
 */
export function contentText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((block) =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'text' &&
      typeof (block as { text?: unknown }).text === 'string'
        ? (block as { text: string }).text
        : '',
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}
