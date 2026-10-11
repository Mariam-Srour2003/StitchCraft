/** Every drawing tool the editor offers. */
export type EditorTool =
  | 'paint'
  | 'erase'
  | 'fill'
  | 'pick'
  | 'line'
  | 'rect'
  | 'rect-fill'
  | 'ellipse'
  | 'ellipse-fill'
  | 'text'
  /** Draw a backstitch line from corner to corner. */
  | 'backstitch'
  /** Click a backstitch line to remove it. */
  | 'backstitch-erase'
  /** Click near a cell corner to place a half stitch on that diagonal. */
  | 'half-stitch'
  /** Click a quarter of a cell to place a quarter stitch there. */
  | 'quarter-stitch';

const SHAPE_TOOLS: ReadonlySet<EditorTool> = new Set([
  'line',
  'rect',
  'rect-fill',
  'ellipse',
  'ellipse-fill',
]);

/** Shape tools anchor at the first cell of a drag and preview to the current one. */
export function isShapeTool(tool: EditorTool): boolean {
  return SHAPE_TOOLS.has(tool);
}

/** Line tools work on grid corners (backstitch), not on cells. */
export function isLineTool(tool: EditorTool): boolean {
  return tool === 'backstitch' || tool === 'backstitch-erase';
}

/** Partial-stitch tools work on a point inside a cell, not on whole cells. */
export function isPartialTool(tool: EditorTool): boolean {
  return tool === 'half-stitch' || tool === 'quarter-stitch';
}
