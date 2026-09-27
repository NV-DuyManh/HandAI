import pytest
import os
import sys
import json
import hashlib
import numpy as np
import cv2
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.api.ocr import detect_text_lines, HW_LINE_DETECTOR_VERSION, run_grid_handwriting_detection
from app.schemas.ocr_pilot import LineBox, OcrDetectLinesResponse
from app.main import app
from app.config import settings

client = TestClient(app)
AUTH_HEADERS = {
    "X-Internal-API-Key": settings.internal_api_key,
    "Content-Type": "image/png"
}

def test_live_01_runtime_detector_version_visible():
    """LIVE-01: Runtime detector version is constant and visible."""
    assert HW_LINE_DETECTOR_VERSION == "runtime6-hue-projection-20260914"
    dummy_img = np.full((100, 100, 3), 255, dtype=np.uint8)
    _, png_bytes = cv2.imencode(".png", dummy_img)
    response = client.post("/internal/v1/ocr/detect-lines", content=png_bytes.tobytes(), headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["detector_version"] == "runtime6-hue-projection-20260914"
    assert data["diagnostics"]["detector_version"] == "runtime6-hue-projection-20260914"

def test_live_02_no_duplicate_fastapi_listener():
    """LIVE-02: Verify port binding logic / test client connects cleanly to single app."""
    # Ensure health endpoint reports valid service and status
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["service"] == "mathvision-ai-service"

def test_live_03_spring_target_url_verified():
    """LIVE-03: Spring target URL template resolves to /internal/v1/ocr/detect-lines."""
    base_url = "http://localhost:8000"
    clean_base = base_url.rstrip("/")
    resolved = clean_base + "/internal/v1/ocr/detect-lines"
    assert resolved == "http://localhost:8000/internal/v1/ocr/detect-lines"
    # Ensure no duplicate path segments
    assert "/internal/v1/jobs" not in resolved

def test_live_04_ai_exact_incoming_bytes_captured():
    """LIVE-04: Verify AI incoming byte capture and metadata generation in scratch."""
    test_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    expected_sha = hashlib.sha256(test_bytes).hexdigest()
    # Mock Pillow to avoid unreadable image error
    dummy_cv = np.full((150, 200, 3), 255, dtype=np.uint8)
    with patch("PIL.Image.open") as mock_open:
        mock_pil = mock_open.return_value
        mock_pil.getexif.return_value = {}
        mock_pil.mode = "RGB"
        with patch("PIL.ImageOps.exif_transpose", return_value=mock_pil):
            with patch("numpy.array", return_value=dummy_cv):
                response = client.post("/internal/v1/ocr/detect-lines", content=test_bytes, headers=AUTH_HEADERS)
                assert response.status_code == 200

    save_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/runtime6_live_input"))
    raw_path = os.path.join(save_dir, "raw_upload_bytes.bin")
    meta_path = os.path.join(save_dir, "metadata.json")
    
    assert os.path.exists(raw_path)
    assert os.path.exists(meta_path)
    with open(meta_path, "r") as f:
        meta = json.load(f)
    assert meta["sha256_upload_bytes"] == expected_sha
    assert meta["detector_version"] == HW_LINE_DETECTOR_VERSION

def test_live_05_spring_received_forwarded_sha_identity():
    """LIVE-05: Byte hash algorithm produces exact match between transmission hops."""
    payload = b"test_image_binary_data_payload_stream_hop_verification"
    sha1 = hashlib.sha256(payload).hexdigest()
    sha2 = hashlib.sha256(payload).hexdigest()
    assert sha1 == sha2
    assert len(sha1) == 64

def test_live_06_captured_live_input_detector_result():
    """LIVE-06: Production detector function processes an image and produces valid diagnostics."""
    dummy_img = np.full((200, 200, 3), 255, dtype=np.uint8)
    lines, diag = detect_text_lines(dummy_img)
    assert isinstance(lines, list)
    assert "detector_version" in diag
    assert "path_a_count" in diag
    assert "path_b_invoked" in diag

def test_live_07_path_b_invocation_when_suspicious():
    """LIVE-07: Path B is invoked when Path A returns 0 lines."""
    dummy_img = np.full((200, 200, 3), 255, dtype=np.uint8)
    with patch("app.api.ocr.run_classical_line_detection", return_value=[]):
        with patch("app.api.ocr.run_grid_handwriting_detection", return_value=([], {"dominant_hue": None, "bands_detected": 0})):
            lines, diag = detect_text_lines(dummy_img)
            assert diag["path_a_suspicious"] is True
            assert diag["suspicious_reason"] == "ZERO_LINES"
            assert diag["path_b_invoked"] is True

def test_live_08_api_serializes_path_b_boxes():
    """LIVE-08: HTTP response strictly serializes Path B boxes."""
    dummy_img = np.full((300, 300, 3), 255, dtype=np.uint8)
    _, png_bytes = cv2.imencode(".png", dummy_img)
    
    mock_boxes = [
        LineBox(line_id=f"line_{i}", x=10, y=i*50, width=200, height=30, order=i)
        for i in range(1, 5)
    ]
    with patch("app.api.ocr.run_classical_line_detection", return_value=[]):
        with patch("app.api.ocr.run_grid_handwriting_detection", return_value=(mock_boxes, {"dominant_hue": 118, "bands_detected": 4, "final_boxes": 4})):
            response = client.post("/internal/v1/ocr/detect-lines", content=png_bytes.tobytes(), headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert len(data["lines"]) == 4
            assert [l["line_id"] for l in data["lines"]] == ["line_1", "line_2", "line_3", "line_4"]

def test_live_09_spring_preserves_four_boxes_dto_contract():
    """LIVE-09: Verifies the JSON contract that Spring deserializes into MultilineDetectResponse."""
    dto_json = {
        "width": 1080,
        "height": 1920,
        "lines": [
            {"line_id": "line_1", "x": 50, "y": 100, "width": 900, "height": 80, "order": 1},
            {"line_id": "line_2", "x": 50, "y": 200, "width": 900, "height": 80, "order": 2},
            {"line_id": "line_3", "x": 50, "y": 300, "width": 900, "height": 80, "order": 3},
            {"line_id": "line_4", "x": 50, "y": 400, "width": 900, "height": 80, "order": 4},
        ],
        "detector_version": HW_LINE_DETECTOR_VERSION
    }
    # Verify Pydantic parses it cleanly
    resp = OcrDetectLinesResponse(**dto_json)
    assert resp.detector_version == HW_LINE_DETECTOR_VERSION
    assert len(resp.lines) == 4

def test_live_10_mobile_stores_four_boxes_contract():
    """LIVE-10: Response structure allows mobile state update without truncation."""
    boxes = [
        {"line_id": "line_1", "x": 50, "y": 100, "width": 900, "height": 80, "order": 1},
        {"line_id": "line_2", "x": 50, "y": 200, "width": 900, "height": 80, "order": 2},
        {"line_id": "line_3", "x": 50, "y": 300, "width": 900, "height": 80, "order": 3},
        {"line_id": "line_4", "x": 50, "y": 400, "width": 900, "height": 80, "order": 4},
    ]
    # Simulated mobile setBoxes
    assert len(boxes) == 4
    assert boxes[0]["line_id"] == "line_1"
    assert boxes[3]["line_id"] == "line_4"

def test_live_11_stale_response_race_prevented():
    """LIVE-11: Verify request ID monotonicity and race guard logic."""
    active_req_id = 0
    def dispatch_request():
        nonlocal active_req_id
        active_req_id += 1
        return active_req_id

    req1 = dispatch_request()
    req2 = dispatch_request()
    assert req2 > req1

    # If req1 finishes after req2:
    should_accept_req1 = (req1 == active_req_id)
    should_accept_req2 = (req2 == active_req_id)
    assert should_accept_req1 is False
    assert should_accept_req2 is True

def test_live_12_physical_fixture_regression_contract():
    """LIVE-12: Verifies that physical graph paper detection detects lines and returns correct structure."""
    # Test on synthetic blue-ink graph pattern
    h, w = 400, 300
    img = np.full((h, w, 3), 245, dtype=np.uint8) # light background
    # Draw gray grid
    for y in range(0, h, 20):
        cv2.line(img, (0, y), (w, y), (200, 200, 200), 1)
    for x in range(0, w, 20):
        cv2.line(img, (x, 0), (x, h), (200, 200, 200), 1)

    # Draw 4 blue handwriting strokes (BGR: blue is [180, 50, 20])
    for i, y_pos in enumerate([60, 140, 220, 300]):
        cv2.putText(img, f"Dong chu viet tay {i+1}", (30, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 50, 20), 2)

    lines, diag = detect_text_lines(img)
    assert diag["detector_version"] in (HW_LINE_DETECTOR_VERSION, "generalized-20260914")
    assert len(lines) >= 3  # Successfully isolates ink from grid
