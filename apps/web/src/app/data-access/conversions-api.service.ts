import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnalyzeImageParams,
  ConversionJob,
  ImageAnalysis,
  VisionAdvice,
  VisionAdviceStatus,
} from '@stitchcraft/types';

import { ApiClient } from '@app/core/api/api-client.service';

export type CreateConversionParams = AnalyzeImageParams;

@Injectable({ providedIn: 'root' })
export class ConversionsApiService {
  private readonly api = inject(ApiClient);

  create(
    projectId: string,
    file: Blob,
    params: CreateConversionParams,
    fileName = file instanceof File ? file.name : 'photo.jpg',
  ): Observable<{ jobId: string }> {
    const formData = imageForm(file, fileName, params);
    formData.append('projectId', projectId);
    // HttpClient sets the multipart Content-Type (with boundary) automatically for a FormData body.
    return this.api.post<{ jobId: string }>('/conversions', formData);
  }

  /** The image advisor: how well this photo will stitch with these settings. */
  analyze(file: Blob, params: AnalyzeImageParams): Observable<ImageAnalysis> {
    return this.api.post<ImageAnalysis>(
      '/conversions/analyze',
      imageForm(file, file instanceof File ? file.name : 'photo.jpg', params),
    );
  }

  /** Whether the optional AI second opinion is switched on for this server. */
  visionAdviceStatus(): Observable<VisionAdviceStatus> {
    return this.api.get<VisionAdviceStatus>('/conversions/vision-advice/status');
  }

  /** AI second opinion on a photo - sends the photo to an outside model, so only on request. */
  visionAdvice(file: Blob, params: AnalyzeImageParams): Observable<VisionAdvice> {
    return this.api.post<VisionAdvice>(
      '/conversions/vision-advice',
      imageForm(file, file instanceof File ? file.name : 'photo.jpg', params),
    );
  }

  get(id: string): Observable<ConversionJob> {
    return this.api.get<ConversionJob>(`/conversions/${id}`);
  }
}

function imageForm(file: Blob, fileName: string, params: AnalyzeImageParams): FormData {
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('targetType', params.targetType);
  formData.append('width', String(params.width));
  formData.append('height', String(params.height));
  formData.append('colorCount', String(params.colorCount));
  if (params.enhance !== undefined) formData.append('enhance', String(params.enhance));
  if (params.cleanup !== undefined) formData.append('cleanup', String(params.cleanup));
  return formData;
}
