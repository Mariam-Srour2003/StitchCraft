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
  | 'text';

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
