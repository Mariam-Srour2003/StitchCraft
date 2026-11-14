import { TestBed } from '@angular/core/testing';

import type { AdviceFix, ImageAnalysis } from '@stitchcraft/types';

import { PhotoAdvice } from './photo-advice';

const analysis = (advice: ImageAnalysis['advice']): ImageAnalysis => ({
  source: { width: 100, height: 100 },
  target: { type: 'cross_stitch', width: 50, height: 50, colorCount: 20 },
  score: 64,
  verdict: 'fair',
  summary: 'This will work, with compromises: the photo is dark.',
  metrics: {
    sharpness: 1,
    brightness: 0.1,
    contrast: 0.5,
    clipped: 0,
    confetti: 0,
    colorsUsed: 10,
  },
  faces: [],
  advice,
  suggested: { width: 50, height: 50, colorCount: 20, enhance: true, cleanup: true },
  preview: { width: 50, height: 50, dataUrl: '' },
});

describe('PhotoAdvice', () => {
  function setup(state: 'idle' | 'loading' | 'ready' | 'error', result: ImageAnalysis | null) {
    const fixture = TestBed.createComponent(PhotoAdvice);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('analysis', result);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the score, verdict and each finding', () => {
    const { el } = setup(
      'ready',
      analysis([
        {
          code: 'too-dark',
          severity: 'warning',
          title: 'The photo is dark',
          detail: 'Dark areas merge.',
        },
      ]),
    );
    expect(el.textContent).toContain('64');
    expect(el.textContent).toContain('Will work, with compromises');
    expect(el.textContent).toContain('Warning:');
    expect(el.textContent).toContain('The photo is dark');
  });

  it('emits a finding\'s fix, and offers "apply all" only for two or more fixes', () => {
    const fixes: AdviceFix[] = [];
    const { fixture, el } = setup(
      'ready',
      analysis([
        {
          code: 'a',
          severity: 'warning',
          title: 'A',
          detail: '',
          fix: { kind: 'enhance' },
          fixLabel: 'Turn on Auto-enhance',
        },
      ]),
    );
    fixture.componentInstance.applyFix.subscribe((fix) => fixes.push(fix));
    expect(el.textContent).not.toContain('Apply all');
    (el.querySelector('sc-button button') as HTMLButtonElement).click();
    expect(fixes).toEqual([{ kind: 'enhance' }]);

    fixture.componentRef.setInput(
      'analysis',
      analysis([
        {
          code: 'a',
          severity: 'warning',
          title: 'A',
          detail: '',
          fix: { kind: 'enhance' },
          fixLabel: 'x',
        },
        {
          code: 'b',
          severity: 'info',
          title: 'B',
          detail: '',
          fix: { kind: 'cleanup' },
          fixLabel: 'y',
        },
      ]),
    );
    fixture.detectChanges();
    expect(el.textContent).toContain('Apply all suggestions');
  });

  it('dims the old result while re-checking', () => {
    const { el } = setup('loading', analysis([]));
    expect(el.textContent).toContain('Checking');
    expect(el.querySelector('.photo-advice__verdict--stale')).not.toBeNull();
  });

  it('offers a retry when the check fails', () => {
    const { fixture, el } = setup('error', null);
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));
    (el.querySelector('.photo-advice__link') as HTMLButtonElement).click();
    expect(retried).toBe(true);
  });
});
