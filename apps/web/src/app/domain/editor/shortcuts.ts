import type { EditorTool } from './tools';

/** Editor keyboard shortcuts, listed in the editor sidebar and on the Help page. */
export const SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: 'Ctrl/⌘ Z', action: 'Undo' },
  { keys: 'Ctrl/⌘ Shift Z, Ctrl Y', action: 'Redo' },
  { keys: 'Ctrl/⌘ S', action: 'Save' },
  { keys: 'B / E / G / I / T', action: 'Paint, Erase, Fill, Pick, Text' },
  { keys: 'L / R / O', action: 'Line, Box, Oval' },
  { keys: 'H', action: 'Highlight the selected color' },
  { keys: 'K', action: 'Toggle stitching mode' },
  { keys: '+ / −', action: 'Zoom in / out' },
  { keys: 'Esc', action: 'Clear highlight' },
];

export type EditorAction =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'save' }
  | { type: 'tool'; tool: EditorTool }
  | { type: 'toggle-highlight' }
  | { type: 'toggle-stitch-mode' }
  | { type: 'zoom'; direction: 1 | -1 }
  | { type: 'clear-highlight' };

/** The parts of a KeyboardEvent the resolver looks at (keeps it testable without the DOM). */
export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const TOOL_KEYS: Readonly<Record<string, EditorTool>> = {
  b: 'paint',
  e: 'erase',
  g: 'fill',
  i: 'pick',
  t: 'text',
  l: 'line',
  r: 'rect',
  o: 'ellipse',
};

/**
 * Maps a key press to an editor action, or null if it isn't a shortcut (so
 * the browser keeps its default). Ctrl and ⌘ are treated alike; Alt
 * combinations are left alone for OS and browser shortcuts.
 */
export function resolveShortcut(press: KeyPress): EditorAction | null {
  const key = press.key.toLowerCase();
  if (press.ctrlKey || press.metaKey) {
    if (key === 'z') return press.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 's') return { type: 'save' };
    return null;
  }
  if (press.altKey) return null;
  if (TOOL_KEYS[key]) return { type: 'tool', tool: TOOL_KEYS[key] };
  switch (key) {
    case 'h':
      return { type: 'toggle-highlight' };
    case 'k':
      return { type: 'toggle-stitch-mode' };
    case '+':
    case '=':
      return { type: 'zoom', direction: 1 };
    case '-':
    case '_':
      return { type: 'zoom', direction: -1 };
    case 'escape':
      return { type: 'clear-highlight' };
    default:
      return null;
  }
}
