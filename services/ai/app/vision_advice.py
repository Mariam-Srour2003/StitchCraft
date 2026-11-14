"""AI second opinion on a photo before it becomes a stitch pattern.

Claude looks at the photo together with the pattern settings and says, in
plain words, what the subject is and what will and won't survive being
turned into a grid of N x M stitches in K thread colours. It complements the
deterministic photo check in apps/api (sharpness, contrast, face size...),
which can measure things but can't say "the dog's face is in shadow" or
"the background is a busy crowd".

Off unless VISION_ADVISOR_ENABLED=1 - turning it on sends photos to
Anthropic's API. Credentials come from the environment the usual way
(ANTHROPIC_API_KEY, or an `ant auth login` profile).
"""

from __future__ import annotations

import base64
import io
import json
import os
from typing import Literal

import anthropic
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, ValidationError

DEFAULT_MODEL = "claude-opus-5-5"
# Long side of the copy sent to the model: plenty to judge a photo, few tokens.
MAX_SIDE = 1024

PatternType = Literal["cross_stitch", "color_by_number", "diamond"]

CRAFT_NAMES: dict[str, str] = {
    "cross_stitch": "a cross-stitch pattern",
    "color_by_number": "a paint-by-number canvas",
    "diamond": "a diamond painting",
}


class VisionAdvice(BaseModel):
    subject: str = Field(description="What the photo shows, in a few words.")
    verdict: Literal["great", "good", "fair", "poor"]
    summary: str = Field(description="One or two sentences: how well this will work and why.")
    keep: list[str] = Field(description="Up to 3 things that will come out well.")
    lose: list[str] = Field(description="Up to 3 things that will be lost or look wrong.")
    tips: list[str] = Field(description="Up to 4 concrete changes that would improve the result.")


class VisionAdviceUnavailable(Exception):
    """The model declined or returned nothing usable; the caller shows a polite message."""


# Hand-written rather than VisionAdvice.model_json_schema(): structured
# outputs want additionalProperties: false and every property required.
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "verdict": {"type": "string", "enum": ["great", "good", "fair", "poor"]},
        "summary": {"type": "string"},
        "keep": {"type": "array", "items": {"type": "string"}},
        "lose": {"type": "array", "items": {"type": "string"}},
        "tips": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["subject", "verdict", "summary", "keep", "lose", "tips"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You advise people who turn their own photos into needlework and craft patterns.

You will see the photo and the pattern settings. The photo gets shrunk to exactly the given number of stitches (or drills, or paint cells) across and down - one stitch per cell - and reduced to the given number of thread colours. Picture that result and judge it honestly.

What matters: whether the main subject is big enough in the frame to survive at that size (a face needs roughly 30 stitches top to bottom to look like the person; people far away in a photo become blobs), whether the subject stands out from the background, whether a busy background will turn into scattered single stitches, whether light and contrast will separate the colours, and whether the colour count suits the subject (skin, skies and gradients need more colours; logos and cartoons need few). For paint by number, also whether the areas will be big enough to paint.

Write for a hobbyist, not a photographer: short, specific, kind but honest. Each tip must be something they can do - crop to a named part of the photo, choose a bigger or smaller size, change the colour count, pick a photo with a plainer background or better light. Refer to things in the photo by what they are ("the cat's face", "the trees behind her"). Keep lists to the stated maximums; use an empty list rather than padding."""


def enabled() -> bool:
    return os.environ.get("VISION_ADVISOR_ENABLED", "").lower() in {"1", "true", "yes", "on"}


def model_name() -> str:
    return os.environ.get("VISION_ADVISOR_MODEL") or DEFAULT_MODEL


def prepare_image(data: bytes) -> tuple[str, str]:
    """Upright, flattened, at most MAX_SIDE on the long side, as base64 JPEG."""
    image = Image.open(io.BytesIO(data))
    image.load()
    # EXIF orientation, so a sideways-tagged phone photo is seen the right way up.
    image = ImageOps.exif_transpose(image)
    if image.mode != "RGB":
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.convert("RGBA").getchannel("A"))
        image = background
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=88)
    return base64.standard_b64encode(buffer.getvalue()).decode("ascii"), "image/jpeg"


def settings_text(target_type: str, width: int, height: int, color_count: int) -> str:
    craft = CRAFT_NAMES.get(target_type, "a stitch pattern")
    unit = "drills" if target_type == "diamond" else "cells" if target_type == "color_by_number" else "stitches"
    return (
        f"This photo will become {craft}: {width} {unit} wide by {height} {unit} tall, "
        f"using {color_count} colours. How well will it work, and what would make it better?"
    )


def advise(
    client: anthropic.Anthropic,
    data: bytes,
    target_type: str,
    width: int,
    height: int,
    color_count: int,
) -> VisionAdvice:
    image_b64, media_type = prepare_image(data)
    response = client.beta.messages.create(
        model=model_name(),
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        # If a safety classifier declines, the API retries on the recommended
        # fallback model inside the same call.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={
            "effort": "medium",
            "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
        },
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                    },
                    {"type": "text", "text": settings_text(target_type, width, height, color_count)},
                ],
            }
        ],
    )

    if response.stop_reason == "refusal":
        raise VisionAdviceUnavailable("The AI declined to comment on this photo.")
    if response.stop_reason == "max_tokens":
        raise VisionAdviceUnavailable("The AI's answer was cut off.")

    text = next((block.text for block in response.content if block.type == "text"), None)
    if not text:
        raise VisionAdviceUnavailable("The AI returned no advice.")
    try:
        advice = VisionAdvice.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise VisionAdviceUnavailable("The AI's answer could not be read.") from exc

    # The prompt asks for short lists; enforce it so the UI never overflows.
    return advice.model_copy(
        update={"keep": advice.keep[:3], "lose": advice.lose[:3], "tips": advice.tips[:4]}
    )
