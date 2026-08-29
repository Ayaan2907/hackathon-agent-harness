import { describe, expect, it } from 'vitest';
import { resolveFocus } from './focus';
import type { SessionWindow } from './layout';

const A: SessionWindow = { id: 'a', title: 'One', x: 0, y: 0, w: 320, h: 220 };
const B: SessionWindow = { id: 'b', title: 'Two', x: 400, y: 0, w: 320, h: 220 };

describe('resolveFocus', () => {
  it('targets the single selected window', () => {
    expect(resolveFocus([A, B], ['b'], null)).toEqual({
      status: 'targeted',
      id: 'b',
      title: 'Two',
    });
  });

  it('refuses to guess when several windows are selected', () => {
    expect(resolveFocus([A, B], ['a', 'b'], 'a')).toEqual({ status: 'none', reason: 'ambiguous' });
  });

  it('falls back to the last focused window when the selection is empty', () => {
    expect(resolveFocus([A, B], [], 'a')).toEqual({ status: 'targeted', id: 'a', title: 'One' });
  });

  it('ignores a selected id that no longer exists', () => {
    expect(resolveFocus([A, B], ['gone'], 'b')).toEqual({
      status: 'targeted',
      id: 'b',
      title: 'Two',
    });
  });

  it('targets the only remaining window after the focused one is removed', () => {
    expect(resolveFocus([B], [], 'a')).toEqual({ status: 'targeted', id: 'b', title: 'Two' });
  });

  it('asks for a choice when the focused window is removed and several remain', () => {
    expect(resolveFocus([A, B], [], 'gone')).toEqual({ status: 'none', reason: 'ambiguous' });
  });

  it('reports an empty canvas', () => {
    expect(resolveFocus([], [], 'a')).toEqual({ status: 'none', reason: 'no-windows' });
  });
});
