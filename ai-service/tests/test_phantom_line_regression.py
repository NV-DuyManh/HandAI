"""
Regression test for PHANTOM/DUPLICATE LINE FIX.
Bug: 8-line Vietnamese handwriting page detected as 9 lines.
Root cause: Tiny ink residue between stanzas created a runt band (9px)
  in compute_global_row_proposals, producing a false 9th line proposal.
Fix: Runt-band absorption pass in compute_global_row_proposals merges
  bands shorter than median_h * 0.7 into nearest neighbor.
"""
import pytest
import cv2
import os
import numpy as np
from app.api.ocr import detect_text_lines
from app.api.generalized_pipeline import clear_detection_cache
from app.api.generalized import compute_global_row_proposals, extract_ink_mask


REAL_FIXTURE = os.path.join(
    os.path.dirname(__file__), "fixtures", "ocr_eval", "OWNER_POEM_8_LINES.png"
)

def _find_real_photo():
    candidates = [
        os.path.join(os.path.dirname(__file__), "fixtures", "real_hw", "OWNER_POEM_8_LINES_REAL.png"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scratch/runtime6_live_input/decoded_input.png")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def test_phantom_01_synthetic_8_lines_exact():
    """PHANTOM-01: synthetic 8-line poem -> exactly 8 lines"""
    if not os.path.exists(REAL_FIXTURE):
        pytest.skip("Fixture not found")
    bgr = cv2.imdecode(np.frombuffer(open(REAL_FIXTURE, "rb").read(), np.uint8), cv2.IMREAD_COLOR)
    clear_detection_cache()
    lines, diag = detect_text_lines(bgr)
    assert len(lines) == 8, f"Expected 8 lines, got {len(lines)}"


def test_phantom_02_real_photo_8_lines():
    """PHANTOM-02: Owner real photo with 8 handwritten lines -> exactly 8 lines"""
    live = _find_real_photo()
    if not live:
        pytest.skip("Real photo fixture not found")
    bgr = cv2.imdecode(np.frombuffer(open(live, "rb").read(), np.uint8), cv2.IMREAD_COLOR)
    clear_detection_cache()
    lines, diag = detect_text_lines(bgr)
    assert len(lines) == 8, f"Expected 8 lines from real photo, got {len(lines)}"


def test_phantom_03_runt_band_absorbed():
    """PHANTOM-03: runt band (< median_h * 0.7) is absorbed into neighbor"""
    # Create image with one strong row and one tiny ink fragment below
    img = np.full((200, 400, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Main text row", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
    # Tiny isolated accent/noise fragment at y=130 (just a 3px dot)
    cv2.circle(img, (100, 130), 2, (0, 0, 0), -1)
    cv2.circle(img, (120, 131), 2, (0, 0, 0), -1)
    clear_detection_cache()
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1, f"Runt fragment should not create a 2nd line, got {len(lines)}"


def _create_mock_row(img, y, h=35, w_offset=50, w_len=400, ink_color=(0, 0, 0)):
    """Draw scattered connected components to simulate a handwriting row."""
    for x in range(w_offset, w_offset + w_len, 25):
        cv2.circle(img, (x + np.random.randint(-5, 5), y + h // 2 + np.random.randint(-3, 3)),
                   np.random.randint(2, 6), ink_color, -1)
        cv2.line(img, (x, y + h // 4), (x + 10, y + h - h // 4), ink_color, 2)
    return img


def test_phantom_04_stanza_gap_no_phantom():
    """PHANTOM-04: two stanzas with large gap + noise in gap -> no phantom line"""
    np.random.seed(42)
    img = np.full((700, 600, 3), 255, dtype=np.uint8)
    # Stanza 1: 4 lines
    for y in [50, 120, 190, 260]:
        img = _create_mock_row(img, y=y, h=35)
    # Large stanza gap (~100px)
    # Stanza 2: 4 lines
    for y in [400, 470, 540, 610]:
        img = _create_mock_row(img, y=y, h=35)
    # Add tiny noise in the gap (simulating graph paper residue)
    cv2.circle(img, (200, 330), 2, (0, 0, 0), -1)
    clear_detection_cache()
    lines, _ = detect_text_lines(img)
    assert len(lines) == 8, f"Expected 8 lines, got {len(lines)}"


def test_phantom_05_real_photo_bands_count():
    """PHANTOM-05: real Owner photo produces exactly 8 global bands (no runt)"""
    live = _find_real_photo()
    if not live:
        pytest.skip("Real photo fixture not found")
    from app.api.ocr import correct_skew
    bgr = cv2.imdecode(np.frombuffer(open(live, "rb").read(), np.uint8), cv2.IMREAD_COLOR)
    bgr = correct_skew(bgr, max_angle=10.0)
    h, w = bgr.shape[:2]
    mask, _ = extract_ink_mask(bgr, h, w, profile="PROFILE_A")
    raw_cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    heights = [cv2.boundingRect(c)[3] for c in raw_cnts if cv2.contourArea(c) > 5]
    median_h = float(np.median(heights)) if heights else 15.0
    bands = compute_global_row_proposals(mask, median_h)
    assert len(bands) == 8, f"Expected 8 bands, got {len(bands)}: {bands}"
    # No band should be shorter than the runt threshold
    runt_threshold = max(10, int(median_h * 0.7))
    for b in bands:
        assert (b[1] - b[0]) >= runt_threshold, f"Runt band found: {b}, h={b[1]-b[0]}"


def test_phantom_06_real_photo_line_count_and_overlap_summary():
    """PHANTOM-06: real photo -> exactly 8 lines, strictly non-nested geometry (containment < 25%)"""
    live = _find_real_photo()
    if not live:
        pytest.skip("Real photo fixture not found")
    bgr = cv2.imdecode(np.frombuffer(open(live, "rb").read(), np.uint8), cv2.IMREAD_COLOR)
    clear_detection_cache()
    lines, _ = detect_text_lines(bgr)
    assert len(lines) == 8, f"Expected 8 lines from real photo, got {len(lines)}"
    # Verify strictly ascending order
    for i in range(1, len(lines)):
        assert lines[i].y >= lines[i-1].y, (
            f"Lines not sorted: L{i}(y={lines[i-1].y}) > L{i+1}(y={lines[i].y})"
        )
    # Verify strict non-containment (R2 geometry fix)
    for i in range(len(lines) - 1):
        l1, l2 = lines[i], lines[i + 1]
        v_ov = max(0, min(l1.y + l1.height, l2.y + l2.height) - max(l1.y, l2.y))
        cont = v_ov / min(l1.height, l2.height)
        assert cont < 0.25, f"Excessive containment between L{i+1} and L{i+2}: {cont:.2f} >= 0.25"

