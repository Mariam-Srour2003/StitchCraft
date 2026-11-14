import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

import type { RelativeBox } from '@stitchcraft/types';

import { paintToCanvas } from '@app/core/browser/image-io';
import {
  boxFromPoints,
  boxFromPointsWithAspect,
  moveBox,
  RgbaImage,
} from '@app/domain/image/image-ops';

/** A face the advisor found, in the photo's (uncropped) coordinates. */
export interface FaceMarker {
  box: RelativeBox;
  label: string;
  tone: 'good' | 'warning' | 'problem';
}

type Drag =
  | { mode: 'draw'; ax: number; ay: number; moved: boolean }
  | { mode: 'move'; startX: number; startY: number; from: RelativeBox };

/** Smallest crop side (relative); a click without a real drag clears the crop instead. */
const MIN_CROP = 0.03;
const KEY_STEP = 0.01;

/**
 * Shows the photo with a crop box over it. Drag outside the box to draw a new
 * one (keeping `aspect` when set), drag inside it to move it, arrow keys move
 * it too, a click without dragging clears it.
 */
@Component({
  selector: 'sc-photo-cropper',
  standalone: true,
  templateUrl: './photo-cropper.html',
  styleUrl: './photo-cropper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoCropper {
  readonly image = input.required<RgbaImage>();
  readonly crop = input<RelativeBox | null>(null);
  /** Pixel width / height the crop must keep, or null for any shape. */
  readonly aspect = input<number | null>(null);
  readonly faces = input<FaceMarker[]>([]);
  readonly cropChange = output<RelativeBox | null>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private drag: Drag | null = null;

  constructor() {
    effect(() => paintToCanvas(this.canvas().nativeElement, this.image()));
  }

  protected percent(n: number): string {
    return `${n * 100}%`;
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const [x, y] = this.relativePoint(event);
    const crop = this.crop();
    const inside =
      crop && x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height;
    this.drag = inside
      ? { mode: 'move', startX: x, startY: y, from: crop }
      : { mode: 'draw', ax: x, ay: y, moved: false };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const [x, y] = this.relativePoint(event);
    if (drag.mode === 'move') {
      this.cropChange.emit(moveBox(drag.from, x - drag.startX, y - drag.startY));
      return;
    }
    const box = this.boxTo(drag.ax, drag.ay, x, y);
    if (box.width >= MIN_CROP && box.height >= MIN_CROP) {
      drag.moved = true;
      this.cropChange.emit(box);
    }
  }

  onPointerUp(): void {
    const drag = this.drag;
    this.drag = null;
    if (drag?.mode === 'draw' && !drag.moved) this.cropChange.emit(null);
  }

  onCropKeydown(event: KeyboardEvent): void {
    const crop = this.crop();
    if (!crop) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      this.cropChange.emit(moveBox(crop, move[0], move[1]));
    } else if (event.key === 'Escape' || event.key === 'Delete') {
      event.preventDefault();
      this.cropChange.emit(null);
    }
  }

  private boxTo(ax: number, ay: number, x: number, y: number): RelativeBox {
    const aspect = this.aspect();
    const image = this.image();
    return aspect
      ? boxFromPointsWithAspect(ax, ay, x, y, aspect, image.width / image.height)
      : boxFromPoints(ax, ay, x, y);
  }

  private relativePoint(event: PointerEvent): [number, number] {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [0, 0];
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
  }
}
