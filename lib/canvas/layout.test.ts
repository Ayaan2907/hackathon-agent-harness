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
