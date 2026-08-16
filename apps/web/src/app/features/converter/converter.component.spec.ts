import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConversionJob } from '@stitchcraft/types';
import { of, throwError } from 'rxjs';
import { ConversionsApiService } from './conversions-api.service';
import { ConverterComponent, POLL_INTERVAL_MS } from './converter.component';

function makeJob(overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    id: 'job-1',
    userId: 'user-1',
    status: 'processing',
    progress: 10,
    params: { sourceImageRef: 'x', targetType: 'cross_stitch', width: 60, height: 60, colorCount: 24 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ConverterComponent', () => {
  let fixture: ComponentFixture<ConverterComponent>;
  let component: ConverterComponent;
  let conversionsApi: { create: jest.Mock; get: jest.Mock };
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL = jest.fn();

    conversionsApi = { create: jest.fn(), get: jest.fn() };
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ConverterComponent],
      providers: [
        { provide: ConversionsApiService, useValue: conversionsApi },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConverterComponent);
    fixture.componentRef.setInput('projectId', 'proj-1');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts in the select phase', () => {
    expect(component['phase']()).toBe('select');
  });

  it('moves to the configure phase and creates a preview URL on file selection', () => {
    const file = new File(['data'], 'cat.png', { type: 'image/png' });
    component.onFilesSelected([file]);

    expect(component['phase']()).toBe('configure');
    expect(component['selectedFile']()).toBe(file);
    expect(component['previewUrl']()).toBe('blob:mock');
  });

  it('revokes the previous preview URL when a new file is selected', () => {
    component.onFilesSelected([new File(['a'], 'a.png', { type: 'image/png' })]);
    component.onFilesSelected([new File(['b'], 'b.png', { type: 'image/png' })]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('reset() clears the selection and revokes the preview URL', () => {
    component.onFilesSelected([new File(['a'], 'a.png', { type: 'image/png' })]);
    component.reset();

    expect(component['phase']()).toBe('select');
    expect(component['selectedFile']()).toBeNull();
    expect(component['previewUrl']()).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('sends the configured settings and the bound projectId when starting conversion', () => {
    conversionsApi.create.mockReturnValueOnce(of({ jobId: 'job-1' }));
    conversionsApi.get.mockReturnValue(of(makeJob())); // keeps polling indefinitely in this test

    component.onFilesSelected([new File(['a'], 'a.png', { type: 'image/png' })]);
    component['targetType'].set('diamond');
    component['width'].set(80);
    component['height'].set(90);
    component['colorCount'].set(15);
    component.startConversion();

    expect(conversionsApi.create).toHaveBeenCalledWith(
      'proj-1',
      expect.any(File),
      { targetType: 'diamond', width: 80, height: 90, colorCount: 15 },
    );
    expect(component['phase']()).toBe('converting');
  });

  it('shows an error and switches to the failed phase if starting the upload fails', () => {
    conversionsApi.create.mockReturnValueOnce(throwError(() => new Error('network down')));
    component.onFilesSelected([new File(['a'], 'a.png', { type: 'image/png' })]);

    component.startConversion();

    expect(component['phase']()).toBe('failed');
    expect(component['errorMessage']()).toContain('try again');
  });

  it('polls until the job completes, then navigates to the resulting pattern', fakeAsync(() => {
    conversionsApi.create.mockReturnValueOnce(of({ jobId: 'job-1' }));
    conversionsApi.get.mockReturnValue(of(makeJob({ status: 'completed', progress: 100, resultPatternId: 'pattern-9' })));

    component.onFilesSelected([new File(['a'], 'a.png', { type: 'image/png' })]);
    component.startConversion();
    tick(POLL_INTERVAL_MS);

    expect(router.navigate).toHaveBeenCalledWith(['/editor', 'pattern-9']);
    tick(POLL_INTERVAL_MS * 5); // drain any further scheduled timers so the test can finish cleanly
  }));

  it('shows the job error and switches to the failed phase when the job fails', fakeAsync(() => {
    conversionsApi.create.mockReturnValueOnce(of({ jobId: 'job-1' }));
    conversionsApi.get.mockReturnValue(of(makeJob({ status: 'failed', error: 'Unsupported image' })));

    component.onFilesSelected([new File(['a'], 'a.png', { type: 'image/png' })]);
    component.startConversion();
    tick(POLL_INTERVAL_MS);

    expect(component['phase']()).toBe('failed');
    expect(component['errorMessage']()).toBe('Unsupported image');
    tick(POLL_INTERVAL_MS * 5);
  }));
});
