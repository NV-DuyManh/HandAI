import pytest
import cv2
import os
import sys
import numpy as np
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.api.ocr import detect_text_lines, HW_LINE_DETECTOR_VERSION, run_grid_handwriting_detection
from app.schemas.ocr_pilot import LineBox
from app.main import app
from app.config import settings

def find_fixture_path():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png")),
        r"C:\Users\Admin\.gemini\antigravity-ide\brain\52d84899-536e-42a4-a843-a17129ed4141\scratch\OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def test_physical_graph_handwriting_fixture_detects_four_rows():
    fixture_path = find_fixture_path()
    if not fixture_path or not os.path.exists(fixture_path):
        pytest.skip("Physical fixture not found locally in candidate paths")
        
    with open(fixture_path, "rb") as f:
        buf = np.frombuffer(f.read(), dtype=np.uint8)
        bgr_image = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    assert bgr_image is not None
    height = bgr_image.shape[0]
    
    # Calls the unified production function used by /detect-lines
    lines, diagnostics = detect_text_lines(bgr_image)
    
    # Save debug image
    debug_img = bgr_image.copy()
    for l in lines:
        cv2.rectangle(debug_img, (l.x, l.y), (l.x+l.width, l.y+l.height), (0,255,0), 2)
    cv2.imwrite("debug_physical_test.jpg", debug_img)

    assert diagnostics["detector_version"] == "generalized-20260914"
    assert diagnostics["final_box_count"] == 4
    assert len(lines) == 4
    
    # strictly ascending y
    for i in range(1, 4):
        assert lines[i].y > lines[i-1].y
        
    # check no line is a giant box (> 40% height)
    for l in lines:
        assert l.height < height * 0.4


def test_mandatory_api_path_b_response_serialization():
    """
    Requirement 13: Mandatory API test:
    Path A = []
    Path B = 4 boxes
    Expected HTTP response = exactly 4 boxes.
    """
    client = TestClient(app)
    headers = {
        "X-Internal-API-Key": settings.internal_api_key,
        "Content-Type": "image/png"
    }

    mock_path_b_lines = [
        LineBox(line_id="line_1", x=10, y=20, width=200, height=30, order=1),
        LineBox(line_id="line_2", x=10, y=70, width=200, height=30, order=2),
        LineBox(line_id="line_3", x=10, y=120, width=200, height=30, order=3),
        LineBox(line_id="line_4", x=10, y=170, width=200, height=30, order=4),
    ]
    mock_path_b_diag = {
        "chromatic_cluster_found": True,
        "dominant_hue": 118,
        "bands_detected": 4,
        "final_boxes": 4
    }

    # Generate small dummy PNG bytes
    dummy_img = np.full((300, 300, 3), 255, dtype=np.uint8)
    _, png_bytes = cv2.imencode(".png", dummy_img)

    with patch("app.api.generalized_pipeline.run_generalized_line_detection", return_value=(mock_path_b_lines, mock_path_b_diag)):
        response = client.post(
            "/internal/v1/ocr/detect-lines",
            content=png_bytes.tobytes(),
            headers=headers
        )

    assert response.status_code == 200
    data = response.json()
    assert data["detector_version"] == HW_LINE_DETECTOR_VERSION
    assert "lines" in data
    assert len(data["lines"]) == 4
    assert [l["line_id"] for l in data["lines"]] == ["line_1", "line_2", "line_3", "line_4"]
