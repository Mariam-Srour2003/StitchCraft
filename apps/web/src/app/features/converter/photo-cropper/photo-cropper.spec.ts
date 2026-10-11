import { TestBed } from '@angular/core/testing';

import type { RelativeBox } from '@stitchcraft/types';

import { PhotoCropper } from './photo-cropper';

jest.mock('@app/core/browser/image-io', () => ({ paintToCanvas: jest.fn() }));

describe('PhotoCropper', () => {
  function setup(crop: RelativeBox | null = null, aspect: number | null = null) {
    const fixture = TestBed.createComponent(PhotoCropper);
    fixture.componentRef.setInput('image', {
      width: 200,
      height: 100,
      data: new Uint8ClampedArray(0),
    });
    fixture.componentRef.setInput('crop', crop);
    fixture.componentRef.setInput('aspect', aspect);
    fixture.detectChanges();
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    // displayed at 400x200 px
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
    const emitted: Array<RelativeBox | null> = [];
    fixture.componentInstance.cropChange.subscribe((box) => emitted.push(box));
    const pointer = (clientX: number, clientY: number) =>
      ({
        clientX,
        clientY,
        button: 0,
        pointerId: 1,
        currentTarget: canvas,
        preventDefault() {},
      }) as unknown as PointerEvent;
    return { fixture, cropper: fixture.componentInstance, emitted, pointer };
  }

  it('draws a new crop box by dragging', () => {
    const { cropper, emitted, pointer } = setup();
    cropper.onPointerDown(pointer(40, 20));
    cropper.onPointerMove(pointer(200, 120));
    cropper.onPointerUp();
    expect(emitted).toEqual([{ x: 0.1, y: 0.1, width: 0.4, height: 0.5 }]);
  });

  it('keeps the chosen shape while dragging', () => {
    const { cropper, emitted, pointer } = setup(null, 1);
    cropper.onPointerDown(pointer(0, 0));
    cropper.onPointerMove(pointer(100, 60));
    const box = emitted[emitted.length - 1];
    // square in pixels on a 2:1 photo
    expect(box && (box.width * 200) / (box.height * 100)).toBeCloseTo(1);
  });

  it('moves the box when dragging inside it', () => {
    const { cropper, emitted, pointer } = setup({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    cropper.onPointerDown(pointer(200, 100)); // centre
    cropper.onPointerMove(pointer(240, 100)); // +0.1 across
    expect(emitted[0]?.x).toBeCloseTo(0.35);
    expect(emitted[0]?.y).toBeCloseTo(0.25);
  });

  it('a click outside the box clears the crop', () => {
    const { cropper, emitted, pointer } = setup({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    cropper.onPointerDown(pointer(10, 10));
    cropper.onPointerUp();
    expect(emitted).toEqual([null]);
  });

  it('arrow keys move the box and Delete removes it', () => {
    const { cropper, emitted } = setup({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 });
    const key = (k: string) => ({ key: k, preventDefault() {} }) as KeyboardEvent;
    cropper.onCropKeydown(key('ArrowRight'));
    cropper.onCropKeydown(key('Delete'));
    expect(emitted[0]?.x).toBeCloseTo(0.21);
    expect(emitted[1]).toBeNull();
  });

  it('renders face markers with their stitch height', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('faces', [
      { box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, label: '6 st', tone: 'problem' },
    ]);
    fixture.detectChanges();
    const face = fixture.nativeElement.querySelector('.photo-cropper__face--problem');
    expect(face.textContent).toContain('6 st');
  });
});
