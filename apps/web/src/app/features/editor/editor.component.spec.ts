import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExportResponse, Pattern } from '@stitchcraft/types';
import { of, throwError } from 'rxjs';
import { PatternsApiService } from '../patterns/patterns-api.service';
import { EditorComponent } from './editor.component';
import { ExportApiService } from './export-api.service';

function makePattern(): Pattern {
  return {
    id: 'pattern-1',
    projectId: 'proj-1',
    name: 'Sampler',
    type: 'cross_stitch',
    width: 4,
    height: 4,
    palette: [{ index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } }],
    grid: [
      [[null, 4]],
      [[null, 4]],
      [[null, 4]],
      [[null, 4]],
    ],
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

  it('save() calls through to the store, which calls the API', async () => {
    patternsApi.update.mockReturnValueOnce(of(makePattern()));
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(patternsApi.update).toHaveBeenCalledWith('pattern-1', expect.any(Object));
  });

  describe('export', () => {
    const result: ExportResponse = {
      pdfUrl: 'https://storage.local/chart.pdf',
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
});
