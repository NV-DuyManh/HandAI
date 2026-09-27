"""
RECON tests — reconcile_groq_lines + should_use_groq_line_analyzer.
14/14 required.
"""
import pytest
from app.integrations.groq.reconcile import reconcile_groq_lines, should_use_groq_line_analyzer
from app.integrations.groq.schemas import GroqLineAnalysis
from app.schemas.ocr_pilot import LineBox


def make_local_boxes(specs):
    """specs: list of (x, y, w, h)"""
    return [
        LineBox(line_id=f"line_{i+1}", x=s[0], y=s[1], width=s[2], height=s[3], order=i+1)
        for i, s in enumerate(specs)
    ]


def make_groq_analysis(n_lines: int, groups: list, overall_conf=0.92) -> GroqLineAnalysis:
    """groups: list of (candidate_ids, x1, y1, x2, y2)"""
    lines = []
    for i, g in enumerate(groups):
        lines.append({
            "order": i + 1,
            "text": f"Line {i+1}",
            "confidence": 0.90,
            "candidate_ids": g[0],
            "bbox_norm": {"x1": g[1], "y1": g[2], "x2": g[3], "y2": g[4]},
            "is_short_legitimate_line": False,
        })
    return GroqLineAnalysis.model_validate({
        "analysis_version": "groq-line-v2",
        "document_type": "handwriting",
        "physical_line_count": n_lines,
        "lines": lines,
        "drop_candidate_ids": [],
        "overall_confidence": overall_conf,
        "needs_second_pass": False,
        "warnings": [],
    })


def test_recon_01_eight_to_four():
    """RECON-01: 8 local boxes -> 4 Groq groups -> 4 final boxes"""
    local = make_local_boxes([
        (0, 0, 400, 20), (0, 22, 400, 5),   # row 1: body + accent
        (0, 50, 400, 20), (0, 52, 400, 5),  # row 2
        (0, 100, 400, 20), (0, 102, 400, 5), # row 3
        (0, 150, 400, 20), (0, 152, 400, 5), # row 4
    ])
    analysis = make_groq_analysis(4, [
        ([1, 2], 0, 0, 1000, 250),
        ([3, 4], 0, 251, 1000, 500),
        ([5, 6], 0, 501, 1000, 750),
        ([7, 8], 0, 751, 1000, 1000),
    ])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=200)
    assert result is not None
    assert len(result) == 4


def test_recon_02_eleven_to_four():
    """RECON-02: 11 local -> 4 Groq groups -> 4 final"""
    local = make_local_boxes(
        [(0, i * 10, 400, 8) for i in range(11)]
    )
    analysis = make_groq_analysis(4, [
        ([1, 2, 3], 0, 0, 1000, 250),
        ([4, 5, 6], 0, 251, 1000, 500),
        ([7, 8, 9], 0, 501, 1000, 750),
        ([10, 11], 0, 751, 1000, 1000),
    ])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=110)
    assert result is not None
    assert len(result) == 4


def test_recon_03_fourteen_to_four():
    """RECON-03: 14 local -> 4 Groq groups -> 4 final"""
    local = make_local_boxes(
        [(0, i * 8, 400, 6) for i in range(14)]
    )
    analysis = make_groq_analysis(4, [
        ([1, 2, 3, 4], 0, 0, 1000, 250),
        ([5, 6, 7, 8], 0, 251, 1000, 500),
        ([9, 10, 11], 0, 501, 1000, 750),
        ([12, 13, 14], 0, 751, 1000, 1000),
    ])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=112)
    assert result is not None
    assert len(result) == 4


def test_recon_04_accents_included_in_union():
    """RECON-04: accent satellite in same group is absorbed into row bbox"""
    body = (0, 50, 400, 30)
    accent = (100, 40, 50, 8)  # above body = diacritic
    local = make_local_boxes([body, accent])
    analysis = make_groq_analysis(1, [([1, 2], 0, 0, 1000, 1000)])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=100)
    assert result is not None
    assert len(result) == 1
    # Combined y should include the accent
    assert result[0].y <= 40


def test_recon_05_duplicate_candidate_removed():
    """RECON-05: Groq analysis with duplicate candidate already rejected by schema"""
    with pytest.raises(Exception):
        make_groq_analysis(2, [
            ([1, 2], 0, 0, 1000, 500),
            ([2, 3], 0, 501, 1000, 1000),  # 2 duplicated
        ])


