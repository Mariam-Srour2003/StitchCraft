import { TestBed } from '@angular/core/testing';
import { EMPTY_CELL, encodeGrid, Pattern } from '@stitchcraft/types';
import { of } from 'rxjs';
import { PatternsApiService } from '../patterns/patterns-api.service';
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

    it('clears undo/redo history (resize is not undoable)', () => {
      expect(store.canUndo()).toBe(true);
      store.resize(4, 4);
      expect(store.canUndo()).toBe(false);
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
});
