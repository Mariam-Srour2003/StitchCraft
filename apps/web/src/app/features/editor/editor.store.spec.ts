import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import type { Pattern } from '@stitchcraft/types';
import { EMPTY_CELL, encodeGrid } from '@stitchcraft/types';

import { PatternsApiService } from '@app/data-access/patterns-api.service';

import { EditorStore } from './editor.store';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    projectId: 'proj-1',
    name: 'Test pattern',
    type: 'cross_stitch',
    width: 3,
    height: 2,
    palette: [
      { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
      { index: 1, symbol: 'B', color: { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } } },
    ],
    grid: encodeGrid([
      [null, null, null],
      [null, null, null],
    ]),
    meta: { createdFrom: 'blank' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const E = EMPTY_CELL;

describe('EditorStore', () => {
  let store: EditorStore;
  let api: { get: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    api = { get: jest.fn(), update: jest.fn() };
    TestBed.configureTestingModule({
      providers: [EditorStore, { provide: PatternsApiService, useValue: api }],
    });
    store = TestBed.inject(EditorStore);
  });

  describe('load', () => {
    it('decodes the grid and populates state', async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');

      expect(store.patternId()).toBe('pattern-1');
      expect(store.width()).toBe(3);
      expect(store.height()).toBe(2);
      expect(store.grid()).toHaveLength(2);
      expect(Array.from(store.grid()[0])).toEqual([EMPTY_CELL, EMPTY_CELL, EMPTY_CELL]);
      expect(store.dirty()).toBe(false);
    });

    it('defaults the render mode to diamond for a diamond pattern', async () => {
      api.get.mockReturnValueOnce(of(makePattern({ type: 'diamond' })));
      await store.load('pattern-1');
      expect(store.renderMode()).toBe('diamond');
    });

    it('defaults the render mode to block for a non-diamond pattern', async () => {
      api.get.mockReturnValueOnce(of(makePattern({ type: 'cross_stitch' })));
      await store.load('pattern-1');
      expect(store.renderMode()).toBe('block');
    });

    it('does not reset a user-chosen render mode when save() re-applies the pattern', async () => {
      api.get.mockReturnValueOnce(of(makePattern({ type: 'cross_stitch' })));
      await store.load('pattern-1');
      store.setRenderMode('symbol');

      api.update.mockReturnValueOnce(of(makePattern({ type: 'cross_stitch' })));
      await store.save();

      expect(store.renderMode()).toBe('symbol');
    });
  });

  describe('paintCell', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
    });

    it('does nothing for the paint tool when no color is selected', () => {
      store.setTool('paint');
      store.paintCell(0, 0);
      expect(store.grid()[0][0]).toBe(EMPTY_CELL);
      expect(store.dirty()).toBe(false);
    });

    it('paints the selected palette index', () => {
      store.setTool('paint');
      store.setSelectedPaletteIndex(1);
      store.paintCell(1, 0);
      expect(store.grid()[0][1]).toBe(1);
      expect(store.dirty()).toBe(true);
    });

    it('erases regardless of the selected palette index', () => {
      store.setTool('paint');
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      store.setTool('erase');
      store.paintCell(0, 0);
      expect(store.grid()[0][0]).toBe(EMPTY_CELL);
    });

    it('only replaces the edited row reference, leaving other rows untouched', () => {
      const before = store.grid();
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      const after = store.grid();

      expect(after[0]).not.toBe(before[0]);
      expect(after[1]).toBe(before[1]);
    });
  });

  describe('undo/redo', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
    });

    it('groups a whole drag stroke into a single undo step', () => {
      store.paintCell(0, 0);
      store.paintCell(1, 0);
      store.endStroke();

      expect(store.canUndo()).toBe(true);
      store.undo();
      expect(store.grid()[0][0]).toBe(EMPTY_CELL);
      expect(store.grid()[0][1]).toBe(EMPTY_CELL);
      expect(store.canUndo()).toBe(false);
    });

    it('restores the pre-stroke value even if a cell was touched twice in one stroke', () => {
      store.paintCell(0, 0); // -> 0
      store.setSelectedPaletteIndex(1);
      store.paintCell(0, 0); // -> 1, same stroke
      store.endStroke();

      expect(store.grid()[0][0]).toBe(1);
      store.undo();
      expect(store.grid()[0][0]).toBe(EMPTY_CELL); // back to the original pre-stroke value
    });

    it('does not push an undo step when nothing actually changed', () => {
      store.paintCell(0, 0);
      store.endStroke();
      const stackLength = store.canUndo();
      store.paintCell(0, 0); // already this value: no-op
      store.endStroke();

      expect(stackLength).toBe(true);
      store.undo();
      expect(store.canUndo()).toBe(false); // only one real step existed
    });

    it('redo re-applies an undone stroke', () => {
      store.paintCell(0, 0);
      store.endStroke();
      store.undo();
      expect(store.canRedo()).toBe(true);

      store.redo();
      expect(store.grid()[0][0]).toBe(0);
      expect(store.canRedo()).toBe(false);
    });

    it('starting a new stroke after an undo clears the redo stack', () => {
      store.paintCell(0, 0);
      store.endStroke();
      store.undo();
      expect(store.canRedo()).toBe(true);

      store.paintCell(1, 1);
      store.endStroke();
      expect(store.canRedo()).toBe(false);
    });
  });

  describe('resize', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      store.endStroke();
    });

    it('preserves overlapping cells when growing', () => {
      store.resize(5, 4);
      expect(store.width()).toBe(5);
      expect(store.height()).toBe(4);
      expect(store.grid()[0][0]).toBe(0); // preserved
      expect(store.grid()[3][4]).toBe(EMPTY_CELL); // new area is blank
    });

    it('drops cells outside the new bounds when shrinking', () => {
      store.resize(1, 1);
      expect(store.grid()).toHaveLength(1);
      expect(store.grid()[0]).toHaveLength(1);
      expect(store.grid()[0][0]).toBe(0);
    });

    it('is undoable and redoable as one step, restoring dimensions and dropped cells', () => {
      store.paintCell(2, 1);
      store.endStroke();
      store.resize(1, 1);
      expect(store.grid()[0]).toHaveLength(1);

      store.undo();
      expect(store.width()).toBe(3);
      expect(store.height()).toBe(2);
      expect(store.grid()[1][2]).toBe(0); // the cell the shrink dropped is back

      store.redo();
      expect(store.width()).toBe(1);
      expect(store.height()).toBe(1);
    });

    it('keeps earlier paint history undoable across a resize', () => {
      store.resize(4, 4);
      store.undo(); // the resize
      store.undo(); // the paint from beforeEach
      expect(store.grid()[0][0]).toBe(EMPTY_CELL);
      expect(store.canUndo()).toBe(false);
    });

    it('is a no-op (no history step) when the size does not change', () => {
      store.undo(); // drop the beforeEach paint step
      store.resize(3, 2);
      expect(store.canUndo()).toBe(false);
    });
  });

  describe('fill tool', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
    });

    it('flood-fills the connected region with the selected color as one undo step', () => {
      // wall of color 1 down column 1 splits the 3x2 grid
      store.setSelectedPaletteIndex(1);
      store.paintCell(1, 0);
      store.paintCell(1, 1);
      store.endStroke();

      store.setTool('fill');
      store.setSelectedPaletteIndex(0);
      store.applyTool(0, 0);

      expect(Array.from(store.grid()[0])).toEqual([0, 1, EMPTY_CELL]);
      expect(Array.from(store.grid()[1])).toEqual([0, 1, EMPTY_CELL]);
      expect(store.dirty()).toBe(true);

      store.undo();
      expect(store.grid()[0][0]).toBe(EMPTY_CELL);
      expect(store.grid()[0][1]).toBe(1); // the earlier stroke is untouched
    });

    it('does nothing with no color selected', () => {
      store.setTool('fill');
      store.applyTool(0, 0);
      expect(store.dirty()).toBe(false);
      expect(store.canUndo()).toBe(false);
    });
  });

  describe('pick tool (eyedropper)', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(1);
      store.paintCell(2, 1);
      store.endStroke();
      store.setSelectedPaletteIndex(0);
    });

    it('selects the color under the cell and switches back to paint', () => {
      store.setTool('pick');
      store.applyTool(2, 1);
      expect(store.selectedPaletteIndex()).toBe(1);
      expect(store.tool()).toBe('paint');
    });

    it('ignores empty cells', () => {
      store.setTool('pick');
      store.applyTool(0, 0);
      expect(store.selectedPaletteIndex()).toBe(0);
      expect(store.tool()).toBe('pick');
    });
  });

  describe('addColorToPalette', () => {
    it('assigns the next symbol and auto-selects the new entry', async () => {
      api.get.mockReturnValueOnce(of(makePattern({ palette: [] })));
      await store.load('pattern-1');

      const entry = store.addColorToPalette({ hex: '#123456', rgb: { r: 18, g: 52, b: 86 } });

      expect(entry.index).toBe(0);
      expect(entry.symbol).toBeTruthy();
      expect(store.palette()).toHaveLength(1);
      expect(store.selectedPaletteIndex()).toBe(0);
    });

    it('selects an existing DMC thread instead of adding a duplicate entry', async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
      const dmc310 = {
        code: '310',
        name: 'Black',
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        lab: { l: 0, a: 0, b: 0 },
      };

      const first = store.addColorToPalette(dmc310);
      store.setSelectedPaletteIndex(0);
      const second = store.addColorToPalette({ ...dmc310 });

      expect(second.index).toBe(first.index);
      expect(store.palette()).toHaveLength(3);
      expect(store.selectedPaletteIndex()).toBe(first.index);
    });
  });

  describe('legendRows', () => {
    it('counts painted cells per palette index', async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      store.paintCell(1, 0);
      store.setSelectedPaletteIndex(1);
      store.paintCell(2, 0);
      store.endStroke();

      const rows = store.legendRows();
      expect(rows.find((r) => r.entry.index === 0)?.count).toBe(2);
      expect(rows.find((r) => r.entry.index === 1)?.count).toBe(1);
    });
  });

  describe('save', () => {
    it('sends an RLE-encoded grid that round-trips the painted cells', async () => {
      api.get.mockReturnValueOnce(of(makePattern()));
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(1);
      store.paintCell(2, 1);
      store.endStroke();

      api.update.mockReturnValueOnce(of(makePattern()));
      await store.save();

      const [, dto] = api.update.mock.calls[0];
      expect(dto.grid[1]).toEqual([
        [null, 2],
        [1, 1],
      ]);
    });
  });

  describe('pro editing features', () => {
    const row = (y: number) => Array.from(store.grid()[y]);

    beforeEach(async () => {
      api.get.mockReturnValueOnce(
        of(
          makePattern({
            width: 5,
            height: 5,
            grid: encodeGrid(Array.from({ length: 5 }, () => [null, null, null, null, null])),
          }),
        ),
      );
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
    });

    describe('shape tools', () => {
      it('previews a line while dragging and commits one undo step on stroke end', () => {
        store.setTool('line');
        store.applyTool(0, 0);
        store.applyTool(4, 0);
        expect(row(0)).toEqual([0, 0, 0, 0, 0]);

        // dragging back shrinks the preview: earlier preview cells are reverted
        store.applyTool(2, 0);
        expect(row(0)).toEqual([0, 0, 0, E, E]);

        store.endStroke();
        store.undo();
        expect(row(0)).toEqual([E, E, E, E, E]);
        expect(store.canUndo()).toBe(false);
      });

      it('draws a rectangle outline and a filled rectangle', () => {
        store.setTool('rect');
        store.applyTool(0, 0);
        store.applyTool(2, 2);
        store.endStroke();
        expect(store.grid()[1][1]).toBe(E);
        expect(store.grid()[2][2]).toBe(0);

        store.setTool('rect-fill');
        store.applyTool(0, 0);
        store.applyTool(2, 2);
        store.endStroke();
        expect(store.grid()[1][1]).toBe(0);
      });

      it('starts a fresh shape after each stroke', () => {
        store.setTool('line');
        store.applyTool(0, 0);
        store.endStroke();
        store.applyTool(4, 4);
        store.endStroke();
        expect(store.grid()[2][2]).toBe(E); // not a line from (0,0)
        expect(store.grid()[4][4]).toBe(0);
      });
    });

    describe('symmetry', () => {
      it('mirrors painting across the vertical axis', () => {
        store.setSymmetry('vertical');
        store.paintCell(0, 1);
        store.endStroke();
        expect(row(1)).toEqual([0, E, E, E, 0]);
        store.undo();
        expect(row(1)).toEqual([E, E, E, E, E]);
      });

      it('mirrors into four quadrants for "both"', () => {
        store.setSymmetry('both');
        store.paintCell(0, 0);
        expect(store.grid()[0][4]).toBe(0);
        expect(store.grid()[4][0]).toBe(0);
        expect(store.grid()[4][4]).toBe(0);
      });

      it('mirrors erasing too', () => {
        store.setSymmetry('vertical');
        store.paintCell(1, 1);
        store.setTool('erase');
        store.paintCell(1, 1);
        expect(row(1)).toEqual([E, E, E, E, E]);
      });
    });

    describe('text tool', () => {
      it('stamps lettering at the clicked cell, clipped to the grid, as one step', () => {
        store.setTool('text');
        store.setStampText('I');
        store.applyTool(0, 0);
        expect(row(1)).toEqual([E, E, 0, E, E]); // the stem of the I
        store.undo();
        expect(store.canUndo()).toBe(false);
      });

      it('does nothing with empty text', () => {
        store.setTool('text');
        store.applyTool(0, 0);
        expect(store.canUndo()).toBe(false);
      });
    });

    describe('transforms', () => {
      beforeEach(() => {
        store.paintCell(0, 0);
        store.endStroke();
      });

      it('flips horizontally and vertically, undoably', () => {
        store.flipHorizontal();
        expect(store.grid()[0][4]).toBe(0);
        store.flipVertical();
        expect(store.grid()[4][4]).toBe(0);
        store.undo();
        store.undo();
        expect(store.grid()[0][0]).toBe(0);
      });

      it('rotates clockwise, swapping dimensions', () => {
        store.resize(5, 3);
        store.rotateClockwise();
        expect(store.width()).toBe(3);
        expect(store.height()).toBe(5);
        expect(store.grid()[0][2]).toBe(0); // top-left moved to top-right
        store.undo();
        expect(store.width()).toBe(5);
      });
    });

    describe('palette operations', () => {
      it('replaces every stitch of one color with another, undoably', () => {
        store.paintCell(0, 0);
        store.paintCell(1, 0);
        store.endStroke();
        store.replaceColor(0, 1);
        expect(row(0).slice(0, 2)).toEqual([1, 1]);
        store.undo();
        expect(row(0).slice(0, 2)).toEqual([0, 0]);
      });

      it('removes unused colors and re-indexes the grid and selection', () => {
        store.setSelectedPaletteIndex(1);
        store.paintCell(0, 0);
        store.endStroke();
        store.removeUnusedColors();
        expect(store.palette()).toHaveLength(1);
        expect(store.palette()[0].index).toBe(0);
        expect(store.palette()[0].symbol).toBe('B');
        expect(store.grid()[0][0]).toBe(0);
        expect(store.selectedPaletteIndex()).toBe(0);

        store.undo();
        expect(store.palette()).toHaveLength(2);
        expect(store.grid()[0][0]).toBe(1);
      });

      it('deletes a color, erasing its stitches and shifting later indices', () => {
        store.paintCell(0, 0); // color 0
        store.setSelectedPaletteIndex(1);
        store.paintCell(1, 0); // color 1
        store.endStroke();
        store.deleteColor(0);
        expect(store.palette()).toHaveLength(1);
        expect(row(0).slice(0, 2)).toEqual([E, 0]);
        expect(store.selectedPaletteIndex()).toBe(0);
        store.undo();
        expect(row(0).slice(0, 2)).toEqual([0, 1]);
      });

      it('toggles a highlighted color', () => {
        store.toggleHighlight(1);
        expect(store.highlightIndex()).toBe(1);
        store.toggleHighlight(1);
        expect(store.highlightIndex()).toBeNull();
      });
    });

    describe('stitching progress', () => {
      beforeEach(() => {
        store.paintCell(0, 0);
        store.paintCell(1, 0);
        store.endStroke();
        store.setStitchMode(true);
      });

      it('marks painted cells done and reports progress per color', () => {
        store.applyTool(0, 0);
        store.endStroke();
        expect(store.legendRows()[0].done).toBe(1);
        expect(store.progressSummary()).toEqual({ total: 2, done: 1, percent: 50 });
      });

      it('does not paint while in stitching mode, and ignores empty cells', () => {
        store.applyTool(3, 3);
        expect(store.grid()[3][3]).toBe(E);
        expect(store.progressSummary().done).toBe(0);
      });

      it('a drag sets every cell to the opposite of its starting cell', () => {
        store.applyTool(0, 0);
        store.endStroke();
        store.applyTool(0, 0); // starts on a done cell -> unmark mode
        store.applyTool(1, 0); // already not done: stays not done
        store.endStroke();
        expect(store.progressSummary().done).toBe(0);
      });

      it('marks or clears a whole color at once and can reset', () => {
        store.setColorStitched(0, true);
        expect(store.progressSummary().done).toBe(2);
        store.resetProgress();
        expect(store.progressSummary().done).toBe(0);
      });

      it('follows the pattern through a flip', () => {
        store.applyTool(0, 0);
        store.endStroke();
        store.flipHorizontal();
        expect(store.progress()[0][4]).toBe(1);
      });

      it('saves progress RLE-encoded in meta and restores it on load', async () => {
        store.applyTool(1, 0);
        store.endStroke();
        api.update.mockImplementationOnce((_id, dto) =>
          of(
            makePattern({
              width: 5,
              height: 5,
              grid: dto.grid,
              meta: { createdFrom: 'blank', ...dto.meta },
            }),
          ),
        );
        await store.save();
        const [, dto] = api.update.mock.calls[0];
        expect(dto.meta.progress[0]).toEqual([
          [null, 1],
          [1, 1],
          [null, 3],
        ]);
        expect(store.progress()[0][1]).toBe(1);
        expect(store.progressSummary().done).toBe(1);
      });
    });

    describe('materials', () => {
      it('estimates skeins per color for cross-stitch', () => {
        store.paintCell(0, 0);
        expect(store.buyLabel()).toBe('Skeins');
        expect(store.legendRows()[0].buy).toBe(1);
        expect(store.legendRows()[1].buy).toBe(0);
      });
    });
  });

  describe('backstitch', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(
        of(
          makePattern({
            width: 4,
            height: 4,
            grid: encodeGrid(Array.from({ length: 4 }, () => [null, null, null, null])),
          }),
        ),
      );
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
    });

    const lines = () => store.backstitches().map((l) => [l.x1, l.y1, l.x2, l.y2, l.paletteIndex]);

    it('draws a line in the selected color as one undo step', () => {
      store.addBackstitch({ x: 0, y: 0 }, { x: 2, y: 2 });
      expect(lines()).toEqual([[0, 0, 2, 2, 0]]);
      expect(store.dirty()).toBe(true);
      store.undo();
      expect(lines()).toEqual([]);
      store.redo();
      expect(lines()).toHaveLength(1);
    });

    it('ignores zero-length lines, duplicates and reversed duplicates', () => {
      store.addBackstitch({ x: 1, y: 1 }, { x: 1, y: 1 });
      store.addBackstitch({ x: 0, y: 0 }, { x: 2, y: 0 });
      store.addBackstitch({ x: 2, y: 0 }, { x: 0, y: 0 });
      expect(lines()).toHaveLength(1);
    });

    it('recolors when the same line is drawn in another color', () => {
      store.addBackstitch({ x: 0, y: 0 }, { x: 2, y: 0 });
      store.setSelectedPaletteIndex(1);
      store.addBackstitch({ x: 2, y: 0 }, { x: 0, y: 0 });
      expect(lines()).toEqual([[0, 0, 2, 0, 1]]);
    });

    it('does nothing without a selected color', () => {
      store.setSelectedPaletteIndex(null);
      store.addBackstitch({ x: 0, y: 0 }, { x: 1, y: 0 });
      expect(lines()).toEqual([]);
    });

    it('removes the line nearest a click, undoably', () => {
      store.addBackstitch({ x: 0, y: 0 }, { x: 4, y: 0 });
      store.addBackstitch({ x: 0, y: 3 }, { x: 4, y: 3 });
      store.removeBackstitchAt(2, 2.8);
      expect(lines()).toEqual([[0, 0, 4, 0, 0]]);
      store.removeBackstitchAt(2, 1.5); // nothing within half a cell
      expect(lines()).toHaveLength(1);
      store.undo();
      expect(lines()).toHaveLength(2);
    });

    it('ignores cell clicks while a line tool is active', () => {
      store.setTool('backstitch');
      store.applyTool(0, 0);
      expect(store.grid()[0][0]).toBe(E);
    });

    it('moves lines with flips, rotation and resize', () => {
      store.addBackstitch({ x: 0, y: 0 }, { x: 1, y: 0 });
      store.flipHorizontal();
      expect(lines()).toEqual([[4, 0, 3, 0, 0]]);
      store.flipVertical();
      expect(lines()).toEqual([[4, 4, 3, 4, 0]]);
      store.resize(2, 2); // line now outside the grid
      expect(lines()).toEqual([]);
      store.undo();
      store.rotateClockwise();
      expect(lines()).toEqual([[0, 4, 0, 3, 0]]);
    });

    it('follows palette operations', () => {
      store.addBackstitch({ x: 0, y: 0 }, { x: 1, y: 0 }); // color 0, used only by this line
      store.setSelectedPaletteIndex(1);
      store.addBackstitch({ x: 0, y: 1 }, { x: 1, y: 1 });

      store.removeUnusedColors(); // both colors are used by lines: nothing removed
      expect(store.palette()).toHaveLength(2);

      store.replaceColor(0, 1);
      expect(lines().map((l) => l[4])).toEqual([1, 1]);
      store.undo();

      store.deleteColor(0); // drops color 0's line and renumbers the other
      expect(lines()).toEqual([[0, 1, 1, 1, 0]]);
    });

    it('adds line thread into the legend skeins and saves lines in meta', async () => {
      store.addBackstitch({ x: 0, y: 0 }, { x: 4, y: 0 });
      expect(store.legendRows()[0].count).toBe(0);
      expect(store.legendRows()[0].buy).toBe(1);

      api.update.mockReturnValueOnce(of(makePattern({ width: 4, height: 4 })));
      await store.save();
      const [, dto] = api.update.mock.calls[0];
      expect(dto.meta.backstitches).toEqual([{ x1: 0, y1: 0, x2: 4, y2: 0, paletteIndex: 0 }]);
    });
  });

  describe('half and quarter stitches', () => {
    beforeEach(async () => {
      api.get.mockReturnValueOnce(
        of(
          makePattern({
            width: 4,
            height: 4,
            grid: encodeGrid(Array.from({ length: 4 }, () => [null, null, null, null])),
          }),
        ),
      );
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
    });

    const parts = () =>
      store.partialStitches().map((s) => `${s.x},${s.y} ${s.part} ${s.paletteIndex}`);

    it('places a half stitch on the diagonal through the clicked corner, undoably', () => {
      store.setTool('half-stitch');
      store.placePartialAt(1.9, 0.1); // near the top-right of cell (1,0)
      expect(parts()).toEqual(['1,0 half-up 0']);
      expect(store.dirty()).toBe(true);
      store.undo();
      expect(parts()).toEqual([]);
      store.redo();
      expect(parts()).toEqual(['1,0 half-up 0']);
    });

    it('builds a three-quarter stitch, and a second click on a stitch removes it', () => {
      store.setTool('half-stitch');
      store.placePartialAt(0.9, 0.1);
      store.setTool('quarter-stitch');
      store.setSelectedPaletteIndex(1);
      store.placePartialAt(0.2, 0.2); // top-left quarter, not on the "/" diagonal
      expect(parts()).toEqual(['0,0 half-up 0', '0,0 quarter-tl 1']);
      store.placePartialAt(0.8, 0.2); // top-right quarter overlaps "/": replaces it
      expect(parts()).toEqual(['0,0 quarter-tl 1', '0,0 quarter-tr 1']);
      store.placePartialAt(0.8, 0.2); // same again: removed
      expect(parts()).toEqual(['0,0 quarter-tl 1']);
    });

    it('replaces a full stitch in the cell, in the same undo step', () => {
      store.paintCell(2, 2);
      store.endStroke();
      store.setTool('quarter-stitch');
      store.placePartialAt(2.1, 2.1);
      expect(store.grid()[2][2]).toBe(E);
      store.undo();
      expect(store.grid()[2][2]).toBe(0);
      expect(parts()).toEqual([]);
    });

    it('painting or erasing over a cell removes its partial stitches; undo restores both', () => {
      store.setTool('half-stitch');
      store.placePartialAt(1.1, 1.1);
      store.placePartialAt(3.1, 3.1);
      store.setTool('erase');
      store.applyTool(1, 1);
      store.applyTool(1, 2);
      store.endStroke();
      expect(parts()).toEqual(['3,3 half-down 0']);
      store.undo();
      expect(parts()).toEqual(['1,1 half-down 0', '3,3 half-down 0']);
    });

    it('is a cross-stitch technique: ignored on other pattern types', async () => {
      api.get.mockReturnValueOnce(
        of(
          makePattern({
            type: 'diamond',
            width: 4,
            height: 4,
            grid: encodeGrid(Array.from({ length: 4 }, () => [null, null, null, null])),
          }),
        ),
      );
      await store.load('pattern-1');
      store.setSelectedPaletteIndex(0);
      store.setTool('half-stitch');
      store.placePartialAt(0.1, 0.1);
      expect(parts()).toEqual([]);
    });

    it('ignores cell clicks while a partial tool is active, and needs a colour', () => {
      store.setTool('quarter-stitch');
      store.applyTool(0, 0);
      expect(store.grid()[0][0]).toBe(E);
      store.setSelectedPaletteIndex(null);
      store.placePartialAt(0.2, 0.2);
      expect(parts()).toEqual([]);
    });

    it('moves with flips, rotation and resize', () => {
      store.setTool('quarter-stitch');
      store.placePartialAt(0.2, 0.2); // (0,0) top-left
      store.flipHorizontal();
      expect(parts()).toEqual(['3,0 quarter-tr 0']);
      store.rotateClockwise();
      expect(parts()).toEqual(['3,3 quarter-br 0']);
      store.resize(2, 2);
      expect(parts()).toEqual([]);
      store.undo();
      expect(parts()).toEqual(['3,3 quarter-br 0']);
    });

    it('follows palette operations, and keeps colours they use', () => {
      store.setTool('half-stitch');
      store.placePartialAt(0.1, 0.1); // colour 0, only used by this stitch
      store.removeUnusedColors(); // colour 1 is unused; colour 0 kept for the partial
      expect(store.palette()).toHaveLength(1);
      store.undo();
      store.replaceColor(0, 1);
      expect(parts()).toEqual(['0,0 half-down 1']);
      store.deleteColor(1);
      expect(parts()).toEqual([]);
    });

    it('adds their thread to the legend skeins and saves them in meta', async () => {
      store.setTool('half-stitch');
      store.placePartialAt(0.1, 0.1);
      expect(store.legendRows()[0].count).toBe(0);
      expect(store.legendRows()[0].buy).toBe(1);

      api.update.mockReturnValueOnce(of(makePattern({ width: 4, height: 4 })));
      await store.save();
      const [, dto] = api.update.mock.calls[0];
      expect(dto.meta.partialStitches).toEqual([
        { x: 0, y: 0, part: 'half-down', paletteIndex: 0 },
      ]);
    });
  });

  describe('tidy', () => {
    const text = () =>
      store.grid().map((row) => [...row].map((v) => (v < 0 ? '.' : String(v))).join(''));

    async function loadRows(rows: (number | null)[][], type: Pattern['type'] = 'cross_stitch') {
      api.get.mockReturnValueOnce(
        of(
          makePattern({
            type,
            width: rows[0].length,
            height: rows.length,
            palette: [
              { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
              { index: 1, symbol: 'B', color: { hex: '#EE1111', rgb: { r: 238, g: 17, b: 17 } } },
              { index: 2, symbol: 'C', color: { hex: '#0000FF', rgb: { r: 0, g: 0, b: 255 } } },
            ],
            grid: encodeGrid(rows),
          }),
        ),
      );
      await store.load('pattern-1');
    }

    it('removes stray stitches as one undo step', async () => {
      await loadRows([
        [0, 0, 0, 2],
        [0, 2, 0, 2],
        [0, 0, 0, 2],
      ]);
      expect(store.removeStrayStitches()).toBe(1);
      expect(text()).toEqual(['0002', '0002', '0002']);
      store.undo();
      expect(text()).toEqual(['0002', '0202', '0002']);
      expect(store.removeStrayStitches()).toBe(1);
      expect(store.removeStrayStitches()).toBe(0);
    });

    it('merges rare colours into the closest one and drops them from the palette', async () => {
      await loadRows([
        [0, 0, 1, 2],
        [0, 0, 1, 2],
        [0, 0, 0, 2],
      ]);
      // colour 1 (a near-identical red) has 2 stitches; blue has 3
      expect(store.mergeRareColors(3)).toBe(1);
      expect(store.palette().map((e) => e.color.hex)).toEqual(['#FF0000', '#0000FF']);
      expect(text()).toEqual(['0001', '0001', '0001']);
      store.undo();
      expect(store.palette()).toHaveLength(3);
      expect(store.mergeRareColors(1)).toBe(0);
    });

    it('keeps a rare colour in the palette while backstitch uses it', async () => {
      await loadRows([
        [0, 0, 1, 2],
        [0, 0, 0, 2],
      ]);
      store.setSelectedPaletteIndex(1);
      store.addBackstitch({ x: 0, y: 0 }, { x: 1, y: 0 });
      store.mergeRareColors(2);
      expect(store.palette()).toHaveLength(3);
      expect(text()).toEqual(['0002', '0002']);
      expect(store.backstitches()[0].paletteIndex).toBe(1);
    });

    it('merges small paint-by-number areas', async () => {
      await loadRows(
        [
          [0, 0, 0, 0],
          [0, 2, 0, 0],
          [0, 0, 0, 0],
        ],
        'color_by_number',
      );
      expect(store.mergeSmallAreas(2)).toBe(1);
      expect(text()).toEqual(['0000', '0000', '0000']);
    });
  });
});
