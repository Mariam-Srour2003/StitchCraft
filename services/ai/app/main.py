"""StitchCraft AI service.

Optional microservice for AI-assisted conversion steps (background removal,
upscaling), called by the NestJS API's `AiProvider` seam (see
apps/api/src/modules/imaging/ai-provider.ts) when AI_SERVICE_URL is
configured. The main app works fully without this service - see
PLAN.md's "must work with zero AI configuration" requirement.
"""

import io
import logging
from functools import lru_cache
from typing import Literal

import anthropic
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError

from app import vision_advice

app = FastAPI(title="StitchCraft AI Service", version="0.1.0")
logger = logging.getLogger("stitchcraft.ai")

MAX_UPSCALE = 4.0
MIN_UPSCALE = 1.0


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/background-removal")
async def remove_background(file: UploadFile = File(...)) -> Response:
    """Removes the background from an uploaded image, returning a PNG with alpha transparency."""
    try:
        from rembg import remove  # imported lazily so the app can still start if rembg/onnxruntime aren't installed
    except ImportError as exc:  # pragma: no cover - exercised only when the optional dep is missing
        raise HTTPException(status_code=503, detail="Background removal is not available on this deployment") from exc

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        result = remove(data)
    except Exception as exc:  # rembg raises plain Exceptions on decode failures
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}") from exc

    return Response(content=result, media_type="image/png")


@app.post("/upscale")
async def upscale(
    file: UploadFile = File(...),
    scale: float = Query(2.0, ge=MIN_UPSCALE, le=MAX_UPSCALE),
) -> Response:
    """Upscales an image via high-quality Lanczos resampling.

    This is classical resampling, not a trained super-resolution model -
    a real ESRGAN/EDSR model needs pretrained weights that can't be
    committed to this repo or downloaded in every deployment environment.
    Swapping in a real model later only touches this function; the
    AiProvider seam on the Nest side and this route's contract stay the same.
    """
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Could not read image") from exc

    new_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    upscaled = image.convert("RGBA").resize(new_size, Image.LANCZOS)

    buffer = io.BytesIO()
    upscaled.save(buffer, format="PNG")
    return Response(content=buffer.getvalue(), media_type="image/png")


@lru_cache(maxsize=1)
def anthropic_client() -> anthropic.Anthropic:
    """One client for the process; credentials come from the environment."""
    return anthropic.Anthropic()


@app.get("/vision-advice/status")
def vision_advice_status() -> dict:
    """Lets the API show the "ask AI" button only when it can work."""
    return {"enabled": vision_advice.enabled(), "model": vision_advice.model_name()}


@app.post("/vision-advice", response_model=vision_advice.VisionAdvice)
async def get_vision_advice(
    file: UploadFile = File(...),
    target_type: Literal["cross_stitch", "color_by_number", "diamond"] = Form(...),
    width: int = Form(..., ge=1, le=500),
    height: int = Form(..., ge=1, le=500),
    color_count: int = Form(..., ge=2, le=100),
    client: anthropic.Anthropic = Depends(anthropic_client),
) -> vision_advice.VisionAdvice:
    """An AI second opinion on how well a photo will turn into a pattern.

    Off unless VISION_ADVISOR_ENABLED is set: it sends the photo to Anthropic.
    """
    if not vision_advice.enabled():
        raise HTTPException(status_code=503, detail="AI advice is not enabled on this deployment")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        return vision_advice.advise(client, data, target_type, width, height, color_count)
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Could not read image") from exc
    except vision_advice.VisionAdviceUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except anthropic.AuthenticationError as exc:
        raise HTTPException(status_code=503, detail="AI advice is not configured (no valid credentials)") from exc
    except anthropic.RateLimitError as exc:
        raise HTTPException(status_code=429, detail="AI advice is busy - try again in a minute") from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"AI advice failed ({exc.status_code})") from exc
    except anthropic.APIConnectionError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the AI service") from exc
    except TypeError as exc:
        # The SDK raises a plain TypeError, not an API error, when it finds no
        # credentials at all (no ANTHROPIC_API_KEY, token or profile).
        if "authentication method" not in str(exc):
            raise
        logger.error("VISION_ADVISOR_ENABLED is set but no Anthropic credentials were found")
        raise HTTPException(
            status_code=503, detail="AI advice is not configured (no credentials)"
        ) from exc
