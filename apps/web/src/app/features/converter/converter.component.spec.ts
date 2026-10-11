import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import type { ConversionJob, ImageAnalysis } from '@stitchcraft/types';

import { encodeJpeg, loadImageFile } from '@app/core/browser/image-io';
import { ConversionsApiService } from '@app/data-access/conversions-api.service';
import type { RgbaImage } from '@app/domain/image/image-ops';

import { ANALYSIS_DEBOUNCE_MS, ConverterComponent, POLL_INTERVAL_MS } from './converter.component';

jest.mock('@app/core/browser/image-io', () => ({
  loadImageFile: jest.fn(),
  encodeJpeg: jest.fn(),
  paintToCanvas: jest.fn(),
}));

const loadImage = loadImageFile as jest.Mock;
const encode = encodeJpeg as jest.Mock;

/** A 300x200 photo (3:2). */
const photo = (): RgbaImage => ({
  width: 300,
  height: 200,
  data: new Uint8ClampedArray(300 * 200 * 4).fill(128),
});

function makeJob(overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    id: 'job-1',
    userId: 'user-1',
    status: 'processing',
    progress: 10,
    params: {
      sourceImageRef: 'x',
      targetType: 'cross_stitch',
      width: 60,
      height: 60,
      colorCount: 24,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
    source: { width: 300, height: 200 },
    target: { type: 'cross_stitch', width: 60, height: 40, colorCount: 24 },
    score: 58,
    verdict: 'fair',
    summary: 'This will work, with compromises.',
    metrics: {
      sharpness: 300,
      brightness: 0.5,
      contrast: 0.8,
      clipped: 0,
      confetti: 0.05,
      colorsUsed: 20,
    },
    faces: [{ box: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, stitchHeight: 4 }],
    advice: [
      {
        code: 'face-too-small',
        severity: 'problem',
        title: 'The face will be too small to recognise',
        detail: '...',
        fix: { kind: 'crop', box: { x: 0.4, y: 0.4, width: 0.3, height: 0.3 } },
        fixLabel: 'Crop to the face',
      },
      {
        code: 'skin-needs-colors',
        severity: 'info',
        title: 'Skin needs a few more colours',
        detail: '...',
        fix: { kind: 'colors', colorCount: 30 },
        fixLabel: 'Use 30 colours',
      },
    ],
    suggested: { width: 80, height: 53, colorCount: 30, enhance: true, cleanup: true },
    preview: { width: 60, height: 40, dataUrl: 'data:image/png;base64,AAAA' },
    ...overrides,
  };
}

