import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import type { ExportResponse, Pattern } from '@stitchcraft/types';

import { ExportApiService } from '@app/data-access/export-api.service';
import { PalettesApiService } from '@app/data-access/palettes-api.service';
import { PatternsApiService } from '@app/data-access/patterns-api.service';

import { EditorComponent } from './editor.component';

function makePattern(): Pattern {
  return {
    id: 'pattern-1',
    projectId: 'proj-1',
    name: 'Sampler',
    type: 'cross_stitch',
    width: 4,
    height: 4,
    palette: [{ index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } }],
    grid: [[[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]]],
    meta: { createdFrom: 'blank', fabricCount: 14 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('EditorComponent', () => {
  let fixture: ComponentFixture<EditorComponent>;
  let patternsApi: { get: jest.Mock; update: jest.Mock };
  let exportApi: { create: jest.Mock };

  beforeEach(async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    HTMLCanvasElement.prototype.setPointerCapture = jest.fn();

    patternsApi = { get: jest.fn().mockReturnValue(of(makePattern())), update: jest.fn() };
    exportApi = { create: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        { provide: PatternsApiService, useValue: patternsApi },
        { provide: ExportApiService, useValue: exportApi },
        { provide: PalettesApiService, useValue: { searchDmc: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorComponent);
    fixture.componentRef.setInput('id', 'pattern-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the pattern for the bound id', () => {
    expect(patternsApi.get).toHaveBeenCalledWith('pattern-1');
  });

  it('shows the loaded dimensions in the size readout', () => {
    expect(fixture.nativeElement.textContent).toContain('4 × 4 stitches');
  });

  it('shows the loaded palette entry', () => {
    expect(fixture.nativeElement.textContent).toContain('A');
  });

  it('disables undo/redo when there is no history yet', () => {
    const store = fixture.componentInstance['store'];
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });

  it('resize form applies new dimensions to the store', () => {
    const store = fixture.componentInstance['store'];
    fixture.componentInstance.applyResize('6', '8');
    expect(store.width()).toBe(6);
    expect(store.height()).toBe(8);
  });

  it('routes canvas cell edits through the active tool (fill floods the blank canvas)', () => {
    const store = fixture.componentInstance['store'];
    store.setSelectedPaletteIndex(0);
    store.setTool('fill');
    fixture.componentInstance.onCellEdit({ x: 0, y: 0 });
    expect(store.legendRows()[0].count).toBe(16);
  });

  it('adds a DMC thread picked from the sidebar search to the palette', () => {
    const store = fixture.componentInstance['store'];
    store.addColorToPalette({
      code: '310',
      name: 'Black',
      hex: '#000000',
      rgb: { r: 0, g: 0, b: 0 },
      lab: { l: 0, a: 0, b: 0 },
    });
    expect(fixture.componentInstance['paletteDmcCodes']()).toEqual(['310']);
  });

  it('save() calls through to the store, which calls the API', async () => {
    patternsApi.update.mockReturnValueOnce(of(makePattern()));
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(patternsApi.update).toHaveBeenCalledWith('pattern-1', expect.any(Object));
  });

  describe('export', () => {
    const result: ExportResponse = {
      pdfUrl: 'https://storage.local/chart.pdf',
      paintByNumberPdfUrl: 'https://storage.local/paint-by-number.pdf',
      pngUrl: 'https://storage.local/chart.png',
      svgUrl: 'https://storage.local/chart.svg',
      materialsListUrl: 'https://storage.local/materials.csv',
    };

    it('requests an export for the current pattern and exposes the resulting URLs', async () => {
      exportApi.create.mockReturnValueOnce(of(result));

      await fixture.componentInstance.exportPattern();

      expect(exportApi.create).toHaveBeenCalledWith('pattern-1');
      expect(fixture.componentInstance['exportResult']()).toEqual(result);
      expect(fixture.componentInstance['exporting']()).toBe(false);
    });

    it('sets an error message and clears it on close if the export request fails', async () => {
      exportApi.create.mockReturnValueOnce(throwError(() => new Error('boom')));

      await fixture.componentInstance.exportPattern();
      expect(fixture.componentInstance['exportError']()).toContain('try again');
      expect(fixture.componentInstance['exportResult']()).toBeNull();

      fixture.componentInstance.closeExport();
      expect(fixture.componentInstance['exportError']()).toBeNull();
    });

    it('closeExport() clears a successful result too', async () => {
      exportApi.create.mockReturnValueOnce(of(result));
      await fixture.componentInstance.exportPattern();

      fixture.componentInstance.closeExport();
      expect(fixture.componentInstance['exportResult']()).toBeNull();
    });
  });

  describe('keyboard shortcuts', () => {
    const press = (key: string, init: KeyboardEventInit = {}, target?: EventTarget) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
      if (target) Object.defineProperty(event, 'target', { value: target });
      fixture.componentInstance.onKeydown(event);
      return event;
    };

    it('switches tools with single keys', () => {
      const store = fixture.componentInstance['store'];
      press('g');
      expect(store.tool()).toBe('fill');
      press('L');
      expect(store.tool()).toBe('line');
      press('d');
      expect(store.tool()).toBe('half-stitch');
    });

    it('ignores the half/quarter stitch keys on patterns that are not cross-stitch', async () => {
      patternsApi.get.mockReturnValue(of({ ...makePattern(), type: 'diamond' }));
      const diamond = TestBed.createComponent(EditorComponent);
      diamond.componentRef.setInput('id', 'pattern-1');
      diamond.detectChanges();
      await diamond.whenStable();
      const store = diamond.componentInstance['store'];
      diamond.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'q' }));
      expect(store.tool()).toBe('paint');
    });

    it('undoes and redoes with Ctrl+Z / Ctrl+Shift+Z and prevents the browser default', () => {
      const store = fixture.componentInstance['store'];
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      store.endStroke();

      const undo = press('z', { ctrlKey: true });
      expect(undo.defaultPrevented).toBe(true);
      expect(store.canUndo()).toBe(false);

      press('z', { ctrlKey: true, shiftKey: true });
      expect(store.canUndo()).toBe(true);
    });

    it('saves with Ctrl+S', () => {
      patternsApi.update.mockReturnValueOnce(of(makePattern()));
      press('s', { metaKey: true });
      expect(patternsApi.update).toHaveBeenCalled();
    });

    it('ignores shortcuts while typing in a field', () => {
      const store = fixture.componentInstance['store'];
      press('g', {}, document.createElement('textarea'));
      expect(store.tool()).toBe('paint');
    });

    it('toggles stitching mode with K and zooms with +/-', () => {
      const store = fixture.componentInstance['store'];
      press('k');
      expect(store.stitchMode()).toBe(true);
      press('+');
      expect(store.zoomPercent()).toBe(125);
      press('-');
      expect(store.zoomPercent()).toBe(100);
    });

    it('picking a tool leaves stitching mode', () => {
      const store = fixture.componentInstance['store'];
      store.setStitchMode(true);
      press('b');
      expect(store.stitchMode()).toBe(false);
    });
  });

  describe('unsaved changes', () => {
    it('lets you leave freely when nothing changed', () => {
      expect(fixture.componentInstance.canLeave()).toBe(true);
    });

    it('asks before leaving with unsaved edits', () => {
      const store = fixture.componentInstance['store'];
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      expect(fixture.componentInstance.canLeave()).toBe(false);
      confirmSpy.mockRestore();
    });
  });

  describe('palette actions', () => {
    it('replaces the selected color with the chosen one', () => {
      const store = fixture.componentInstance['store'];
      store.addColorToPalette({ hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } });
      store.setSelectedPaletteIndex(0);
      store.paintCell(0, 0);
      store.endStroke();

      fixture.componentInstance.onReplaceTargetChange('1');
      fixture.componentInstance.applyReplace();
      expect(store.grid()[0][0]).toBe(1);
    });

    it('switches the canvas into stitch input in stitching mode', () => {
      fixture.componentInstance.setWorkMode('stitch');
      expect(fixture.componentInstance['canvasTool']()).toBe('stitch');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Stitching progress');
    });

    it('renders the new sidebar panels in design mode', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Mirror drawing');
      expect(text).toContain('Lettering');
      expect(text).toContain('Transform');
      expect(text).toContain('Skeins');
    });
  });

  it('opens in stitching mode with ?mode=stitch', async () => {
    const stitchFixture = TestBed.createComponent(EditorComponent);
    stitchFixture.componentRef.setInput('id', 'pattern-1');
    stitchFixture.componentRef.setInput('mode', 'stitch');
    stitchFixture.detectChanges();
    await stitchFixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve)); // let load()'s .then() run
    expect(stitchFixture.componentInstance['store'].stitchMode()).toBe(true);
  });

  it('wires the canvas backstitch events to the store and summarises lines', () => {
    const store = fixture.componentInstance['store'];
    store.setSelectedPaletteIndex(0);
    const canvas = fixture.debugElement.query((el) => el.name === 'sc-grid-canvas');
    canvas.triggerEventHandler('lineDraw', { from: { x: 0, y: 0 }, to: { x: 4, y: 0 } });
    expect(store.backstitches()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Backstitch: 1 line(s)');

    canvas.triggerEventHandler('lineErase', { x: 2, y: 0.1 });
    expect(store.backstitches()).toHaveLength(0);
  });

  it('wires the half/quarter stitch tools and summarises partial stitches', () => {
    const store = fixture.componentInstance['store'];
    store.setSelectedPaletteIndex(0);
    store.setTool('half-stitch');
    const canvas = fixture.debugElement.query((el) => el.name === 'sc-grid-canvas');
    canvas.triggerEventHandler('partialPlace', { x: 0.9, y: 0.1 });
    expect(store.partialStitches()).toEqual([{ x: 0, y: 0, part: 'half-up', paletteIndex: 0 }]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Partial stitches: 1 half, 0 quarter');
    expect(text).toContain('Half stitch: click near a corner');
  });

  it('offers partial stitch tools only for cross-stitch patterns', () => {
    const toggles = () =>
      fixture.debugElement
        .queryAll((el) => el.name === 'sc-segmented-toggle')
        .map((el) => el.componentInstance.ariaLabel());
    expect(toggles()).toContain('Partial stitch tool');
  });

  it('Tidy: removes stray stitches and merges rare colors, reporting what changed', () => {
    const store = fixture.componentInstance['store'];
    store.addColorToPalette({ hex: '#0000FF', rgb: { r: 0, g: 0, b: 255 } });
    store.setSelectedPaletteIndex(0);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) store.paintCell(x, y);
    store.setSelectedPaletteIndex(1);
    store.paintCell(1, 1); // one lone blue stitch in a red square
    store.endStroke();
    fixture.componentInstance.tidyStrays();
    expect(store.grid()[1][1]).toBe(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Recolored 1 stray stitch');

    store.undo();
    fixture.componentInstance.tidyRareColors('2');
    expect(store.palette()).toHaveLength(1);
    expect(store.grid()[1][1]).toBe(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Merged 1 rarely used color');
  });

  it('after a conversion, explains what was cleaned up and what can be edited', async () => {
    patternsApi.get.mockReturnValue(
      of({
        ...makePattern(),
        meta: {
          createdFrom: 'conversion',
          conversionCleanup: { strayStitchesRemoved: 12, colorsMerged: 2 },
        },
      }),
    );
    const converted = TestBed.createComponent(EditorComponent);
    converted.componentRef.setInput('id', 'pattern-1');
    converted.componentRef.setInput('converted', '1');
    converted.detectChanges();
    await converted.whenStable();
    converted.detectChanges();
    const text = converted.nativeElement.textContent;
    expect(text).toContain('Your photo is now a pattern.');
    expect(text).toContain('Clean up: 12 stray stitches recolored, 2 rarely used colors merged.');

    converted.componentInstance['convertedNoteDismissed'].set(true);
    converted.detectChanges();
    expect(converted.nativeElement.textContent).not.toContain('Your photo is now a pattern.');
  });
});
