import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { PaletteEntry } from '@stitchcraft/types';

import { GridCanvas } from './grid-canvas';

function fakePointerEvent(clientX: number, clientY: number): PointerEvent {
  return { clientX, clientY, pointerId: 1 } as PointerEvent;
}

describe('GridCanvas', () => {
  let fixture: ComponentFixture<GridCanvas>;
  let component: GridCanvas;

  const palette: PaletteEntry[] = [
    { index: 0, symbol: 'A', color: { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } } },
  ];

  beforeEach(async () => {
    // jsdom implements neither a real 2D canvas context nor setPointerCapture.
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    HTMLCanvasElement.prototype.setPointerCapture = jest.fn();

    await TestBed.configureTestingModule({ imports: [GridCanvas] }).compileComponents();
    fixture = TestBed.createComponent(GridCanvas);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('width', 5);
    fixture.componentRef.setInput('height', 5);
    fixture.componentRef.setInput(
      'grid',
      Array.from({ length: 5 }, () => new Int16Array(5).fill(-1)),
    );
    fixture.componentRef.setInput('palette', palette);
    fixture.componentRef.setInput('zoomPercent', 100); // cellSize = 20px, canvas = 100x100px
    fixture.detectChanges();

    // width=5 * cellSize=20 = 100px canvas; stub layout geometry to match 1:1.
    const canvasEl: HTMLCanvasElement = fixture.debugElement.nativeElement.querySelector('canvas');
    canvasEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  });

  it('sizes the canvas element to width*cellSize by height*cellSize', () => {
    expect(component['canvasWidthPx']()).toBe(100);
    expect(component['canvasHeightPx']()).toBe(100);
  });

  it('emits cellEdit with the cell under the pointer on pointerdown', () => {
    const spy = jest.fn();
    component.cellEdit.subscribe(spy);

    component.onPointerDown(fakePointerEvent(25, 45)); // -> cell (1, 2) at 20px cells

    expect(spy).toHaveBeenCalledWith({ x: 1, y: 2 });
  });

  it('emits cellEdit on pointermove while the pointer is down', () => {
    const spy = jest.fn();
    component.onPointerDown(fakePointerEvent(0, 0));
    component.cellEdit.subscribe(spy);

    component.onPointerMove(fakePointerEvent(40, 40)); // -> cell (2, 2)

    expect(spy).toHaveBeenCalledWith({ x: 2, y: 2 });
  });

  it.each(['fill', 'pick'] as const)(
    'emits only once per click for the single-click %s tool, not on drag',
    (tool) => {
      fixture.componentRef.setInput('tool', tool);
      fixture.detectChanges();
      const spy = jest.fn();
      component.cellEdit.subscribe(spy);

      component.onPointerDown(fakePointerEvent(5, 5));
      component.onPointerMove(fakePointerEvent(45, 45));
      component.onPointerUp();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ x: 0, y: 0 });
    },
  );

  it('does not emit cellEdit on pointermove when the pointer is not down', () => {
    const spy = jest.fn();
    component.cellEdit.subscribe(spy);

    component.onPointerMove(fakePointerEvent(40, 40));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not re-emit for the same cell on consecutive moves', () => {
    const spy = jest.fn();
    component.onPointerDown(fakePointerEvent(25, 25)); // cell (1,1)
    component.cellEdit.subscribe(spy);

    component.onPointerMove(fakePointerEvent(26, 26)); // still cell (1,1)

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits strokeEnd on pointerup, and stops tracking further moves as part of the stroke', () => {
    const strokeEndSpy = jest.fn();
    const cellEditSpy = jest.fn();
    component.strokeEnd.subscribe(strokeEndSpy);

    component.onPointerDown(fakePointerEvent(0, 0));
    component.onPointerUp();
    component.cellEdit.subscribe(cellEditSpy);
    component.onPointerMove(fakePointerEvent(40, 40));

    expect(strokeEndSpy).toHaveBeenCalledTimes(1);
    expect(cellEditSpy).not.toHaveBeenCalled();
  });

  it('ignores pointer positions outside the grid bounds', () => {
    const spy = jest.fn();
    component.cellEdit.subscribe(spy);

    component.onPointerDown(fakePointerEvent(500, 500));

    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores pointer input when not interactive', () => {
    fixture.componentRef.setInput('interactive', false);
    fixture.detectChanges();
    const spy = jest.fn();
    component.cellEdit.subscribe(spy);
    component.onPointerDown(fakePointerEvent(5, 5));
    component.onPointerUp();
    expect(spy).not.toHaveBeenCalled();
  });

  describe('backstitch tools', () => {
    it('drags a line between snapped corners and emits it on release, without editing cells', () => {
      fixture.componentRef.setInput('tool', 'backstitch');
      fixture.detectChanges();
      const lines = jest.fn();
      const cells = jest.fn();
      component.lineDraw.subscribe(lines);
      component.cellEdit.subscribe(cells);

      component.onPointerDown(fakePointerEvent(21, 3)); // nearest corner (1, 0)
      component.onPointerMove(fakePointerEvent(43, 18)); // nearest corner (2, 1)
      component.onPointerUp();

      expect(lines).toHaveBeenCalledWith({ from: { x: 1, y: 0 }, to: { x: 2, y: 1 } });
      expect(cells).not.toHaveBeenCalled();
    });

    it('emits nothing for a click without movement', () => {
      fixture.componentRef.setInput('tool', 'backstitch');
      fixture.detectChanges();
      const lines = jest.fn();
      component.lineDraw.subscribe(lines);
      component.onPointerDown(fakePointerEvent(21, 3));
      component.onPointerUp();
      expect(lines).not.toHaveBeenCalled();
    });

    it('reports eraser clicks in fractional cells', () => {
      fixture.componentRef.setInput('tool', 'backstitch-erase');
      fixture.detectChanges();
      const erase = jest.fn();
      component.lineErase.subscribe(erase);
      component.onPointerDown(fakePointerEvent(25, 10));
      expect(erase).toHaveBeenCalledWith({ x: 1.25, y: 0.5 });
    });

    it('reports a click point for the half and quarter stitch tools', () => {
      fixture.componentRef.setInput('tool', 'quarter-stitch');
      fixture.detectChanges();
      const place = jest.fn();
      const edit = jest.fn();
      component.partialPlace.subscribe(place);
      component.cellEdit.subscribe(edit);
      component.onPointerDown(fakePointerEvent(25, 10));
      expect(place).toHaveBeenCalledWith({ x: 1.25, y: 0.5 });
      expect(edit).not.toHaveBeenCalled();
    });
  });
});
