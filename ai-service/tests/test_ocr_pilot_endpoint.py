import io
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

client = TestClient(app)

EXPECTED_CHECKPOINT_SHA256 = "a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941"
EXPECTED_VOCAB_SHA256 = "6af4062e92e22cc91ece5198638e29a6ceec6cb92e3b12bd71deb4b874ac9e0d"

def _create_test_line_image(text: str = "123") -> bytes:
    """Create a synthetic single-line image for smoke testing."""
    img = Image.new("RGB", (300, 60), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def _create_multiline_page_image(lines) -> bytes:
    """Create a synthetic multi-line page image."""
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y_step = 500 // (len(lines) + 1)
    for idx, text in enumerate(lines, 1):
        draw.text((80, idx * y_step), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

# --- Single Line Recognition Endpoint Tests ---

def test_ocr_pilot_missing_api_key_rejected():
    img_bytes = _create_test_line_image("hôm nay trời nắng")
    response = client.post(
        "/internal/v1/ocr/recognize-line",
        content=img_bytes,
        headers={"Content-Type": "image/jpeg"},
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.text

def test_ocr_pilot_invalid_api_key_rejected():
    img_bytes = _create_test_line_image("hôm nay trời nắng")
    response = client.post(
        "/internal/v1/ocr/recognize-line",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": "wrong-key-invalid",
        },
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.text

def test_ocr_pilot_json_payload_rejected():
    response = client.post(
        "/internal/v1/ocr/recognize-line",
        json={"image_base64": "fakebase64"},
        headers={"X-Internal-API-Key": settings.internal_api_key},
    )
    assert response.status_code == 415

def test_ocr_pilot_recognize_line_raw_bytes_success():
    img_bytes = _create_test_line_image("hôm nay trời nắng")
    response = client.post(
        "/internal/v1/ocr/recognize-line",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "recognized_text" in data
    assert isinstance(data["recognized_text"], str)
    assert data["checkpoint_sha256"] == EXPECTED_CHECKPOINT_SHA256
    assert data["vocab_sha256"] == EXPECTED_VOCAB_SHA256
    assert data["model_name"] == "Vietnamese-Handwriting-OCR-Full"
    assert data["latency_ms"] >= 0
    assert data["preprocessing_version"] == "v1_resize_64x1024_imagenet"
    # Real CRNN confidence metric (0.0 to 1.0), not None and no fake 1.0
    assert data.get("confidence") is not None
    assert 0.0 <= data["confidence"] <= 1.0

def test_ocr_pilot_empty_image_rejected():
    response = client.post(
        "/internal/v1/ocr/recognize-line",
        content=b"",
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 400

def test_ocr_pilot_oversized_payload_rejected():
    # 11 MB payload exceeds 10 MB limit
    oversized = b"x" * (11 * 1024 * 1024)
    response = client.post(
        "/internal/v1/ocr/recognize-line",
        content=oversized,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 413

# --- Multi-Line Detect-Lines Endpoint Tests ---

def test_detect_lines_missing_api_key_rejected():
    img_bytes = _create_multiline_page_image(["Dòng 1", "Dòng 2"])
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/jpeg"},
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.text

def test_detect_lines_invalid_api_key_rejected():
    img_bytes = _create_multiline_page_image(["Dòng 1", "Dòng 2"])
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": "wrong-key",
        },
    )
    assert response.status_code == 401

def test_detect_lines_json_payload_rejected():
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        json={"page": "base64"},
        headers={"X-Internal-API-Key": settings.internal_api_key},
    )
    assert response.status_code == 415

def test_detect_lines_empty_image_rejected():
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=b"",
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 400

def test_detect_lines_oversized_payload_rejected():
    oversized = b"x" * (11 * 1024 * 1024)
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=oversized,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 413

def test_detect_lines_blank_page_returns_zero_lines():
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=buf.getvalue(),
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["width"] == 800
    assert data["height"] == 600
    assert len(data["lines"]) == 0

def test_detect_lines_three_lines_fixture():
    lines = ["hôm nay trời nắng", "Em yêu trường em", "Học tập thật tốt"]
    img_bytes = _create_multiline_page_image(lines)
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["width"] == 800
    assert data["height"] == 600
    assert len(data["lines"]) == 3
    # Verify deterministic ordering 1, 2, 3 and bounding boxes
    for idx, line in enumerate(data["lines"], 1):
        assert line["order"] == idx
        assert line["x"] >= 0 and line["y"] >= 0
        assert line["x"] + line["width"] <= 800
        assert line["y"] + line["height"] <= 600
        assert line["width"] > 20
        assert line["height"] > 10

def test_detect_lines_five_lines_fixture():
    lines = [f"Dòng thứ {i}" for i in range(1, 6)]
    img_bytes = _create_multiline_page_image(lines)
    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["lines"]) == 5
    for idx, line in enumerate(data["lines"], 1):
        assert line["order"] == idx
