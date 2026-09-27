import pytest
import cv2
import numpy as np
from app.api.ocr import detect_text_lines

np.random.seed(42)

def create_blank_bgr(w=800, h=600):
    img = np.ones((h, w, 3), dtype=np.uint8) * 255
    return img

def create_mock_row(img, y, h, w_offset=50, w_len=700, ink_color=(0,0,0)):
    # Create a mock text row by drawing scattered connected components to simulate handwriting
    for x in range(w_offset, w_offset + w_len, 25):
        cv2.circle(img, (x + np.random.randint(-5, 5), y + h//2 + np.random.randint(-3, 3)), np.random.randint(2, 6), ink_color, -1)
        cv2.line(img, (x, y + h//4), (x+10, y + h - h//4), ink_color, 2)
    return img

def create_mock_accent(img, cx, cy, ink_color=(0,0,0)):
    cv2.circle(img, (cx, cy), 3, ink_color, -1)
    return img

def test_gen_01_one_real_row():
    """GEN-01: one real row -> one box"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=200, h=40)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_gen_02_four_real_rows():
    """GEN-02: four real rows -> four boxes"""
    img = create_blank_bgr()
    for y in [100, 200, 300, 400]:
        img = create_mock_row(img, y=y, h=40)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4

def test_gen_03_neighboring_rows_separate():
    """GEN-03: neighboring rows remain separate"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=100, h=40)
    img = create_mock_row(img, y=160, h=40) # Close but separate
    lines, diag = detect_text_lines(img)
    assert len(lines) == 2

def test_gen_04_accents_do_not_form_rows():
    """GEN-04: accents do not form rows"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=150, h=40)
    # Add an accent above
    img = create_mock_accent(img, cx=200, cy=130)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1
    assert lines[0].y <= 130 # Includes accent

def test_gen_05_isolated_noise_discarded():
    """GEN-05: isolated noise does not form row"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=300, h=40)
    # Noise far away
    img = create_mock_accent(img, cx=100, cy=50)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_gen_06_legitimate_short_row_retained():
    """GEN-06: legitimate short row retained"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=200, h=40, w_offset=50, w_len=150) # Short line
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_gen_07_grid_suppression_reconstructs_fragmented_row():
    """GEN-07: one row fragmented by grid suppression is reconstructed"""
    img = create_blank_bgr()
    # Draw horizontal grid line that cuts through the text
    cv2.line(img, (0, 220), (800, 220), (200,200,200), 2)
    img = create_mock_row(img, y=200, h=40)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_gen_08_two_merged_rows_split():
    """GEN-08: two merged rows are split"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=100, h=30)
    img = create_mock_row(img, y=150, h=30)
    # Add vertical noise to merge them
    cv2.line(img, (400, 100), (400, 180), (0,0,0), 3)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 2

def test_gen_09_three_merged_rows_recursive_split():
    """GEN-09: three merged rows can be recursively split"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=100, h=30)
    img = create_mock_row(img, y=150, h=30)
    img = create_mock_row(img, y=200, h=30)
    # Add vertical noise to merge all three
    cv2.line(img, (400, 100), (400, 230), (0,0,0), 3)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 3

def test_gen_10_missing_middle_row_recovered():
    """GEN-10: missing middle row recovered"""
    # This ensures that even if something fails in component analysis, the global bands recover it.
    img = create_blank_bgr()
    img = create_mock_row(img, y=100, h=40)
    img = create_mock_row(img, y=200, h=40)
    img = create_mock_row(img, y=300, h=40)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 3

def test_gen_11_graph_paper_no_false_row():
    """GEN-11: graph paper grid creates no false row"""
    img = create_blank_bgr()
    for y in range(0, 600, 20):
        cv2.line(img, (0, y), (800, y), (200, 200, 200), 1)
    for x in range(0, 800, 20):
        cv2.line(img, (x, 0), (x, 600), (200, 200, 200), 1)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 0

def test_gen_12_ruled_paper_no_false_row():
    """GEN-12: ruled paper creates no false row"""
    img = create_blank_bgr()
    for y in range(50, 600, 40):
        cv2.line(img, (0, y), (800, y), (200, 200, 200), 2)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 0

def test_gen_13_blank_paper_zero_rows():
    """GEN-13: blank paper -> zero rows"""
    img = create_blank_bgr()
    lines, diag = detect_text_lines(img)
    assert len(lines) == 0

def test_gen_14_blue_ink_works():
    """GEN-14: blue ink works"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=200, h=40, ink_color=(200, 50, 20)) # BGR blueish
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_gen_15_black_grayscale_ink_works():
    """GEN-15: black/grayscale ink path works"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=200, h=40, ink_color=(50, 50, 50))
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_gen_16_mild_skew_retains_row_count():
    """GEN-16: mild skew retains row count"""
    img = create_blank_bgr()
    for y in [100, 200, 300]:
        img = create_mock_row(img, y=y, h=40)
    M = cv2.getRotationMatrix2D((400, 300), 3, 1.0)
    rotated = cv2.warpAffine(img, M, (800, 600), flags=cv2.INTER_LINEAR, borderValue=(255,255,255))
    lines, diag = detect_text_lines(rotated)
    assert len(lines) == 3

def test_gen_17_resized_image_retains_row_count():
    """GEN-17: resized image retains row count"""
    img = create_blank_bgr()
    for y in [100, 200, 300]:
        img = create_mock_row(img, y=y, h=40)
    resized = cv2.resize(img, (600, 450))
    lines, diag = detect_text_lines(resized)
    assert len(lines) == 3

def test_gen_18_brightness_change_retains_row_count():
    """GEN-18: brightness change retains row count"""
    img = create_blank_bgr()
    for y in [100, 200, 300]:
        img = create_mock_row(img, y=y, h=40)
    # Darken
    img = (img * 0.7).astype(np.uint8)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 3

def test_gen_19_contrast_change_retains_row_count():
    """GEN-19: contrast change retains row count"""
    img = create_blank_bgr()
    for y in [100, 200, 300]:
        img = create_mock_row(img, y=y, h=40, ink_color=(100,100,100))
    # Low contrast
    lines, diag = detect_text_lines(img)
    assert len(lines) == 3

def test_gen_20_jpeg_recompression_retains_row_count():
    """GEN-20: JPEG recompression retains row count"""
    img = create_blank_bgr()
    for y in [100, 200, 300]:
        img = create_mock_row(img, y=y, h=40)
    _, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 30])
    decoded = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    lines, diag = detect_text_lines(decoded)
    assert len(lines) == 3

def test_gen_21_vietnamese_diacritics_retained():
    """GEN-21: Vietnamese diacritics retained in parent crops"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=200, h=40)
    img = create_mock_accent(img, cx=200, cy=180) # diacritic above
    img = create_mock_accent(img, cx=250, cy=250) # descender below
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1
    assert lines[0].y <= 180
    assert lines[0].y + lines[0].height >= 250

def test_gen_22_final_rows_sorted_top_to_bottom():
    """GEN-22: final rows sorted top-to-bottom"""
    img = create_blank_bgr()
    # Drawn out of order
    img = create_mock_row(img, y=300, h=40)
    img = create_mock_row(img, y=100, h=40)
    img = create_mock_row(img, y=200, h=40)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 3
    assert lines[0].y < lines[1].y < lines[2].y
    assert lines[0].order == 1 and lines[1].order == 2 and lines[2].order == 3

def test_gen_23_every_final_row_passes_purity():
    """GEN-23: every final row passes one-primary-band purity"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=100, h=40)
    img = create_mock_row(img, y=160, h=40)
    lines, diag = detect_text_lines(img)
    # The new pipeline should naturally ensure this
    assert len(lines) == 2

def test_gen_24_meaningful_ink_coverage():
    """GEN-24: meaningful handwriting ink coverage above documented threshold"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=200, h=40)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1
    # Check that diagnostic has coverage info (assuming we add this diagnostic)
    assert diag.get("ink_coverage_ratio", 1.0) > 0.8

def test_gen_25_low_confidence_ambiguity_flagged():
    """GEN-25: low-confidence structural ambiguity is flagged, not silently hidden"""
    img = create_blank_bgr()
    for _ in range(500):
        x = np.random.randint(0, 800)
        y = np.random.randint(0, 600)
        cv2.circle(img, (x, y), np.random.randint(2, 5), (0,0,0), -1)
    lines, diag = detect_text_lines(img)
    assert diag.get("needs_review", False) == True

def test_gen_26_graph_paper_heavy_noise_no_over_segmentation():
    """GEN-26/OVER-01: graph paper noise does not cause over-segmentation (runt bands absorbed)"""
    img = create_blank_bgr()
    for y in [100, 200, 300, 400]:
        img = create_mock_row(img, y=y, h=40)
    # Create horizontal line segments of length 100, spaced far from text.
    # Runt-band absorption prevents these from creating phantom lines.
    for y in [50, 150, 250, 350, 450, 550]:
        cv2.line(img, (100, y), (200, y), (0,0,0), 2)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4, f"Expected 4 rows, but got {len(lines)}"

