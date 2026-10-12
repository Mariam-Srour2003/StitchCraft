import base64
import io
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import vision_advice
from app.main import anthropic_client, app

GOOD = {
    "subject": "a woman in an orange spacesuit",
    "verdict": "fair",
    "summary": "Her face is small in the frame, so it will lose its features at 60 stitches.",
    "keep": ["the orange suit", "the flag", "the helmet", "one too many"],
    "lose": ["her expression"],
    "tips": ["Crop to her head and shoulders", "Use 30 colours", "a", "b", "c"],
}


class FakeMessages:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


def fake_client(stop_reason="end_turn", text=json.dumps(GOOD)):
    content = [] if text is None else [SimpleNamespace(type="text", text=text)]
    messages = FakeMessages(SimpleNamespace(stop_reason=stop_reason, content=content))
    return SimpleNamespace(beta=SimpleNamespace(messages=messages)), messages


def png(width=40, height=30, color=(200, 80, 20)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="PNG")
    return buffer.getvalue()


FORM = {"target_type": "cross_stitch", "width": "60", "height": "45", "color_count": "24"}


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("VISION_ADVISOR_ENABLED", "1")
    client, messages = fake_client()
    app.dependency_overrides[anthropic_client] = lambda: client
    yield TestClient(app), messages
    app.dependency_overrides.clear()


def post(test_client, data=None, form=FORM):
    return test_client.post(
        "/vision-advice", files={"file": ("p.png", data or png(), "image/png")}, data=form
    )


def test_status_reports_disabled_by_default(monkeypatch):
    monkeypatch.delenv("VISION_ADVISOR_ENABLED", raising=False)
    response = TestClient(app).get("/vision-advice/status")
    assert response.json() == {"enabled": False, "model": "claude-opus-5-5"}


def test_refuses_when_not_enabled(monkeypatch):
    monkeypatch.delenv("VISION_ADVISOR_ENABLED", raising=False)
    client, messages = fake_client()
    app.dependency_overrides[anthropic_client] = lambda: client
    try:
        response = post(TestClient(app))
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert messages.calls == []  # nothing was sent anywhere


def test_returns_advice_and_trims_lists(api):
    test_client, _ = api
    response = post(test_client)
    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == GOOD["subject"]
    assert body["verdict"] == "fair"
    assert len(body["keep"]) == 3
    assert len(body["tips"]) == 4


def test_request_shape(api):
    test_client, messages = api
    post(test_client)
    call = messages.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default"
    assert call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_config"]["format"]["schema"]["additionalProperties"] is False
    assert "temperature" not in call
    image, text = call["messages"][0]["content"]
    assert image["source"]["media_type"] == "image/jpeg"
    assert "60 stitches wide by 45 stitches tall" in text["text"]
    assert "24 colours" in text["text"]


def test_model_can_be_overridden(api, monkeypatch):
    monkeypatch.setenv("VISION_ADVISOR_MODEL", "claude-sonnet-5-5")
    test_client, messages = api
    post(test_client)
    assert messages.calls[0]["model"] == "claude-sonnet-5-5"


def test_names_the_craft_and_unit():
    text = vision_advice.settings_text("diamond", 80, 100, 30)
    assert "diamond painting" in text and "80 drills wide" in text


@pytest.mark.parametrize(
    "stop_reason,text",
    [("refusal", None), ("max_tokens", '{"subject": "a'), ("end_turn", None), ("end_turn", "not json"),
     ("end_turn", json.dumps({"subject": "x"}))],
)
def test_unusable_answers_become_422(monkeypatch, stop_reason, text):
    monkeypatch.setenv("VISION_ADVISOR_ENABLED", "1")
    client, _ = fake_client(stop_reason=stop_reason, text=text)
    app.dependency_overrides[anthropic_client] = lambda: client
    try:
        response = post(TestClient(app))
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 422


def test_missing_credentials_is_a_clear_503_not_a_crash(monkeypatch):
    import anthropic

    monkeypatch.setenv("VISION_ADVISOR_ENABLED", "1")
    for name in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("HOME", "/nonexistent")  # no `ant auth login` profile either
    real = anthropic.Anthropic()
    app.dependency_overrides[anthropic_client] = lambda: real
    try:
        response = post(TestClient(app))
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_rejects_bad_input(api):
    test_client, messages = api
    assert post(test_client, data=b"not an image").status_code == 400
    assert post(test_client, form={**FORM, "width": "0"}).status_code == 422
    assert post(test_client, form={**FORM, "target_type": "knitting"}).status_code == 422
    assert messages.calls == []


def test_prepare_image_shrinks_flattens_and_rotates():
    big = Image.new("RGBA", (3000, 1000), (255, 0, 0, 0))
    buffer = io.BytesIO()
    big.save(buffer, format="PNG")
    data, media = vision_advice.prepare_image(buffer.getvalue())
    out = Image.open(io.BytesIO(base64.b64decode(data)))
    assert media == "image/jpeg"
    assert max(out.size) == 1024
    assert out.getpixel((10, 10))[0] > 240  # transparent -> white, not black

    sideways = Image.new("RGB", (200, 100), (0, 0, 255))
    exif = sideways.getexif()
    exif[0x0112] = 6  # rotate 90 clockwise
    buffer = io.BytesIO()
    sideways.save(buffer, format="JPEG", exif=exif)
    data, _ = vision_advice.prepare_image(buffer.getvalue())
    assert Image.open(io.BytesIO(base64.b64decode(data))).size == (100, 200)
