"""
Unit tests for deterministic scale-adaptive RowGrouper.
Covers all required geometric cases, edge conditions, and input-order independence.
"""
import pytest
import random
from app.schemas.core import Token
from app.layout.row_grouper import RowGrouper, RowGroupingConfig, RowGroup


def _make_tok(tid: str, val: str, cls: str, x: float, y: float, w: float, h: float) -> Token:
    return Token(
        tokenId=tid,
        value=val,
        tokenClass=cls,
        boundingBox=[round(x, 4), round(y, 4), round(w, 4), round(h, 4)],
        confidence=0.95,
        alternatives=[],
        ambiguity=False,
    )


def test_group_empty():
    grouper = RowGrouper()
    assert grouper.group([]) == []


def test_group_single_token():
    grouper = RowGrouper()
    tok = _make_tok("t1", "5", "digit", 0.4, 0.3, 0.1, 0.12)
    rows = grouper.group([tok], img_w=1000, img_h=1000)
    assert len(rows) == 1
    assert rows[0].row_index == 0
    assert rows[0].yolo_text == "5"
    assert rows[0].token_count == 1
    assert rows[0].is_eligible_for_ocr is True


def test_group_single_row():
    grouper = RowGrouper()
    tokens = [
        _make_tok("t1", "4", "digit", 0.20, 0.30, 0.08, 0.10),
        _make_tok("t2", "5", "digit", 0.30, 0.305, 0.08, 0.095),
        _make_tok("t3", "6", "digit", 0.40, 0.298, 0.08, 0.102),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 1
    assert rows[0].yolo_text == "456"
    assert len(rows[0].tokens) == 3


def test_group_two_clearly_separated_rows():
    grouper = RowGrouper()
    tokens = [
        _make_tok("t1", "1", "digit", 0.30, 0.20, 0.08, 0.10),
        _make_tok("t2", "2", "digit", 0.40, 0.20, 0.08, 0.10),
        _make_tok("t3", "+", "operator", 0.20, 0.45, 0.08, 0.10),
        _make_tok("t4", "3", "digit", 0.30, 0.45, 0.08, 0.10),
        _make_tok("t5", "4", "digit", 0.40, 0.45, 0.08, 0.10),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 2
    assert rows[0].yolo_text == "12"
    assert rows[1].yolo_text == "+34"


def test_group_three_to_five_rows():
    grouper = RowGrouper()
    tokens = []
    # 4 rows at y = 0.15, 0.30, 0.45, 0.60
    y_levels = [0.15, 0.30, 0.45, 0.60]
    expected_texts = ["100", "+250", "=", "350"]
    for r_idx, y in enumerate(y_levels):
        if r_idx == 2:
            tokens.append(_make_tok(f"t_{r_idx}_0", "=", "separator", 0.20, y, 0.40, 0.02))
        elif r_idx == 1:
            tokens.append(_make_tok(f"t_{r_idx}_op", "+", "operator", 0.20, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_1", "2", "digit", 0.30, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_2", "5", "digit", 0.40, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_3", "0", "digit", 0.50, y, 0.08, 0.08))
        elif r_idx == 0:
            tokens.append(_make_tok(f"t_{r_idx}_1", "1", "digit", 0.30, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_2", "0", "digit", 0.40, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_3", "0", "digit", 0.50, y, 0.08, 0.08))
        else:
            tokens.append(_make_tok(f"t_{r_idx}_1", "3", "digit", 0.30, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_2", "5", "digit", 0.40, y, 0.08, 0.08))
            tokens.append(_make_tok(f"t_{r_idx}_3", "0", "digit", 0.50, y, 0.08, 0.08))

    rows = grouper.group(tokens)
    assert len(rows) == 4
    for idx, expected in enumerate(expected_texts):
        assert rows[idx].yolo_text == expected


def test_group_is_input_order_independent():
    """Verify that shuffling the input tokens produces identical grouping and text."""
    grouper = RowGrouper()
    base_tokens = [
        _make_tok("t1", "4", "digit", 0.25, 0.20, 0.08, 0.10),
        _make_tok("t2", "5", "digit", 0.35, 0.20, 0.08, 0.10),
        _make_tok("t3", "6", "digit", 0.45, 0.20, 0.08, 0.10),
        _make_tok("t4", "+", "operator", 0.15, 0.38, 0.08, 0.10),
        _make_tok("t5", "2", "digit", 0.25, 0.38, 0.08, 0.10),
        _make_tok("t6", "7", "digit", 0.35, 0.38, 0.08, 0.10),
        _make_tok("t7", "8", "digit", 0.45, 0.38, 0.08, 0.10),
        _make_tok("t8", "7", "digit", 0.25, 0.56, 0.08, 0.10),
        _make_tok("t9", "3", "digit", 0.35, 0.56, 0.08, 0.10),
        _make_tok("t10", "4", "digit", 0.45, 0.56, 0.08, 0.10),
    ]

    canonical_rows = grouper.group(base_tokens)
    canonical_texts = [r.yolo_text for r in canonical_rows]
    assert canonical_texts == ["456", "+278", "734"]

    rng = random.Random(42)
    for _ in range(10):
        shuffled = list(base_tokens)
        rng.shuffle(shuffled)
        shuffled_rows = grouper.group(shuffled)
        assert len(shuffled_rows) == len(canonical_rows)
        for idx in range(len(canonical_rows)):
            assert shuffled_rows[idx].yolo_text == canonical_rows[idx].yolo_text
            assert shuffled_rows[idx].bbox == canonical_rows[idx].bbox


def test_group_different_token_heights():
    grouper = RowGrouper()
    # Varying heights in the same row
    tokens = [
        _make_tok("t1", "1", "digit", 0.20, 0.30, 0.08, 0.12),
        _make_tok("t2", "2", "digit", 0.30, 0.32, 0.08, 0.08),  # smaller
        _make_tok("t3", "3", "digit", 0.40, 0.29, 0.08, 0.14),  # larger
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 1
    assert rows[0].yolo_text == "123"


def test_group_slightly_slanted_handwriting():
    grouper = RowGrouper()
    # Handwriting line slanting slightly upwards from y=0.32 to y=0.29
    tokens = [
        _make_tok("t1", "4", "digit", 0.20, 0.32, 0.08, 0.10),
        _make_tok("t2", "5", "digit", 0.30, 0.305, 0.08, 0.10),
        _make_tok("t3", "6", "digit", 0.40, 0.29, 0.08, 0.10),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 1
    assert rows[0].yolo_text == "456"


def test_group_carry_marker_above_column():
    """High carry marker (c1) above top row forms a dedicated annotation row."""
    grouper = RowGrouper()
    tokens = [
        _make_tok("carry1", "1", "carry", 0.32, 0.10, 0.05, 0.06), # high above tens column
        _make_tok("t1", "4", "digit", 0.20, 0.25, 0.08, 0.10),
        _make_tok("t2", "5", "digit", 0.30, 0.25, 0.08, 0.10),
        _make_tok("t3", "+", "operator", 0.10, 0.42, 0.08, 0.10),
        _make_tok("t4", "2", "digit", 0.20, 0.42, 0.08, 0.10),
        _make_tok("t5", "7", "digit", 0.30, 0.42, 0.08, 0.10),
    ]
    rows = grouper.group(tokens)
    # High carry forms row 0, operand 1 forms row 1, operand 2 forms row 2
    assert len(rows) == 3
    assert rows[0].is_carry_only is True
    assert rows[0].is_eligible_for_ocr is False
    assert rows[1].yolo_text == "45"
    assert rows[2].yolo_text == "+27"


def test_group_large_horizontal_gap():
    """Wide space between left operator and rightmost digits should still group in same row."""
    grouper = RowGrouper()
    tokens = [
        _make_tok("t_op", "-", "operator", 0.10, 0.35, 0.06, 0.08),
        # Gap between x=0.16 and x=0.40
        _make_tok("t_d1", "8", "digit", 0.40, 0.35, 0.08, 0.09),
        _make_tok("t_d2", "3", "digit", 0.50, 0.35, 0.08, 0.09),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 1
    assert rows[0].yolo_text == "-83"


def test_group_close_rows_remain_separate():
    """Two rows positioned relatively close vertically must not falsely merge."""
    grouper = RowGrouper()
    # Row 1: y=0.30, h=0.08 (bottom=0.38)
    # Row 2: y=0.42, h=0.08 (top=0.42) - gap is 0.04
    tokens = [
        _make_tok("t1", "5", "digit", 0.30, 0.30, 0.08, 0.08),
        _make_tok("t2", "6", "digit", 0.40, 0.30, 0.08, 0.08),
        _make_tok("t3", "7", "digit", 0.30, 0.42, 0.08, 0.08),
        _make_tok("t4", "8", "digit", 0.40, 0.42, 0.08, 0.08),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 2
    assert rows[0].yolo_text == "56"
    assert rows[1].yolo_text == "78"


def test_group_outlier_token():
    grouper = RowGrouper()
    tokens = [
        _make_tok("t1", "1", "digit", 0.30, 0.20, 0.08, 0.08),
        _make_tok("t2", "2", "digit", 0.40, 0.20, 0.08, 0.08),
        # Far isolated outlier
        _make_tok("t_outlier", "9", "digit", 0.85, 0.85, 0.06, 0.06),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 2
    assert rows[0].yolo_text == "12"
    assert rows[1].yolo_text == "9"


def test_group_invalid_bbox():
    """Tokens with zero/negative/corrupt dimensions are dropped."""
    grouper = RowGrouper()
    tokens = [
        _make_tok("t_valid", "4", "digit", 0.30, 0.20, 0.08, 0.08),
        _make_tok("t_zero_w", "0", "digit", 0.40, 0.20, 0.0, 0.08),
        _make_tok("t_neg_h", "1", "digit", 0.50, 0.20, 0.08, -0.05),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 1
    assert rows[0].yolo_text == "4"


def test_group_bbox_touching_edge():
    grouper = RowGrouper()
    tokens = [
        _make_tok("t_edge", "7", "digit", 0.0, 0.0, 0.10, 0.10),
        _make_tok("t_edge2", "8", "digit", 0.90, 0.0, 0.10, 0.10),
    ]
    rows = grouper.group(tokens, img_w=1000, img_h=1000)
    assert len(rows) == 1
    assert rows[0].yolo_text == "78"
    assert rows[0].crop_bbox is not None
    # Clamped within [0, 1000]
    cx1, cy1, cx2, cy2 = rows[0].crop_bbox
    assert cx1 >= 0 and cy1 >= 0
    assert cx2 <= 1000 and cy2 <= 1000


def test_tokens_sorted_left_to_right():
    grouper = RowGrouper()
    # Unsorted in x
    tokens = [
        _make_tok("t3", "3", "digit", 0.45, 0.30, 0.08, 0.08),
        _make_tok("t1", "1", "digit", 0.15, 0.30, 0.08, 0.08),
        _make_tok("t2", "2", "digit", 0.30, 0.30, 0.08, 0.08),
    ]
    rows = grouper.group(tokens)
    assert len(rows) == 1
    assert rows[0].yolo_text == "123"
    assert [t.value for t in rows[0].tokens] == ["1", "2", "3"]
