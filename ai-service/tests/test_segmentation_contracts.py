import os
import cv2
import pytest
import numpy as np

from app.api.ocr import (
    detect_text_lines,
    run_classical_line_detection,
    run_grid_handwriting_detection,
    consolidate_line_boxes,
    compute_strong_body_bands,
    HW_LINE_DETECTOR_VERSION
)
from app.schemas.ocr_pilot import LineBox

def get_fixture_image():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png")),
        r"C:\Users\Admin\.gemini\antigravity-ide\brain\52d84899-536e-42a4-a843-a17129ed4141\scratch\OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png",
    ]
    for c in candidates:
        if os.path.exists(c):
            with open(c, "rb") as f:
                return cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_COLOR)
    return None


def test_seg_01_physical_4_row_fixture_exact_four_boxes():
    """SEG-01: physical 4-row fixture -> exactly 4 final boxes."""
    img = get_fixture_image()
    if img is None:
        pytest.skip("Physical fixture not found")
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4, f"Expected exactly 4 lines, got {len(lines)}"
    assert diag["final_box_count"] == 4
    for i in range(1, len(lines)):
        assert lines[i].y > lines[i-1].y


def test_seg_02_acute_grave_hook_tilde_accent_not_standalone():
    """SEG-02: acute/grave/hook/tilde accent does not become a line."""
    h, w = 200, 400
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    # Main body at y=100
    cv2.putText(img, "Toan hoc lop mot", (40, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Floating accents above vowels at y=75
    cv2.line(img, (80, 75), (90, 68), (0, 0, 0), 2)   # sắc
    cv2.line(img, (220, 68), (230, 75), (0, 0, 0), 2)  # huyền
    cv2.circle(img, (150, 72), 3, (0, 0, 0), -1)       # dot / hook
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1, f"Accents should attach to main row, got {len(lines)} lines"
    # The bounding box must encompass the accent marks above
    assert lines[0].y <= 75


def test_seg_03_dot_over_i_attaches_to_row():
    """SEG-03: dot over i attaches to row."""
    h, w = 150, 300
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    # Body of 'mini' at y=80
    cv2.putText(img, "mini", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Detached dots at y=55
    cv2.circle(img, (75, 55), 2, (0, 0, 0), -1)
    cv2.circle(img, (115, 55), 2, (0, 0, 0), -1)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1
    assert lines[0].y <= 58


def test_seg_04_punctuation_attaches_to_row():
    """SEG-04: punctuation attaches to row."""
    h, w = 150, 350
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Ket qua la: 25.", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1


def test_seg_05_circumflex_breve_horn_retained():
    """SEG-05: circumflex/breve/horn retained within crop bounds."""
    h, w = 180, 350
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Chu viet dep", (40, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Circumflex accent (nón) at y=68
    cv2.line(img, (70, 72), (75, 65), (0, 0, 0), 2)
    cv2.line(img, (75, 65), (80, 72), (0, 0, 0), 2)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1
    assert lines[0].y <= 70


def test_seg_06_tiny_noise_does_not_become_line():
    """SEG-06: tiny noise specks do not become lines."""
    h, w = 200, 350
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Dong duy nhat", (40, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Random tiny dust specks far away
    cv2.circle(img, (20, 20), 1, (0, 0, 0), -1)
    cv2.circle(img, (300, 180), 1, (0, 0, 0), -1)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1


def test_seg_07_nested_fragment_absorbed():
    """SEG-07: nested fragment absorbed into parent row."""
    h, w = 200, 400
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Bai tap 1: Tinh tong", (30, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Small number or stray stroke inside horizontal span of text
    cv2.circle(img, (120, 105), 3, (0, 0, 0), -1)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1


def test_seg_08_overlapping_same_row_boxes_consolidated():
    """SEG-08: overlapping same-row boxes consolidated."""
    h, w = 200, 400
    binary = np.zeros((h, w), dtype=np.uint8)
    # Simulate two words on the same baseline with vertical overlap
    binary[80:110, 30:150] = 255
    binary[82:112, 170:320] = 255
    boxes = [(30, 80, 120, 30), (170, 82, 150, 30)]
    consolidated = consolidate_line_boxes(boxes, binary, median_h=15.0, img_w=w, img_h=h)
    assert len(consolidated) == 1
    assert consolidated[0][2] >= 280  # spans across both words


def test_seg_09_adjacent_real_rows_remain_separate():
    """SEG-09: adjacent real rows remain separate."""
    h, w = 300, 400
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Dong thu nhat o tren", (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "Dong thu hai o giua", (30, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "Dong thu ba o duoi", (30, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 3


def test_seg_10_ascender_descender_overlap_does_not_merge():
    """SEG-10: ascender/descender overlap does not merge rows."""
    h, w = 250, 400
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    # Row 1 with long descender ('y')
    cv2.putText(img, "gay go ngay", (40, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Row 2 with tall ascender ('th')
    cv2.putText(img, "that tha thong", (40, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 2


def test_seg_11_short_legitimate_row_retained():
    """SEG-11: short legitimate row retained (e.g. 'Bài giải')."""
    h, w = 300, 400
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Bai giai", (120, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    cv2.putText(img, "12 + 5 = 17 (qua tao)", (40, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "Dap so: 17", (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    
    lines, _ = detect_text_lines(img)
    assert len(lines) == 3


def test_seg_12_long_cursive_row_remains_one_line():
    """SEG-12: long cursive row remains one line."""
    h, w = 200, 500
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Hoc sinh cham ngoan hoc gioi va nghe loi thay co", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1
    assert lines[0].width >= 400


def test_seg_13_graph_grid_creates_no_row():
    """SEG-13: pure graph grid lines create no row."""
    h, w = 300, 300
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    for y in range(0, h, 25):
        cv2.line(img, (0, y), (w, y), (210, 210, 210), 1)
    for x in range(0, w, 25):
        cv2.line(img, (x, 0), (x, h), (210, 210, 210), 1)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 0


def test_seg_14_full_page_duplicate_row_reduction():
    """SEG-14: full-page duplicate-row reduction keeps row count near actual row count."""
    h, w = 800, 500
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    # Draw 8 real rows
    for i in range(8):
        y = 70 + i * 85
        cv2.putText(img, f"Dong chu so {i+1} tren trang vo", (40, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        # Add accents and fragments
        cv2.circle(img, (100, y - 20), 2, (0, 0, 0), -1)
        cv2.circle(img, (250, y - 20), 2, (0, 0, 0), -1)
    
    lines, _ = detect_text_lines(img)
    # Must not explode to 25-30 lines
    assert 6 <= len(lines) <= 9


def test_seg_15_top_to_bottom_order():
    """SEG-15: lines are strictly ordered top-to-bottom with 1-based order index."""
    img = get_fixture_image()
    if img is None:
        pytest.skip("Physical fixture not found")
    lines, _ = detect_text_lines(img)
    assert len(lines) > 0
    for idx, l in enumerate(lines, 1):
        assert l.order == idx
        if idx > 1:
            assert l.y >= lines[idx-2].y


def test_seg_16_final_crop_preserves_accent_pixels():
    """SEG-16: final crop bounding boxes preserve accent pixels."""
    img = get_fixture_image()
    if img is None:
        pytest.skip("Physical fixture not found")
    lines, _ = detect_text_lines(img)
    # Row 3 has accents at y ~ 225..240 and descenders at y ~ 275..295
    row3 = lines[2]
    assert row3.y <= 228
    assert (row3.y + row3.height) >= 290


def test_seg_17_strong_band_final_count_consistency():
    """SEG-17: strong-band / final-box count consistency."""
    img = get_fixture_image()
    if img is None:
        pytest.skip("Physical fixture not found")
    lines, diag = detect_text_lines(img)
    assert abs(len(lines) - 4) <= 1


def test_seg_18_blank_page_returns_zero():
    """SEG-18: completely blank page returns 0 lines."""
    blank = np.full((400, 500, 3), 255, dtype=np.uint8)
    lines, diag = detect_text_lines(blank)
    assert len(lines) == 0
    assert diag["final_box_count"] == 0


def test_seg_19_isolated_satellite_away_from_rows_discarded():
    """SEG-19 / RUNTIME.8: isolated satellite away from real text rows is discarded, exactly 4 rows returned."""
    img = get_fixture_image()
    if img is None:
        pytest.skip("Physical fixture not found")
    # Simulate an isolated accent mark / satellite away from rows at y=15
    cv2.line(img, (50, 15), (72, 20), (120, 50, 40), 2)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4, f"Expected exactly 4 rows, got {len(lines)}"
    # Verify no tiny accent-only standalone box was emitted
    for l in lines:
        assert l.height >= 18
        assert l.width >= 50
