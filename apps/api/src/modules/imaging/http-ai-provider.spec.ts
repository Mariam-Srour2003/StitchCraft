import type { ConfigService } from '@nestjs/config';

import { HttpAiProvider } from './http-ai-provider';

describe('HttpAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeProvider(aiServiceUrl: string | undefined): HttpAiProvider {
    const config = {
      get: (key: string) => (key === 'AI_SERVICE_URL' ? aiServiceUrl : undefined),
    } as ConfigService;
    return new HttpAiProvider(config);
  }

  describe('isConfigured', () => {
    it('is false when AI_SERVICE_URL is not set', () => {
      expect(makeProvider(undefined).isConfigured()).toBe(false);
    });

    it('is true when AI_SERVICE_URL is set', () => {
      expect(makeProvider('http://localhost:8000').isConfigured()).toBe(true);
    });
  });

  describe('removeBackground / upscale', () => {
    it('posts the image to the configured service and returns the response bytes', async () => {
      const responseBytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(responseBytes.buffer),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = makeProvider('http://localhost:8000');
      const result = await provider.removeBackground(Buffer.from('input-image-bytes'));

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8000/background-removal',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(Buffer.compare(result, Buffer.from(responseBytes))).toBe(0);
    });

    it('strips a trailing slash from AI_SERVICE_URL before building the request URL', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
      global.fetch = fetchMock as unknown as typeof fetch;

      await makeProvider('http://localhost:8000/').upscale(Buffer.from('x'));

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/upscale', expect.anything());
    });

    it('throws when the AI service responds with a non-ok status', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

      await expect(makeProvider('http://localhost:8000').upscale(Buffer.from('x'))).rejects.toThrow(
        '500',
      );
    });

    it('returns the input unchanged rather than throwing if called with no AI_SERVICE_URL configured', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const input = Buffer.from('unchanged');
      const result = await makeProvider(undefined).removeBackground(input);

      expect(result).toBe(input);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('vision advice', () => {
    const params = { targetType: 'cross_stitch' as const, width: 60, height: 45, colorCount: 24 };
    const json = (status: number, body: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    it('is unavailable without AI_SERVICE_URL, and never calls out', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;
      expect(await makeProvider(undefined).visionAdviceAvailable()).toBe(false);
      await expect(
        makeProvider(undefined).visionAdvice(Buffer.from('x'), params),
      ).rejects.toMatchObject({
        status: 503,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('asks the service whether it is enabled, and caches the answer', async () => {
      const fetchMock = jest.fn().mockResolvedValue(json(200, { enabled: true }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const provider = makeProvider('http://ai:8000');
      expect(await provider.visionAdviceAvailable()).toBe(true);
      expect(await provider.visionAdviceAvailable()).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('http://ai:8000/vision-advice/status');
    });

    it('treats an unreachable service as unavailable', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
      expect(await makeProvider('http://ai:8000').visionAdviceAvailable()).toBe(false);
    });

    it('forwards the photo and settings and returns the advice', async () => {
      const advice = {
        subject: 'a cat',
        verdict: 'good',
        summary: 's',
        keep: [],
        lose: [],
        tips: [],
      };
      const fetchMock = jest.fn().mockResolvedValue(json(200, advice));
      global.fetch = fetchMock as unknown as typeof fetch;
      expect(await makeProvider('http://ai:8000').visionAdvice(Buffer.from('img'), params)).toEqual(
        advice,
      );
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://ai:8000/vision-advice');
      const form = init.body as FormData;
      expect(form.get('target_type')).toBe('cross_stitch');
      expect(form.get('width')).toBe('60');
      expect(form.get('color_count')).toBe('24');
    });

    it("passes the service's own message and status on, mapping server errors to 502", async () => {
      const provider = makeProvider('http://ai:8000');
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(json(429, { detail: 'AI advice is busy - try again in a minute' }))
        .mockResolvedValueOnce(json(500, {}))
        .mockResolvedValueOnce(
          json(503, { detail: 'AI advice is not enabled on this deployment' }),
        ) as unknown as typeof fetch;
      await expect(provider.visionAdvice(Buffer.from('x'), params)).rejects.toMatchObject({
        status: 429,
        message: 'AI advice is busy - try again in a minute',
      });
      await expect(provider.visionAdvice(Buffer.from('x'), params)).rejects.toMatchObject({
        status: 502,
      });
      await expect(provider.visionAdvice(Buffer.from('x'), params)).rejects.toMatchObject({
        status: 503,
      });
    });
  });
});