def test_recon_06_adjacent_rows_stay_separate():
    """RECON-06: two distinct rows with 30px gap are not merged"""
    local = make_local_boxes([(0, 0, 400, 30), (0, 70, 400, 30)])
    analysis = make_groq_analysis(2, [
        ([1], 0, 0, 1000, 400),
        ([2], 0, 500, 1000, 1000),
    ])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=100)
    assert result is not None
    assert len(result) == 2


def test_recon_07_short_row_preserved():
    """RECON-07: is_short_legitimate_line=True is preserved as its own row"""
    local = make_local_boxes([(100, 80, 80, 20)])
    analysis = GroqLineAnalysis.model_validate({
        "analysis_version": "groq-line-v2",
        "document_type": "handwriting",
        "physical_line_count": 1,
        "lines": [{
            "order": 1, "text": "Bài giải", "confidence": 0.88,
            "candidate_ids": [1],
            "bbox_norm": {"x1": 0, "y1": 0, "x2": 1000, "y2": 1000},
            "is_short_legitimate_line": True
        }],
        "drop_candidate_ids": [], "overall_confidence": 0.88,
        "needs_second_pass": False, "warnings": [],
    })
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=100)
    assert result is not None
    assert len(result) == 1


def test_recon_08_missing_local_row_recovered_from_groq_bbox():
    """RECON-08: Groq identifies row with no candidate -> uses normalized bbox"""
    local = make_local_boxes([(0, 0, 400, 30)])  # only 1 local
    analysis = make_groq_analysis(2, [
        ([1], 0, 0, 1000, 500),
        ([], 0, 510, 1000, 1000),  # missing local candidate
    ])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=200)
    assert result is not None
    assert len(result) == 2


def test_recon_09_bad_groq_bbox_skipped():
    """RECON-09: degenerate bbox (w<5) is skipped"""
    local = make_local_boxes([])
    analysis = make_groq_analysis(1, [([], 500, 500, 502, 503)])  # 2x3 norm = tiny
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=200)
    assert result is not None
    assert len(result) == 0


def test_recon_10_sorted_order():
    """RECON-10: result is always sorted top-to-bottom"""
    local = make_local_boxes([(0, 100, 400, 30), (0, 0, 400, 30)])
    analysis = make_groq_analysis(2, [
        ([2], 0, 0, 1000, 400),   # Groq thinks this is row 1 but local box 2 is y=0
        ([1], 0, 500, 1000, 1000),
    ])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=130)
    assert result is not None
    assert result[0].y < result[1].y


def test_recon_11_six_rows_remain_six():
    """RECON-11: 6-row document stays at 6"""
    local = make_local_boxes([(0, i * 30, 400, 25) for i in range(6)])
    groups = [([i + 1], 0, i * 166, 1000, (i + 1) * 166) for i in range(6)]
    analysis = make_groq_analysis(6, groups)
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=180)
    assert result is not None
    assert len(result) == 6


def test_recon_12_one_row_remains_one():
    """RECON-12: single row document stays at 1"""
    local = make_local_boxes([(0, 50, 400, 30)])
    analysis = make_groq_analysis(1, [([1], 0, 0, 1000, 1000)])
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=100)
    assert result is not None
    assert len(result) == 1


def test_recon_13_low_confidence_returns_none():
    """RECON-13: overall_confidence < threshold -> None (local fallback)"""
    local = make_local_boxes([(0, 0, 400, 30)])
    analysis = make_groq_analysis(1, [([1], 0, 0, 1000, 1000)], overall_conf=0.50)
    result = reconcile_groq_lines(analysis, local, img_w=400, img_h=100, accept_threshold=0.80)
    assert result is None


def test_recon_14_suspiciousness_trigger():
    """RECON-14: should_use_groq fires on over-segmentation"""
    # 8 boxes with 4 strong bands -> 8 > 4*1.5=6 -> suspicious
    local = make_local_boxes([(0, i * 20, 400, 15) for i in range(8)])
    assert should_use_groq_line_analyzer(local, strong_band_count=4, assist_mode="handwriting") is True
    # 4 boxes with 4 strong bands -> not suspicious
    local4 = make_local_boxes([(0, i * 40, 400, 30) for i in range(4)])
    assert should_use_groq_line_analyzer(local4, strong_band_count=4, assist_mode="handwriting") is False
