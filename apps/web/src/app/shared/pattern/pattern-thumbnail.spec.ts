import { TestBed } from '@angular/core/testing';
import { encodeGrid } from '@stitchcraft/types';
import { PatternThumbnail } from './pattern-thumbnail';

describe('PatternThumbnail', () => {
  it('sizes the preview to fit the longer side and accepts RLE rows', () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    const fixture = TestBed.createComponent(PatternThumbnail);
    fixture.componentRef.setInput('width', 40);
    fixture.componentRef.setInput('height', 20);
    fixture.componentRef.setInput('grid', encodeGrid([[0, null]]));
    fixture.componentRef.setInput('palette', []);
    fixture.componentRef.setInput('size', 100);
    fixture.detectChanges();
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    expect(canvas.style.width).toBe('100px');
    expect(canvas.style.height).toBe('50px');
  });
});