/** Lets the (0 ms) advisor debounce and promise chains run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('ConverterComponent', () => {
  let fixture: ComponentFixture<ConverterComponent>;
  let component: ConverterComponent;
  let conversionsApi: { create: jest.Mock; get: jest.Mock; analyze: jest.Mock };
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    loadImage.mockReset().mockResolvedValue(photo());
    encode.mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));

    conversionsApi = {
      create: jest.fn(),
      get: jest.fn(),
      analyze: jest.fn(() => of(makeAnalysis())),
    };
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ConverterComponent],
      providers: [
        { provide: ConversionsApiService, useValue: conversionsApi },
        { provide: Router, useValue: router },
        { provide: ANALYSIS_DEBOUNCE_MS, useValue: 0 },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConverterComponent);
    fixture.componentRef.setInput('projectId', 'proj-1');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const file = () => new File(['data'], 'cat.png', { type: 'image/png' });

  async function selectPhoto(): Promise<void> {
    await component.onFilesSelected([file()]);
    fixture.detectChanges();
  }

  it('starts in the select phase, with tips for good photos', () => {
    expect(component['phase']()).toBe('select');
    expect(fixture.nativeElement.textContent).toContain('What makes a photo stitch well');
  });

  it('opens the photo, sizes the pattern to its proportions and checks it', async () => {
    await selectPhoto();
    expect(component['phase']()).toBe('configure');
    expect(loadImage).toHaveBeenCalledWith(expect.any(File), 2000);
    expect([component['width'](), component['height']()]).toEqual([60, 40]);
    expect(component['analysisState']()).toBe('loading');

    await settle();
    expect(conversionsApi.analyze).toHaveBeenCalledTimes(1);
    // nothing edited: the original file is analysed, untouched
    const [blob, params] = conversionsApi.analyze.mock.calls[0];
    expect(blob).toBeInstanceOf(File);
    expect(params).toEqual({
      targetType: 'cross_stitch',
      width: 60,
      height: 40,
      colorCount: 24,
      enhance: false,
      cleanup: true,
    });
    expect(component['analysisState']()).toBe('ready');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('The face will be too small to recognise');
  });

  it('shows a friendly error when the file is not an image', async () => {
    loadImage.mockRejectedValueOnce(new Error('decode'));
    await component.onFilesSelected([file()]);
    expect(component['phase']()).toBe('failed');
    expect(component['errorMessage']()).toContain("couldn't be opened");
  });

  it('re-checks once after a burst of changes, with the latest settings', async () => {
    await selectPhoto();
    await settle();
    conversionsApi.analyze.mockClear();

    component.setColorCount(10);
    component.setColorCount(12);
    component.setEnhance(true);
    await settle();

    expect(conversionsApi.analyze).toHaveBeenCalledTimes(1);
    expect(conversionsApi.analyze.mock.calls[0][1]).toMatchObject({
      colorCount: 12,
      enhance: true,
    });
  });

  it('keeps proportions when width or height change, and when the photo is rotated', async () => {
    await selectPhoto();
    component.setWidth(90);
    expect(component['height']()).toBe(60);
    component.setHeight(30);
    expect(component['width']()).toBe(45);
    component.rotate(90); // photo is now 2:3
    expect([component['width'](), component['height']()]).toEqual([45, 68]);

    component.setKeepProportions(false);
    component.setHeight(10);
    expect(component['width']()).toBe(45);
  });

  it('crops to a fixed shape and follows the crop', async () => {
    await selectPhoto();
    component.setCropShape('square');
    expect(component['edits']().crop).not.toBeNull();
    expect(component['height']()).toBe(component['width']());
  });

  it('mirrors the crop box when flipping, so it frames the same thing', async () => {
    await selectPhoto();
    component.setCrop({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    component.flip('h');
    const crop = component['edits']().crop;
    expect(crop?.x).toBeCloseTo(0.6);
    expect(crop).toMatchObject({ y: 0.2, width: 0.3, height: 0.4 });
    expect(component['edits']().flipH).toBe(true);
  });

  it('uploads the edited photo as a JPEG once anything is changed', async () => {
    await selectPhoto();
    await settle();
    component.setAdjustment('brightness', 20);
    await settle();
    expect(encode).toHaveBeenCalledTimes(1);
    expect(conversionsApi.analyze.mock.calls[1][0].type).toBe('image/jpeg');
  });

  it('applies a crop fix inside the current crop', async () => {
    await selectPhoto();
    component.setCrop({ x: 0.5, y: 0, width: 0.5, height: 1 });
    component.applyFix({ kind: 'crop', box: { x: 0, y: 0.5, width: 0.5, height: 0.5 } });
    expect(component['edits']().crop).toEqual({ x: 0.5, y: 0.5, width: 0.25, height: 0.5 });
  });

  it('applies colour, enhance, cleanup and size fixes', async () => {
    await selectPhoto();
    component.setCleanup(false);
    component.applyFix({ kind: 'colors', colorCount: 30 });
    component.applyFix({ kind: 'enhance' });
    component.applyFix({ kind: 'cleanup' });
    component.applyFix({ kind: 'size', width: 120, height: 80 });
    expect(component['colorCount']()).toBe(30);
    expect(component['enhance']()).toBe(true);
    expect(component['cleanup']()).toBe(true);
    expect([component['width'](), component['height']()]).toEqual([120, 80]);
  });

  it('"apply all" crops first, then sizes to the new shape', async () => {
    await selectPhoto();
    await settle();
    component.applyAllSuggestions();
    expect(component['edits']().crop).toEqual({ x: 0.4, y: 0.4, width: 0.3, height: 0.3 });
    expect(component['colorCount']()).toBe(30);
    expect(component['enhance']()).toBe(true);
    // crop is 90x60 px of a 300x200 photo (3:2), so 80 wide -> 53 tall
    expect([component['width'](), component['height']()]).toEqual([80, 53]);
  });

  it('marks faces on the photo, mapped through the crop that was analysed', async () => {
    await selectPhoto();
    await settle();
    expect(component['faceMarkers']()).toEqual([
      { box: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, label: '4 st', tone: 'problem' },
    ]);
  });

  it('ignores a response that is out of date by the time it arrives', async () => {
    const first = new Subject<ImageAnalysis>();
    const second = new Subject<ImageAnalysis>();
    conversionsApi.analyze.mockReturnValueOnce(first).mockReturnValueOnce(second);
    await selectPhoto();
    await settle(); // first check is in flight

    component.setColorCount(40); // ...and is now out of date
    first.next(makeAnalysis({ score: 11 }));
    first.complete();
    expect(component['analysisState']()).toBe('loading');
    expect(component['analysis']()).toBeNull();

    await settle();
    second.next(makeAnalysis({ score: 88 }));
    second.complete();
    expect(component['analysisState']()).toBe('ready');
    expect(component['analysis']()?.score).toBe(88);
  });

  it('drops a check that finishes after the photo was cleared', async () => {
    const pending = new Subject<ImageAnalysis>();
    conversionsApi.analyze.mockReturnValueOnce(pending);
    await selectPhoto();
    await settle();
    component.reset();
    pending.next(makeAnalysis());
    expect(component['analysis']()).toBeNull();
    expect(component['analysisState']()).toBe('idle');
  });

  it('shows the advisor error state but still allows converting', async () => {
    conversionsApi.analyze.mockReturnValue(throwError(() => new Error('500')));
    await selectPhoto();
    await settle();
    expect(component['analysisState']()).toBe('error');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Couldn't check this photo");
  });

  it('reset() clears the photo and the advice', async () => {
    await selectPhoto();
    await settle();
    component.reset();
    expect(component['phase']()).toBe('select');
    expect(component['selectedFile']()).toBeNull();
    expect(component['analysis']()).toBeNull();
  });

  it('sends the settings, the photo and its name when converting', async () => {
    conversionsApi.create.mockReturnValueOnce(of({ jobId: 'job-1' }));
    conversionsApi.get.mockReturnValue(of(makeJob()));
    await selectPhoto();
    component.setTargetType('diamond');
    component.setKeepProportions(false);
    component.setWidth(80);
    component.setHeight(90);
    component.setColorCount(15);

    await component.startConversion();

    expect(conversionsApi.create).toHaveBeenCalledWith(
      'proj-1',
      expect.any(File),
      {
        targetType: 'diamond',
        width: 80,
        height: 90,
        colorCount: 15,
        enhance: false,
        cleanup: true,
      },
      'cat.png',
    );
    expect(component['phase']()).toBe('converting');
  });

  it('shows an error if starting the upload fails', async () => {
    conversionsApi.create.mockReturnValueOnce(throwError(() => new Error('network down')));
    await selectPhoto();
    await component.startConversion();
    expect(component['phase']()).toBe('failed');
    expect(component['errorMessage']()).toContain('try again');
  });

  describe('polling', () => {
    // Photo loading is native async/await, which fakeAsync can't follow, so
    // these switch to Jest's timers only once the photo is open.
    afterEach(() => jest.useRealTimers());

    it('polls until the job completes, then opens the pattern in the editor', async () => {
      conversionsApi.create.mockReturnValueOnce(of({ jobId: 'job-1' }));
      conversionsApi.get.mockReturnValue(
        of(makeJob({ status: 'completed', progress: 100, resultPatternId: 'pattern-9' })),
      );
      await selectPhoto();
      jest.useFakeTimers();
      await component.startConversion();
      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(router.navigate).toHaveBeenCalledWith(['/editor', 'pattern-9'], {
        queryParams: { converted: 1 },
      });
    });

    it('shows the job error when the job fails', async () => {
      conversionsApi.create.mockReturnValueOnce(of({ jobId: 'job-1' }));
      conversionsApi.get.mockReturnValue(
        of(makeJob({ status: 'failed', error: 'Unsupported image' })),
      );
      await selectPhoto();
      jest.useFakeTimers();
      await component.startConversion();
      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(component['phase']()).toBe('failed');
      expect(component['errorMessage']()).toBe('Unsupported image');
    });
  });
});
