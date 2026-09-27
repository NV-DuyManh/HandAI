import pytest
import cv2
import os
import numpy as np
from app.api.ocr import detect_text_lines
from test_physical_regression import find_fixture_path

def test_merge_01_physical_fixture_exactly_4_boxes():
    fixture_path = find_fixture_path()
    if not fixture_path: pytest.skip("No fixture")
    with open(fixture_path, "rb") as f:
        bgr = cv2.imdecode(np.frombuffer(f.read(), dtype=np.uint8), cv2.IMREAD_COLOR)
    lines, _ = detect_text_lines(bgr)
    assert len(lines) == 4

def test_merge_02_first_two_physical_rows_separated():
    fixture_path = find_fixture_path()
    if not fixture_path: pytest.skip("No fixture")
    with open(fixture_path, "rb") as f:
        bgr = cv2.imdecode(np.frombuffer(f.read(), dtype=np.uint8), cv2.IMREAD_COLOR)
    lines, _ = detect_text_lines(bgr)
    # verify rows 1 and 2 don't overlap vertically too much, and are separate
    assert len(lines) == 4
    assert lines[0].y < lines[1].y

def test_merge_03_last_two_physical_rows_separated():
    fixture_path = find_fixture_path()
    if not fixture_path: pytest.skip("No fixture")
    with open(fixture_path, "rb") as f:
        bgr = cv2.imdecode(np.frombuffer(f.read(), dtype=np.uint8), cv2.IMREAD_COLOR)
    lines, _ = detect_text_lines(bgr)
    assert len(lines) == 4
    assert lines[2].y < lines[3].y

def test_merge_04_no_accent_standalone_line():
    fixture_path = find_fixture_path()
    if not fixture_path: pytest.skip()
    with open(fixture_path, "rb") as f:
        bgr = cv2.imdecode(np.frombuffer(f.read(), dtype=np.uint8), cv2.IMREAD_COLOR)
    lines, _ = detect_text_lines(bgr)
    for l in lines:
        assert l.height > 20

def test_merge_05_single_row_remains_single():
    img = np.full((150, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Single row", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1

def test_merge_06_close_neighboring_rows_remain_separate():
    img = np.full((200, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Row 1", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,0), 2)
    cv2.putText(img, "Row 2", (30, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 2

def test_merge_07_descenders_do_not_create_false_split():
    img = np.full((150, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "gay go ngay", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1

def test_merge_08_accents_do_not_create_false_split():
    img = np.full((150, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Chu viet dep", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.line(img, (70, 50), (75, 45), (0,0,0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1

def test_merge_09_tall_single_handwriting_row_not_split():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "GIANT", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 3.0, (0,0,0), 5)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1

def test_merge_10_two_strong_bands_in_one_candidate_trigger_split():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Row A", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.putText(img, "Row B", (30, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.line(img, (20, 80), (20, 180), (0,0,0), 3) # vertical line forcing them into 1 box initially
    lines, _ = detect_text_lines(img)
    assert len(lines) == 2

def test_merge_11_recursive_split_supports_3_plus_merged_rows():
    img = np.full((400, 300, 3), 255, dtype=np.uint8)
    for i in range(3):
        cv2.putText(img, f"Row {i}", (30, 100 + i*60), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.line(img, (20, 80), (20, 240), (0,0,0), 3)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 3

def test_merge_12_blank_0():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 0

def test_merge_13_short_legitimate_row_retained():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Bai giai", (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1

def test_merge_14_full_page_row_purity():
    img = np.full((800, 500, 3), 255, dtype=np.uint8)
    for i in range(8):
        cv2.putText(img, f"Row {i}", (40, 70 + i*85), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.line(img, (20, 50), (20, 700), (0,0,0), 3)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 8

def test_merge_15_top_to_bottom_ordering():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Row A", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.putText(img, "Row B", (30, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    lines, _ = detect_text_lines(img)
    assert lines[0].y < lines[1].y
    assert lines[0].order == 1
    assert lines[1].order == 2

def test_merge_16_each_final_crop_has_lte_1_strong_body_band():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Row A", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.putText(img, "Row B", (30, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    cv2.line(img, (20, 80), (20, 180), (0,0,0), 3)
    lines, _ = detect_text_lines(img)
    from app.api.ocr import compute_strong_body_bands
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    for l in lines:
        crop = binary[l.y:l.y+l.height, l.x:l.x+l.width]
        bands = compute_strong_body_bands(crop, 15.0, l.width, l.height)
        assert len(bands) <= 1

def test_merge_17_runtime_8_satellite_filtering_regression():
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Main text", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 2)
    # isolated tiny noise
    cv2.circle(img, (200, 20), 2, (0,0,0), -1)
    lines, _ = detect_text_lines(img)
    assert len(lines) == 1

def test_merge_18_no_max_lines_truncation_hack():
    # If 4 rows were found but truncation happened, this would be a hack. 
    # Just run the fixture again.
    fixture_path = find_fixture_path()
    if not fixture_path: pytest.skip()
    with open(fixture_path, "rb") as f:
        bgr = cv2.imdecode(np.frombuffer(f.read(), dtype=np.uint8), cv2.IMREAD_COLOR)
    lines, diag = detect_text_lines(bgr, max_lines=30)
    assert len(lines) == 4
    # Max lines is 30, it didn't truncate to 4.
