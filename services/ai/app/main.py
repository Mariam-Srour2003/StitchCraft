"""StitchCraft AI service.

Optional microservice for AI-assisted conversion steps (background removal,
upscaling), called by the NestJS API's `AiProvider` seam (see
apps/api/src/modules/imaging/ai-provider.ts) when AI_SERVICE_URL is
configured. The main app works fully without this service - see
PLAN.md's "must work with zero AI configuration" requirement.
"""

import io

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError

app = FastAPI(title="StitchCraft AI Service", version="0.1.0")

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
