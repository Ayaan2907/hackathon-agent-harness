import { describe, expect, it } from 'vitest';
import {
  addWindow,
  loadWindows,
  placeWindow,
  removeWindow,
  saveWindows,
  type LayoutStorage,
  type SessionWindow,
} from './layout';

const A: SessionWindow = { id: 'a', title: 'One', x: 0, y: 0, w: 320, h: 220 };
const B: SessionWindow = { id: 'b', title: 'Two', x: 400, y: 0, w: 320, h: 220 };

function fakeStorage(seed?: Record<string, string>): LayoutStorage {
  const map = new Map(Object.entries(seed ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe('addWindow', () => {
  it('appends to an empty layout', () => {
    expect(addWindow([], A)).toEqual([A]);
  });

  it('keeps the windows already placed', () => {
    expect(addWindow([A], B)).toEqual([A, B]);
  });
});

describe('placeWindow', () => {
  it('moves and resizes the named window only', () => {
    const next = placeWindow([A, B], 'a', { x: 10, y: 20, w: 500, h: 300 });
    expect(next).toEqual([{ id: 'a', title: 'One', x: 10, y: 20, w: 500, h: 300 }, B]);
  });

  it('returns the same array when the box is unchanged', () => {
    const before = [A, B];
    expect(placeWindow(before, 'a', { x: A.x, y: A.y, w: A.w, h: A.h })).toBe(before);
  });

  it('returns the same array for an unknown id', () => {
    const before = [A];
    expect(placeWindow(before, 'gone', { x: 1, y: 2, w: 3, h: 4 })).toBe(before);
  });
});

describe('removeWindow', () => {
  it('drops the named window', () => {
    expect(removeWindow([A, B], 'a')).toEqual([B]);
  });

  it('returns the same array when the id is not present', () => {
    const before = [A];
    expect(removeWindow(before, 'gone')).toBe(before);
  });
});

describe('saveWindows and loadWindows', () => {
  it('round-trips a layout', () => {
    const storage = fakeStorage();
    saveWindows(storage, [A, B]);
    expect(loadWindows(storage)).toEqual([A, B]);
  });

  it('returns an empty layout when nothing was ever saved', () => {
    expect(loadWindows(fakeStorage())).toEqual([]);
  });

  it('returns an empty layout when the stored value is not JSON', () => {
    expect(loadWindows(fakeStorage({ 'outside:canvas:layout': '{not json' }))).toEqual([]);
  });

  it('returns an empty layout when the stored value is the wrong shape', () => {
    const stored = JSON.stringify([{ id: 'a', title: 'One', x: 'left' }]);
    expect(loadWindows(fakeStorage({ 'outside:canvas:layout': stored }))).toEqual([]);
  });

  it('returns an empty layout when storage itself throws', () => {
    const storage: LayoutStorage = {
      getItem: () => {
        throw new Error('storage is disabled');
      },
      setItem: () => {},
    };
    expect(loadWindows(storage)).toEqual([]);
  });
});

describe('layout persistence hardening', () => {
  it('drops duplicate ids, which would make focus permanently ambiguous', () => {
    // The canvas collapses shapes by id, so two entries sharing one id resolve
    // to a single shape that matches both — and the command bar reports
    // "ambiguous" forever with no way for the user to fix it.
    const stored = JSON.stringify([
      { id: 'w1', title: 'One', x: 0, y: 0, w: 320, h: 240 },
      { id: 'w1', title: 'Duplicate', x: 40, y: 40, w: 320, h: 240 },
      { id: 'w2', title: 'Two', x: 80, y: 0, w: 320, h: 240 },
    ]);

    const windows = loadWindows({ getItem: () => stored, setItem: () => {} });

    expect(windows.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(windows[0]?.title).toBe('One');
  });

  it.each([
    ['zero width', { w: 0, h: 240 }],
    ['negative width', { w: -320, h: 240 }],
    ['zero height', { w: 320, h: 0 }],
    ['negative height', { w: 320, h: -240 }],
  ])('rejects a stored window with %s', (_label, size) => {
    // The interactive clamp does not run on restore, so a bad box would go
    // straight into canvas geometry.
    const stored = JSON.stringify([{ id: 'w1', title: 'One', x: 0, y: 0, ...size }]);

    expect(loadWindows({ getItem: () => stored, setItem: () => {} })).toEqual([]);
  });

  it('does not throw when storage refuses the write', () => {
    // Quota exceeded, Safari private mode, storage disabled by policy. This
    // runs inside a React effect, so an escaping exception takes the canvas
    // down rather than losing a layout save.
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
    };

    expect(() => saveWindows(storage, [{ id: 'w1', title: 'One', x: 0, y: 0, w: 320, h: 240 }]))
      .not.toThrow();
  });
});
