"""
Deterministic test suite for MATHVISION.KIDS.HANDWRITING-LINE-SEGMENTATION.GEOMETRY-R2
Contract tests:
TEST G1 — NESTED DUPLICATE
TEST G2 — GIANT TWO-ROW PARENT + VALID CHILDREN
TEST G3 — ADJACENT CLOSE REAL LINES
TEST G4 — DIACRITIC SATELLITE
TEST G5 — PADDED CROP BOUNDARIES
TEST G6 — STANZA GAP
TEST G7 — GRID/RULING
TEST G8 — UNKNOWN LINE COUNT (3, 5, 7 lines)
TEST G9 — OWNER 8-LINE STRICT GEOMETRY ACCEPTANCE
"""
import pytest
import os
import cv2
import numpy as np

from app.api.ocr import detect_text_lines
from app.api.generalized_pipeline import clear_detection_cache
from app.schemas.ocr_pilot import LineBox

OWNER_REAL_FIXTURE = os.path.join(
    os.path.dirname(__file__), "fixtures", "real_hw", "OWNER_POEM_8_LINES_REAL.png"
)


def _draw_synthetic_line(canvas, y, text="Dong chu mau tieng Viet", font_scale=0.7, thickness=2):
    cv2.putText(canvas, text, (30, y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness)
    return canvas


def test_g1_nested_duplicate():
    """TEST G1: A large proposal containing a smaller proposal with the same physical row -> one final line."""
    h, w = 300, 400
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    _draw_synthetic_line(canvas, y=120, text="Dong chu duy nhat")
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 1, f"Expected 1 line, got {len(lines)}"
    assert lines[0].y <= 120 <= (lines[0].y + lines[0].height)


def test_g2_giant_two_row_parent_plus_valid_children():
    """TEST G2: Two separate text rows must result in two distinct child boxes without a parent envelope."""
    h, w = 400, 500
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    _draw_synthetic_line(canvas, y=100, text="Dong thu nhat o tren")
    _draw_synthetic_line(canvas, y=250, text="Dong thu hai o duoi")
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 2, f"Expected 2 lines, got {len(lines)}"
    
    # Verify no box contains another
    l1, l2 = lines[0], lines[1]
    assert l1.y + l1.height <= l2.y + 10, "Lines overlap heavily or contain each other"
    assert l1.height < 150 and l2.height < 150, "Giant multi-row parent survived"


def test_g3_adjacent_close_real_lines():
    """TEST G3: Two adjacent physical rows with ascenders/descenders remain separate."""
    h, w = 300, 500
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    # Long descender 'y', 'g'
    _draw_synthetic_line(canvas, y=80, text="ngay thang troi qua gap gap")
    # Tall ascender 'th', 'h'
    _draw_synthetic_line(canvas, y=150, text="thong tha that tha thanh than")
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 2, f"Expected 2 separate lines, got {len(lines)}"
    assert lines[0].y + lines[0].height / 2.0 < lines[1].y + lines[1].height / 2.0
    
    # Overlap must be small (<= 20% containment)
    v_ov = max(0, min(lines[0].y + lines[0].height, lines[1].y + lines[1].height) - max(lines[0].y, lines[1].y))
    cont = v_ov / min(lines[0].height, lines[1].height)
    assert cont < 0.25, f"Containment too large between close lines: {cont:.2f}"


def test_g4_diacritic_satellite():
    """TEST G4: Detached upper diacritic cluster attaches to parent row, not standalone."""
    h, w = 250, 400
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    _draw_synthetic_line(canvas, y=140, text="Chu co dau rat ro rang")
    # Small diacritic mark at y=95 (detached ~15px above letters)
    cv2.circle(canvas, (100, 95), 3, (0, 0, 0), -1)
    cv2.circle(canvas, (180, 93), 3, (0, 0, 0), -1)
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 1, f"Satellite diacritic became false line, got {len(lines)} lines"
    assert lines[0].y <= 100, "Diacritic should be included in parent line crop"


def test_g5_padded_crop_boundaries():
    """TEST G5: Padding must not cause one final crop to contain an adjacent final crop."""
    h, w = 350, 500
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    _draw_synthetic_line(canvas, y=70, text="Hang so 1 can doan")
    _draw_synthetic_line(canvas, y=140, text="Hang so 2 can doan")
    _draw_synthetic_line(canvas, y=210, text="Hang so 3 can doan")
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 3, f"Expected 3 lines, got {len(lines)}"
    for i in range(len(lines) - 1):
        l1, l2 = lines[i], lines[i + 1]
        v_ov = max(0, min(l1.y + l1.height, l2.y + l2.height) - max(l1.y, l2.y))
        cont = v_ov / min(l1.height, l2.height)
        assert cont < 0.30, f"Lines {i+1} and {i+2} have excessive padding containment: {cont:.2f}"


def test_g6_stanza_gap():
    """TEST G6: Large stanza whitespace must remain a clean gap, not bridge two rows."""
    h, w = 600, 500
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    _draw_synthetic_line(canvas, y=70, text="Kho tho thu nhat dong 1")
    _draw_synthetic_line(canvas, y=140, text="Kho tho thu nhat dong 2")
    # Large 150px gap
    _draw_synthetic_line(canvas, y=340, text="Kho tho thu hai dong 1")
    _draw_synthetic_line(canvas, y=410, text="Kho tho thu hai dong 2")
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 4, f"Expected 4 lines, got {len(lines)}"
    
    # Verify clean gap between stanza 1 (line 2) and stanza 2 (line 3)
    gap = lines[2].y - (lines[1].y + lines[1].height)
    assert gap >= 50, f"Stanza gap was bridged or swallowed: gap={gap}px"


def test_g7_grid_ruling():
    """TEST G7: Notebook grid/ruling line must not become a final text row."""
    h, w = 300, 500
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    # Background grid lines (thin grey lines)
    for gy in range(20, h, 40):
        cv2.line(canvas, (0, gy), (w, gy), (210, 210, 210), 1)
    for gx in range(20, w, 40):
        cv2.line(canvas, (gx, 0), (gx, 0 + h), (210, 210, 210), 1)
        
    _draw_synthetic_line(canvas, y=95, text="Viet tren giay o ly dong 1")
    _draw_synthetic_line(canvas, y=175, text="Viet tren giay o ly dong 2")
    
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == 2, f"Grid lines generated false rows, expected 2 lines, got {len(lines)}"


@pytest.mark.parametrize("num_lines", [3, 5, 7])
def test_g8_unknown_line_count(num_lines):
    """TEST G8: Arbitrary synthetic 3, 5, and 7 line pages detect natural count with valid geometry."""
    h = 100 + num_lines * 70
    w = 500
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    for i in range(num_lines):
        _draw_synthetic_line(canvas, y=60 + i * 70, text=f"Dong van ban tu nhien so {i+1}")
        
    clear_detection_cache()
    lines, diag = detect_text_lines(canvas)
    
    assert len(lines) == num_lines, f"Expected {num_lines} lines, got {len(lines)}"
    
    # Check monotonic centerY and non-containment
    centers = [l.y + l.height / 2.0 for l in lines]
    for i in range(1, len(centers)):
        assert centers[i] > centers[i - 1], f"Centers not strictly increasing: {centers}"
        v_ov = max(0, min(lines[i-1].y + lines[i-1].height, lines[i].y + lines[i].height) - max(lines[i-1].y, lines[i].y))
        cont = v_ov / min(lines[i-1].height, lines[i].height)
        assert cont < 0.25, f"Containment too high: {cont:.2f}"


def test_g9_owner_8_line_strict_geometry_acceptance():
    """
    TEST G9: Strict Acceptance Criteria for OWNER_POEM_8_LINES_REAL.png.
    Pass criteria:
    1. Exactly 8 final boxes.
    2. Eight distinct physical rows represented one-to-one.
    3. No final box is >= 70% vertically contained inside another adjacent final box (max containment < 0.25).
    4. Max adjacent vertical IoU < 0.20.
    5. Adjacent centerY values are strictly monotonically increasing.
    6. No multi-row giant crop (every crop has one dominant handwriting row).
    """
    if not os.path.exists(OWNER_REAL_FIXTURE):
        pytest.skip(f"Fixture not found: {OWNER_REAL_FIXTURE}")
        
    img = cv2.imread(OWNER_REAL_FIXTURE)
    clear_detection_cache()
    lines, diag = detect_text_lines(img)
    
    # 1. Exactly 8 lines
    assert len(lines) == 8, f"Expected exactly 8 lines, got {len(lines)}"
    
    # 2. Strict CenterY Ordering
    centers = [l.y + l.height / 2.0 for l in lines]
    for i in range(1, len(centers)):
        assert centers[i] > centers[i - 1] + 30, (
            f"Centers not sufficiently separated: Line {i} ({centers[i-1]:.1f}) vs Line {i+1} ({centers[i]:.1f})"
        )
        
    # 3. No nested lines / controlled overlap
    for i in range(len(lines) - 1):
        l1, l2 = lines[i], lines[i + 1]
        v_ov = max(0, min(l1.y + l1.height, l2.y + l2.height) - max(l1.y, l2.y))
        v_union = max(l1.y + l1.height, l2.y + l2.height) - min(l1.y, l2.y)
        iou = v_ov / max(1, v_union)
        cont = v_ov / min(l1.height, l2.height)
        
        assert cont < 0.25, (
            f"Containment violation between Line {i+1} [y={l1.y}, h={l1.height}] "
            f"and Line {i+2} [y={l2.y}, h={l2.height}]: containment={cont:.2f} >= 0.25"
        )
        assert iou < 0.20, (
            f"IoU violation between Line {i+1} and Line {i+2}: IoU={iou:.2f} >= 0.20"
        )
        
    # 4. No multi-row crop
    for i, l in enumerate(lines):
        assert l.height < 250, f"Line {i+1} is a giant crop (height={l.height}px >= 250px)"
