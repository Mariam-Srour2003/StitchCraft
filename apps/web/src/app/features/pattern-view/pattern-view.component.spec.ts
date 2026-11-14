import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Pattern } from '@stitchcraft/types';
import { encodeGrid } from '@stitchcraft/types';
import { of, throwError } from 'rxjs';
import { PatternsApiService } from '../patterns/patterns-api.service';
import { PatternViewComponent } from './pattern-view.component';

const pattern: Pattern = {
  id: 'p1',
  projectId: 'proj',
  name: 'Roses',
  type: 'cross_stitch',
  width: 3,
  height: 1,
  palette: [
    {
      index: 0,
      symbol: 'A',
      color: {
        code: '310',
        name: 'Black',
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        lab: { l: 0, a: 0, b: 0 },
      },
    },
    { index: 1, symbol: 'B', color: { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } } },
  ],
  grid: encodeGrid([[0, 0, null]]),
  meta: { createdFrom: 'blank', fabricCount: 14, progress: encodeGrid([[1, null, null]]) },
  createdAt: '',
  updatedAt: '',
};

describe('PatternViewComponent', () => {
  let api: { get: jest.Mock; duplicate: jest.Mock; remove: jest.Mock };

  const setup = async (get = jest.fn().mockReturnValue(of(pattern))) => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    api = { get, duplicate: jest.fn(), remove: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [PatternViewComponent],
      providers: [provideRouter([]), { provide: PatternsApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PatternViewComponent);
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('shows the pattern, stats and only the colors actually used in the legend', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Roses');
    expect(text).toContain('Cross-stitch');
    expect(text).toContain('50%');
    expect(text).toContain('DMC 310');
    expect(fixture.componentInstance['legendRows']()).toHaveLength(1);
    expect(text).toContain('Skeins');
  });

  it('shows a not-found state when loading fails', async () => {
    const fixture = await setup(jest.fn().mockReturnValue(throwError(() => new Error('404'))));
    expect(fixture.nativeElement.textContent).toContain('Pattern not found');
  });

  it('duplicates and navigates to the copy', async () => {
    const fixture = await setup();
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    api.duplicate.mockReturnValueOnce(of({ ...pattern, id: 'p2' }));
    await fixture.componentInstance.duplicate();
    expect(navigate).toHaveBeenCalledWith(['/patterns', 'p2']);
  });

  it('hides progress overlays when toggled off', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance['progress']()).not.toBeNull();
    fixture.componentInstance['showProgress'].set(false);
    expect(fixture.componentInstance['progress']()).toBeNull();
  });
});
