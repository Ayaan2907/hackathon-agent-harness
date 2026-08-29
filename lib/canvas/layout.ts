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
    id: z.string(),
    title: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
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

export function saveWindows(storage: LayoutStorage, windows: SessionWindow[]): void {
  storage.setItem(LAYOUT_KEY, JSON.stringify(windows));
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
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
