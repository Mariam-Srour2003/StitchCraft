import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def make_png_bytes(width: int = 10, height: int = 6, color=(255, 0, 0)) -> bytes:
    image = Image.new("RGB", (width, height), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_upscale_doubles_dimensions_by_default():
    response = client.post(
        "/upscale",
        files={"file": ("test.png", make_png_bytes(10, 6), "image/png")},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

    result = Image.open(io.BytesIO(response.content))
    assert result.size == (20, 12)


def test_upscale_respects_a_custom_scale_factor():
    response = client.post(
        "/upscale?scale=3",
        files={"file": ("test.png", make_png_bytes(10, 6), "image/png")},
    )
    assert response.status_code == 200
    result = Image.open(io.BytesIO(response.content))
    assert result.size == (30, 18)


def test_upscale_rejects_a_scale_outside_the_allowed_range():
    response = client.post(
        "/upscale?scale=10",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
    )
    assert response.status_code == 422  # FastAPI/Pydantic query validation


def test_upscale_rejects_an_empty_file():
    response = client.post("/upscale", files={"file": ("empty.png", b"", "image/png")})
    assert response.status_code == 400


def test_upscale_rejects_bytes_that_are_not_a_real_image():
    response = client.post("/upscale", files={"file": ("bad.png", b"not an image", "image/png")})
    assert response.status_code == 400


def test_background_removal_rejects_an_empty_file_or_degrades_gracefully():
    # Deliberately does not exercise a real removal call (which would
    # download rembg's model on first use). Two outcomes are both correct
    # here, depending on whether the optional rembg/onnxruntime dependency
    # happens to be installed in the environment running this test:
    # - installed: the empty-file guard runs and returns 400.
    # - not installed: the ImportError guard returns 503 (graceful
    #   degradation - see PLAN.md's "must work with zero AI config").
    # Either way the service must not crash (500) or hang.
    response = client.post("/background-removal", files={"file": ("empty.png", b"", "image/png")})
    assert response.status_code in (400, 503)
