import type { SessionWindow } from './layout';

/**
 * Which window the command bar will type into. `none` carries a reason so the
 * bar can say why it has no target instead of silently doing nothing.
 */
export type Focus =
  | { status: 'targeted'; id: string; title: string }
  | { status: 'none'; reason: 'no-windows' | 'ambiguous' };

/**
 * A question goes to exactly one window, so the rule has to be unambiguous:
 * one selected window wins; several selected is a question the user has to
 * answer; with nothing selected we fall back to the last window focused, then
 * to the only window on the canvas.
 */
export function resolveFocus(
  windows: SessionWindow[],
  selectedIds: string[],
  lastFocusedId: string | null,
): Focus {
  if (windows.length === 0) return { status: 'none', reason: 'no-windows' };

  const selected = windows.filter((w) => selectedIds.includes(w.id));
  if (selected.length > 1) return { status: 'none', reason: 'ambiguous' };
  if (selected[0]) return target(selected[0]);

  const lastFocused = windows.find((w) => w.id === lastFocusedId);
  if (lastFocused) return target(lastFocused);

  if (windows.length === 1 && windows[0]) return target(windows[0]);
  return { status: 'none', reason: 'ambiguous' };
}

function target(window: SessionWindow): Focus {
  return { status: 'targeted', id: window.id, title: window.title };
}
