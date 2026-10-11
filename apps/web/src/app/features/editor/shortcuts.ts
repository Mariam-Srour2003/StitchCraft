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
