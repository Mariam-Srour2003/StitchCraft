import type { KeyPress } from './shortcuts';
import { resolveShortcut } from './shortcuts';

const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('resolveShortcut', () => {
  it('maps undo/redo/save with Ctrl or Cmd', () => {
    expect(resolveShortcut(press('z', { ctrlKey: true }))).toEqual({ type: 'undo' });
    expect(resolveShortcut(press('Z', { metaKey: true, shiftKey: true }))).toEqual({
      type: 'redo',
    });
    expect(resolveShortcut(press('y', { ctrlKey: true }))).toEqual({ type: 'redo' });
    expect(resolveShortcut(press('s', { metaKey: true }))).toEqual({ type: 'save' });
  });

  it('leaves other modifier combinations to the browser', () => {
    expect(resolveShortcut(press('c', { ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(press('b', { altKey: true }))).toBeNull();
  });

  it('maps single keys to tools, case-insensitively', () => {
    expect(resolveShortcut(press('G'))).toEqual({ type: 'tool', tool: 'fill' });
    expect(resolveShortcut(press('o'))).toEqual({ type: 'tool', tool: 'ellipse' });
    expect(resolveShortcut(press('j'))).toEqual({ type: 'tool', tool: 'backstitch' });
  });

  it('maps view and mode keys', () => {
    expect(resolveShortcut(press('h'))).toEqual({ type: 'toggle-highlight' });
    expect(resolveShortcut(press('k'))).toEqual({ type: 'toggle-stitch-mode' });
    expect(resolveShortcut(press('='))).toEqual({ type: 'zoom', direction: 1 });
    expect(resolveShortcut(press('-'))).toEqual({ type: 'zoom', direction: -1 });
    expect(resolveShortcut(press('Escape'))).toEqual({ type: 'clear-highlight' });
  });

  it('ignores everything else', () => {
    expect(resolveShortcut(press('q'))).toBeNull();
    expect(resolveShortcut(press('Enter'))).toBeNull();
  });
});
