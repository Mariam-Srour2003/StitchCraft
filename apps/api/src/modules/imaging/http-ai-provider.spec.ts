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
});
