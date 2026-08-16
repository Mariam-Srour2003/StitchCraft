import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pattern } from '@stitchcraft/types';
import { of } from 'rxjs';
import { PatternsApiService } from '../patterns/patterns-api.service';
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

  beforeEach(async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    HTMLCanvasElement.prototype.setPointerCapture = jest.fn();

    patternsApi = { get: jest.fn().mockReturnValue(of(makePattern())), update: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [{ provide: PatternsApiService, useValue: patternsApi }],
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
});
