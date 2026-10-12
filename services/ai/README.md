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

- `GET /vision-advice/status` → `{ "enabled": bool, "model": str }`
- `POST /vision-advice` (multipart `file`, `target_type`, `width`, `height`,
  `color_count`) → an AI second opinion on how well the photo will turn into
  a pattern: `{ subject, verdict, summary, keep[], lose[], tips[] }`.
  Uses Claude (`claude-opus-5-5` by default; override with
  `VISION_ADVISOR_MODEL`) through the official `anthropic` SDK, with
  structured JSON output and the API's safety fallback. **Off unless
  `VISION_ADVISOR_ENABLED=1`** - it sends the photo (shrunk to 1024 px) to
  Anthropic, so whoever runs the service has to opt in. Credentials come
  from `ANTHROPIC_API_KEY` (or an `ant auth login` profile). Errors come back
  as plain-language `detail` messages: 503 when not enabled or no
  credentials, 429 when rate limited, 422 when the model declined or gave no
  usable answer. The converter only shows its "Ask AI" button when the
  status endpoint says it's enabled, and only calls it when the user clicks.

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

The vision advice tests use a fake Anthropic client (no network, no key);
they check the exact request sent and every failure path, including what
happens with the feature on but no credentials.

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
