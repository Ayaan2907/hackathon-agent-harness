import { z } from 'zod';

/**
 * Where each session window sits on the canvas. This is the layout the browser
 * remembers between visits; the window's contents are not part of it.
 */
export interface SessionWindow {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The slice of `localStorage` this module needs, so it can be tested in Node. */
export type LayoutStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const LAYOUT_KEY = 'outside:canvas:layout';

const layoutSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    // A zero or negative box goes straight into canvas geometry on restore —
    // the interactive minimum-size clamp only runs while dragging.
    w: z.number().positive(),
    h: z.number().positive(),
  }),
);

export function addWindow(windows: SessionWindow[], added: SessionWindow): SessionWindow[] {
  return [...windows, added];
}

/**
 * Records a window's new box. Returns the array unchanged when nothing moved,
 * which is what stops the canvas and the layout from echoing edits at each
 * other: an update that changes nothing produces no new state.
 */
export function placeWindow(
  windows: SessionWindow[],
  id: string,
  box: { x: number; y: number; w: number; h: number },
): SessionWindow[] {
  const current = windows.find((w) => w.id === id);
  if (!current) return windows;
  if (current.x === box.x && current.y === box.y && current.w === box.w && current.h === box.h) {
    return windows;
  }
  return windows.map((w) => (w.id === id ? { ...w, ...box } : w));
}

export function removeWindow(windows: SessionWindow[], id: string): SessionWindow[] {
  if (!windows.some((w) => w.id === id)) return windows;
  return windows.filter((w) => w.id !== id);
}

/**
 * Persists the layout, and treats failure as acceptable.
 *
 * This is called from a React effect on every layout change, so a throw from
 * quota exhaustion, private browsing, or storage disabled by policy would take
 * the canvas down. Losing a layout save is the smaller loss.
 */
export function saveWindows(storage: LayoutStorage, windows: SessionWindow[]): void {
  try {
    storage.setItem(LAYOUT_KEY, JSON.stringify(windows));
  } catch {
    // Layout is a convenience, not data worth crashing over.
  }
}

/**
 * Reads the saved layout. Anything unreadable — no value, bad JSON, an old
 * shape, storage disabled by the browser — starts you on an empty canvas rather
 * than a crashed one.
 */
export function loadWindows(storage: LayoutStorage): SessionWindow[] {
  let raw: string | null;
  try {
    raw = storage.getItem(LAYOUT_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = layoutSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];

    // Two entries sharing an id collapse to one canvas shape, which then
    // matches both — leaving focus permanently ambiguous with no way for the
    // user to resolve it. First entry wins.
    const byId = new Map<string, SessionWindow>();
    for (const window of parsed.data) {
      if (!byId.has(window.id)) byId.set(window.id, window);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}
