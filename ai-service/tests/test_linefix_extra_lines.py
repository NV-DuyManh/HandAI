import pytest
import cv2
import numpy as np
from app.api.ocr import detect_text_lines

np.random.seed(42)

def create_blank_bgr(w=800, h=600):
    return np.ones((h, w, 3), dtype=np.uint8) * 255

def create_mock_row(img, y, h=35, w_offset=50, w_len=700, ink_color=(0, 0, 0)):
    for x in range(w_offset, w_offset + w_len, 25):
        cv2.circle(img, (x + np.random.randint(-5, 5), y + h // 2 + np.random.randint(-3, 3)), np.random.randint(2, 6), ink_color, -1)
        cv2.line(img, (x, y + h // 4), (x + 10, y + h - h // 4), ink_color, 2)
    return img

def create_mock_accent(img, cx, cy, ink_color=(0, 0, 0)):
    cv2.circle(img, (cx, cy), 3, ink_color, -1)
    return img

def test_linefix_01_four_real_rows_plus_thin_top_artifact():
    """LINEFIX-01: 4 real rows + thin top artifact -> 4 rows"""
    img = create_blank_bgr()
    for y in [100, 200, 300, 400]:
        img = create_mock_row(img, y=y, h=35)
    # Thin top artifact at y=8
    cv2.line(img, (100, 8), (350, 8), (120, 120, 120), 1)
    cv2.circle(img, (200, 10), 2, (0, 0, 0), -1)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4

def test_linefix_02_accent_satellite_merged():
    """LINEFIX-02: Accent satellite -> merged into parent row"""
    img = create_blank_bgr()
    for y in [120, 220, 320, 420]:
        img = create_mock_row(img, y=y, h=35)
    # Accent satellite floating at y=95 above row 1
    create_mock_accent(img, cx=200, cy=95)
    create_mock_accent(img, cx=220, cy=96)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4
    # First row crop must absorb the accent
    assert lines[0].y <= 100

def test_linefix_03_three_genuine_rows():
    """LINEFIX-03: 3 genuine rows -> exactly 3"""
    img = create_blank_bgr()
    for y in [120, 240, 360]:
        img = create_mock_row(img, y=y, h=35)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 3

def test_linefix_04_five_genuine_rows():
    """LINEFIX-04: 5 genuine rows -> exactly 5"""
    img = create_blank_bgr()
    for y in [80, 160, 240, 320, 400]:
        img = create_mock_row(img, y=y, h=30)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 5

def test_linefix_05_one_genuine_short_row():
    """LINEFIX-05: 1 genuine short row -> exactly 1"""
    img = create_blank_bgr()
    img = create_mock_row(img, y=250, h=35, w_offset=100, w_len=150)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 1

def test_linefix_06_six_genuine_rows():
    """LINEFIX-06: 6 genuine rows -> exactly 6"""
    img = create_blank_bgr()
    for y in [60, 130, 200, 270, 340, 410]:
        img = create_mock_row(img, y=y, h=28)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 6

def test_linefix_07_graph_paper_empty_strip_rejected():
    """LINEFIX-07: Graph-paper empty strip -> rejected"""
    img = create_blank_bgr()
    for y in [100, 200, 300, 400]:
        img = create_mock_row(img, y=y, h=35)
    # Graph paper ruler grid strip at y=25 without letter body
    cv2.line(img, (50, 25), (750, 25), (180, 180, 180), 1)
    cv2.line(img, (200, 20), (200, 30), (180, 180, 180), 1)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4

def test_linefix_08_short_genuine_row_near_top_preserved():
    """LINEFIX-08: Short genuine row near top -> preserved if strong ink evidence"""
    img = create_blank_bgr()
    # Short row at y=100 ("Bài 1:"), followed by 3 full rows
    img = create_mock_row(img, y=100, h=35, w_offset=50, w_len=140)
    img = create_mock_row(img, y=200, h=35)
    img = create_mock_row(img, y=300, h=35)
    img = create_mock_row(img, y=400, h=35)
    lines, diag = detect_text_lines(img)
    assert len(lines) == 4
    assert lines[0].width < 250
