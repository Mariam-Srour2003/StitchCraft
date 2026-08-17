# StitchCraft AI service

Optional FastAPI microservice for AI-assisted conversion steps. The main
app works fully without this running (see `AiProvider`/`NullAiProvider` in
`apps/api/src/modules/imaging`); this service is only consulted when
`AI_SERVICE_URL` is configured for `apps/api`.

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `POST /background-removal` (multipart `file`) → PNG with alpha
  transparency, via [rembg](https://github.com/danielgatis/rembg). Downloads
  its model (~176MB) from GitHub on first use if not already cached -
  requires network access the first time this endpoint is called.
- `POST /upscale` (multipart `file`, query `scale` 1-4, default 2) → PNG.
  **This is classical Lanczos resampling (Pillow), not a trained
  super-resolution model** - no pretrained weights are bundled or
  downloaded. Swapping in a real model (e.g. ESRGAN/EDSR via
  `cv2.dnn_superres`) only touches the `upscale` function in `app/main.py`;
  the route contract and the Nest-side `AiProvider` interface stay the same.

## Running locally

```sh
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

## Testing

```sh
pip install -r requirements-dev.txt
pytest
```

The background-removal success path (an actual `rembg.remove()` call) is
deliberately not exercised by the test suite - it would trigger that
~176MB model download on first run. The test suite does verify the route
degrades correctly (400 or 503, never a crash) without needing the model.

## Docker

```sh
docker build -t stitchcraft-ai .
docker run -p 8000:8000 stitchcraft-ai
```

See the root `docker-compose.yml` for wiring this in alongside the rest of
the stack (M6 adds an `ai` service there, disabled by default since it's
optional and has a large image due to `onnxruntime`).
