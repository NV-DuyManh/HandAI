"""
Test suite for AI.HWTEXT.PHYSICAL.1 — Traceability and Observability (TRACE-01 to TRACE-10).
Validates end-to-end correlation ID handling, secret masking, CRNN recognition engine
transparency, segmentation/correction source attribution, and dev-only trace guards.
"""

import io
import pytest
import logging
from unittest.mock import patch
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

client = TestClient(app)

def _create_test_multiline_image(lines: list[str]) -> bytes:
    """Helper to create a synthetic multi-line image."""
    img = Image.new("RGB", (600, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y_step = 250 // (len(lines) + 1)
    for idx, text in enumerate(lines, 1):
        draw.text((40, idx * y_step), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_trace_01_request_id_preserved_end_to_end():
    """TRACE-01: Verify that incoming X-Request-ID is preserved and returned in diagnostics['requestId']."""
    test_req_id = "req_trace_android_physical_001"
    img_bytes = _create_test_multiline_image(["Dòng một", "Dòng hai"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": test_req_id,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "diagnostics" in data
    assert data["diagnostics"].get("requestId") == test_req_id


def test_trace_02_dev_trace_contains_no_api_keys(caplog):
    """TRACE-02: Verify that dev trace output contains no API keys or secret credentials."""
    caplog.set_level(logging.INFO)
    test_req_id = "req_trace_secret_check_002"
    img_bytes = _create_test_multiline_image(["Test bảo mật thông tin"])

    # Simulate settings with real or dummy key and enabled dev trace
    with patch.object(settings, "ocr_physical_trace_enabled", True), patch.object(settings, "groq_api_keys", "gsk_test_fake_secret_key_123456789"):
        response = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={
                "Content-Type": "image/jpeg",
                "X-Internal-API-Key": settings.internal_api_key,
                "X-Request-ID": test_req_id,
            },
        )
        assert response.status_code == 200

    log_text = caplog.text
    assert "[OCR-PHYSICAL]" in log_text
    assert "gsk_test_fake_secret_key" not in log_text
    assert "secret-key-default" not in log_text
    assert "Authorization" not in log_text


def test_trace_03_dev_trace_contains_no_image_base64(caplog):
    """TRACE-03: Verify that dev trace output contains no image base64 strings or raw binary dumps."""
    caplog.set_level(logging.INFO)
    test_req_id = "req_trace_base64_check_003"
    img_bytes = _create_test_multiline_image(["Dòng chữ kiểm tra"])

    with patch.object(settings, "ocr_physical_trace_enabled", True):
        response = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={
                "Content-Type": "image/jpeg",
                "X-Internal-API-Key": settings.internal_api_key,
                "X-Request-ID": test_req_id,
            },
        )
        assert response.status_code == 200

    log_text = caplog.text
    assert "[OCR-PHYSICAL]" in log_text
    assert "data:image/" not in log_text
    assert ";base64," not in log_text
    assert "\\xff\\xd8\\xff" not in log_text  # JPEG magic bytes representation


def test_trace_04_crnn_engine_is_explicitly_shown():
    """TRACE-04: Verify that recognitionEngine='CRNN' is explicitly stated in diagnostics."""
    img_bytes = _create_test_multiline_image(["Chữ viết tay"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": "req_trace_crnn_engine_004",
        },
    )
    assert response.status_code == 200
    diag = response.json()["diagnostics"]
    assert diag.get("recognitionEngine") == "CRNN"


def test_trace_05_segmentation_source_shown():
    """TRACE-05: Verify segmentationSource is explicitly present ('LOCAL_CV' or 'LOCAL_CV_GROQ_ASSIST')."""
    img_bytes = _create_test_multiline_image(["Đoạn văn kiểm tra"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": "req_trace_seg_source_005",
        },
    )
    assert response.status_code == 200
    diag = response.json()["diagnostics"]
    assert diag.get("segmentationSource") in ("LOCAL_CV", "LOCAL_CV_GROQ_ASSIST")


def test_trace_06_correction_source_shown():
    """TRACE-06: Verify correctionSource is explicitly present ('NONE' or 'GROQ_POST_CORRECTION')."""
    img_bytes = _create_test_multiline_image(["Dòng một", "Dòng hai"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": "req_trace_corr_source_006",
        },
    )
    assert response.status_code == 200
    diag = response.json()["diagnostics"]
    assert diag.get("correctionSource") in ("NONE", "GROQ_POST_CORRECTION")


def test_trace_07_final_text_source_shown():
    """TRACE-07: Verify finalTextSource is explicitly present ('CRNN_RAW' or 'CRNN_PLUS_GROQ_CORRECTION')."""
    img_bytes = _create_test_multiline_image(["Em yêu mùa hè"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": "req_trace_final_text_007",
        },
    )
    assert response.status_code == 200
    diag = response.json()["diagnostics"]
    assert diag.get("finalTextSource") in ("CRNN_RAW", "CRNN_PLUS_GROQ_CORRECTION")


def test_trace_08_groq_call_count_shown():
    """TRACE-08: Verify groqCalls count is tracked in diagnostics."""
    img_bytes = _create_test_multiline_image(["Dòng kiểm tra groq calls"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": "req_trace_groq_calls_008",
        },
    )
    assert response.status_code == 200
    diag = response.json()["diagnostics"]
    assert "groqCalls" in diag
    assert isinstance(diag["groqCalls"], int)
    assert diag["groqCalls"] >= 0


def test_trace_09_raw_ocr_remains_visible_in_debug_mode():
    """TRACE-09: Verify rawOcrText remains intact on line items regardless of correction decisions."""
    img_bytes = _create_test_multiline_image(["Dòng 1 nguyên bản"])

    response = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={
            "Content-Type": "image/jpeg",
            "X-Internal-API-Key": settings.internal_api_key,
            "X-Request-ID": "req_trace_raw_ocr_009",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["lines"]) > 0
    for line in data["lines"]:
        assert "rawOcrText" in line
        assert line["rawOcrText"] is not None


def test_trace_10_trace_disabled_outside_development(caplog):
    """TRACE-10: Verify [OCR-PHYSICAL] trace logging is suppressed when ocr_physical_trace_enabled is False or app_env is production."""
    caplog.set_level(logging.INFO)
    img_bytes = _create_test_multiline_image(["Kiểm tra tắt trace"])

    # Case A: ocr_physical_trace_enabled = False
    with patch.object(settings, "ocr_physical_trace_enabled", False):
        response = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={
                "Content-Type": "image/jpeg",
                "X-Internal-API-Key": settings.internal_api_key,
                "X-Request-ID": "req_trace_disabled_010a",
            },
        )
        assert response.status_code == 200
    assert "[OCR-PHYSICAL]" not in caplog.text

    # Case B: app_env = "production" even if ocr_physical_trace_enabled = True
    caplog.clear()
    with patch.object(settings, "ocr_physical_trace_enabled", True), patch.object(settings, "app_env", "production"):
        response = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={
                "Content-Type": "image/jpeg",
                "X-Internal-API-Key": settings.internal_api_key,
                "X-Request-ID": "req_trace_disabled_010b",
            },
        )
        assert response.status_code == 200
    assert "[OCR-PHYSICAL]" not in caplog.text
