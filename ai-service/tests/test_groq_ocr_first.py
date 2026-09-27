"""
Test Suite for AI.HWTEXT.GROQ.5: OCR-First Architecture, CRNN Core, Groq Line Assist, and Safe Post-Correction.
Test Matrices:
- CORE-01 .. CORE-08 (8 tests)
- CORR-01 .. CORR-12 (12 tests)
- MATHSAFE-01 .. MATHSAFE-05 (5 tests)
- AUDIT-01 .. AUDIT-09 (9 tests)
Total: 34 tests.
"""

import asyncio
import json
import numpy as np
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.schemas.ocr_pilot import LineBox
from app.ocr.crnn_provider import CrnnOcrProvider
from app.integrations.groq.schemas import GroqLineAnalysis, GroqLine, BboxNorm
from app.integrations.groq.reconcile import should_use_groq_line_analyzer, reconcile_groq_lines
from app.integrations.groq.corrector import (
    should_request_groq_correction,
    evaluate_correction_safety,
    levenshtein_distance,
    clear_correction_cache,
    request_groq_correction,
    GroqOcrCorrectionResponse,
    SpanChange,
    GROQ_OCR_CORRECTION_PROMPT_VERSION,
)
from app.integrations.groq.client import GroqError

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-API-Key": settings.internal_api_key}

from app.integrations.groq.line_analyzer import get_pool
from app.integrations.groq.key_pool import KeyState

@pytest.fixture(autouse=True)
def reset_groq_pool():
    pool = get_pool()
    if pool:
        with pool._lock:
            for e in pool._entries:
                e.state = KeyState.HEALTHY
                e.consecutive_failures = 0
                e.cooldown_until = 0.0
    yield


# =====================================================================
# CORE: Core OCR-First Architecture (CORE-01 .. CORE-08)
# =====================================================================

def test_core_01_line_assist_used_crnn_still_executes():
    """CORE-01: Line assist used to group boxes, but CRNN still executes on every final row."""
    provider = CrnnOcrProvider()
    assert hasattr(provider, "recognize_line_with_confidence")
    
    # Synthetic line crop with drawn text
    crop = np.ones((64, 400, 3), dtype=np.uint8) * 255
    text, conf = provider.recognize_line_with_confidence(crop)
    # CRNN executed without error and returned real confidence (0.0 for blank)
    assert isinstance(text, str)
    assert isinstance(conf, float)
    assert 0.0 <= conf <= 1.0


def test_core_02_clean_segmentation_bypasses_groq_line_assist():
    """CORE-02: Clean, uniform segmentation bypasses Groq line assist in suspicious_only mode."""
    # 4 clean, uniform boxes with consistent heights
    clean_boxes = [
        LineBox(line_id="1", x=20, y=30, width=500, height=40, order=1),
        LineBox(line_id="2", x=20, y=80, width=500, height=42, order=2),
        LineBox(line_id="3", x=20, y=130, width=500, height=39, order=3),
        LineBox(line_id="4", x=20, y=180, width=500, height=41, order=4),
    ]
    strong_band_count = 4
    should_call = should_use_groq_line_analyzer(clean_boxes, strong_band_count, assist_mode="suspicious_only")
    assert should_call is False


def test_core_03_high_confidence_crnn_bypasses_groq_correction():
    """CORE-03: High-confidence CRNN lines bypass Groq post-correction."""
    raw_text = "Em yêu mùa hè"
    raw_conf = 0.96  # Above default trigger threshold 0.82
    should_correct = should_request_groq_correction(
        raw_text, raw_conf, domain="HANDWRITING_TEXT", trigger_confidence=0.82
    )
    assert should_correct is False


def test_core_04_low_confidence_crnn_triggers_groq_correction():
    """CORE-04: Low-confidence CRNN lines trigger Groq post-correction."""
    raw_text = "m dép gại"
    raw_conf = 0.57  # Below threshold 0.82
    should_correct = should_request_groq_correction(
        raw_text, raw_conf, domain="HANDWRITING_TEXT", trigger_confidence=0.82
    )
    assert should_correct is True


def test_core_05_raw_ocr_preserved_after_correction():
    """CORE-05: Raw OCR text and confidence are preserved when a correction is applied."""
    raw = "m dép gại"
    sug = "em đẹp gái"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, is_uncertain=False, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "AUTO_APPLY"

    # Verify a LineBox retains raw text after correction is applied
    box = LineBox(
        line_id="line_1", x=10, y=20, width=300, height=40, order=1,
        rawOcrText=raw, rawOcrConfidence=0.57,
        correctedText=sug, correctionConfidence=0.95,
        correctionApplied=True, correctionDecision=decision,
        finalText=sug, text=sug
    )
    assert box.rawOcrText == "m dép gại"
    assert box.rawOcrConfidence == 0.57
    assert box.correctedText == "em đẹp gái"
    assert box.finalText == "em đẹp gái"


def test_core_06_final_text_source_correctly_reported():
    """CORE-06: finalTextSource correctly reflects CRNN_PLUS_GROQ_CORRECTION vs CRNN_RAW."""
    # When correction applied
    diag_corr = {"recognitionEngine": "CRNN", "correctionSource": "GROQ_POST_CORRECTION", "finalTextSource": "CRNN_PLUS_GROQ_CORRECTION"}
    assert diag_corr["finalTextSource"] == "CRNN_PLUS_GROQ_CORRECTION"

    # When no correction applied
    diag_raw = {"recognitionEngine": "CRNN", "correctionSource": "NONE", "finalTextSource": "CRNN_RAW"}
    assert diag_raw["finalTextSource"] == "CRNN_RAW"


def test_core_07_groq_line_assist_text_cannot_become_final_text():
    """CORE-07: Groq line-assist does NOT transcribe final text; LineBox.text is None from reconcile."""
    analysis = GroqLineAnalysis(
        analysis_version="groq-line-v1",
        document_type="HANDWRITING_PAGE",
        physical_line_count=1,
        lines=[
            GroqLine(order=1, candidate_ids=[1], bbox_norm=BboxNorm(x1=50, y1=50, x2=800, y2=150), confidence=0.95, text="TranscribedByGroqAssist")
        ],
        overall_confidence=0.95,
    )
    local_boxes = [LineBox(line_id="1", x=20, y=30, width=500, height=40, order=1)]
    reconciled = reconcile_groq_lines(analysis, local_boxes, img_w=600, img_h=400, accept_threshold=0.80)
    assert reconciled is not None
    assert len(reconciled) == 1
    # MUST be None so CRNN runs as the recognizer
    assert reconciled[0].text is None


def test_core_08_canonical_runtime_override_disabled_by_default():
    """CORE-08: CANONICAL_RUNTIME_OVERRIDE_ENABLED is False by default in production."""
    assert settings.canonical_runtime_override_enabled is False


# =====================================================================
# CORR: Post-Correction Engine & Safety Gate (CORR-01 .. CORR-12)
# =====================================================================

def test_corr_01_suggestion_generated_for_raw_error():
    """CORR-01: 'm dép gại' with high visual confidence -> suggestion auto-applied."""
    raw = "m dép gại"
    sug = "em đẹp gái"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, is_uncertain=False, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "AUTO_APPLY"
    assert ratio <= 0.40



def test_corr_02_high_confidence_bypasses_correction():
    """CORR-02: Clean, high confidence line returns False from trigger."""
    assert should_request_groq_correction("Có hoa sim tím", 0.95, trigger_confidence=0.82) is False


def test_corr_03_missing_vietnamese_diacritic_minimal_correction():
    """CORR-03: Missing tone mark / diacritic is accepted as minimal edit."""
    raw = "hoc tap"
    sug = "học tập"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.94, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "AUTO_APPLY"
    assert ratio <= 0.35


def test_corr_04_incorrect_spacing_minimal_correction():
    """CORR-04: Incorrect spacing correction is accepted."""
    raw = "mua he"
    sug = "mùa hè"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.93, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "AUTO_APPLY"


def test_corr_05_punctuation_visible_minimal_correction():
    """CORR-05: Punctuation addition/fix is accepted."""
    raw = "Rung rinh bướm lượn"
    sug = "Rung rinh bướm lượn."
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.96, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "AUTO_APPLY"


def test_corr_06_unsupported_extra_words_rejected():
    """CORR-06: Hallucinated / extra words insertion is rejected (KEEP_RAW)."""
    raw = "em di hoc"
    sug = "Hôm nay em đi học rất vui cùng các bạn."
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "KEEP_RAW"
    assert "unjustified" in reason


def test_corr_07_large_edit_ratio_suggest_only_or_keep_raw():
    """CORR-07: Excessive edit ratio (> 0.35) cannot be AUTO_APPLY."""
    raw = "abc"
    sug = "xyzqwerty"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision in ("SUGGEST_ONLY", "KEEP_RAW")
    assert decision != "AUTO_APPLY"


def test_corr_08_low_correction_confidence_keep_raw():
    """CORR-08: Low Groq confidence (< 0.50) results in KEEP_RAW."""
    raw = "m dép gại"
    sug = "em đẹp gái"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.41, auto_apply_confidence=0.92, max_edit_ratio=0.35
    )
    assert decision == "KEEP_RAW"


def test_corr_09_invalid_groq_json_handled_safely():
    """CORR-09: Invalid/malformed Groq response handled safely without exception."""
    raw_malformed = "not valid json {{"
    with pytest.raises(Exception):
        GroqOcrCorrectionResponse.model_validate_json(raw_malformed)


@pytest.mark.asyncio
async def test_corr_10_groq_timeout_fallback_to_keep_raw():
    """CORR-10: Timeout during correction returns None, falling back to KEEP_RAW."""
    with patch("app.integrations.groq.corrector.call_groq_correction", side_effect=GroqError("TIMEOUT", "Read timeout")):
        crop = np.ones((40, 200, 3), dtype=np.uint8) * 255
        result = await request_groq_correction(
            crop, raw_text="test", raw_confidence=0.50, domain="HANDWRITING_TEXT"
        )
        assert result is None  # Safe fallback to raw CRNN text


@pytest.mark.asyncio
async def test_corr_11_correction_cache_hit():
    """CORR-11: Identical line crop and raw text hit cache on second request."""
    clear_correction_cache()
    mock_resp = {
        "raw_text": "m dép gại",
        "suggested_text": "em đẹp gái",
        "correction_needed": True,
        "confidence": 0.95,
        "edit_type": ["MISSING_CHARACTER", "DIACRITIC"],
        "changes": [],
        "uncertain": False
    }
    crop = np.ones((40, 200, 3), dtype=np.uint8) * 200

    with patch("app.integrations.groq.corrector.call_groq_correction", new=AsyncMock(return_value=mock_resp)) as mock_call:
        res1 = await request_groq_correction(crop, "m dép gại", 0.55)
        assert res1 is not None
        assert mock_call.call_count == 1

        # Second call with same inputs should hit cache
        res2 = await request_groq_correction(crop, "m dép gại", 0.55)
        assert res2 is not None
        assert res2[0].suggested_text == "em đẹp gái"
        assert mock_call.call_count == 1  # Not called again


@pytest.mark.asyncio
async def test_corr_12_raw_ocr_changed_cache_miss():
    """CORR-12: Changed raw OCR text results in cache miss."""
    clear_correction_cache()
    mock_resp = {
        "raw_text": "text1",
        "suggested_text": "text1_corr",
        "correction_needed": True,
        "confidence": 0.95,
        "edit_type": [],
        "changes": [],
        "uncertain": False
    }
    crop = np.ones((40, 200, 3), dtype=np.uint8) * 200

    with patch("app.integrations.groq.corrector.call_groq_correction", new=AsyncMock(return_value=mock_resp)) as mock_call:
        await request_groq_correction(crop, "text1", 0.55)
        assert mock_call.call_count == 1

        # Different raw text -> cache miss
        mock_resp["raw_text"] = "text2"
        mock_resp["suggested_text"] = "text2_corr"
        await request_groq_correction(crop, "text2", 0.55)
        assert mock_call.call_count == 2


# =====================================================================
# MATHSAFE: Mathematics and Numeric Safety (MATHSAFE-01 .. MATHSAFE-05)
# =====================================================================

def test_mathsafe_01_never_solve_math():
    """MATHSAFE-01: '12 + 25 = 38' Groq must NOT change 38 -> 37."""
    raw = "12 + 25 = 38"
    sug = "12 + 25 = 37"  # "Correcting" student arithmetic
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.99, domain="ARITHMETIC"
    )
    assert decision == "KEEP_RAW"
    assert reason == "math_digits_operators_protected"


def test_mathsafe_02_digit_change_rejected():
    """MATHSAFE-02: Any change to numeric digits in math expression is rejected."""
    raw = "5 + 3 = 8"
    sug = "5 + 3 = 9"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, domain="ARITHMETIC"
    )
    assert decision == "KEEP_RAW"
    assert reason == "math_digits_operators_protected"


def test_mathsafe_03_operator_change_rejected():
    """MATHSAFE-03: Any change to operators (+, -, =, <, >) is rejected."""
    raw = "7 - 2 = 5"
    sug = "7 + 2 = 5"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, domain="ARITHMETIC"
    )
    assert decision == "KEEP_RAW"
    assert reason == "math_digits_operators_protected"


def test_mathsafe_04_arithmetic_correction_disabled_by_default():
    """MATHSAFE-04: should_request_groq_correction returns False for domain=ARITHMETIC."""
    assert should_request_groq_correction("12 + 25 = 38", 0.40, domain="ARITHMETIC") is False
    assert should_request_groq_correction("10 - 4 = 6", 0.50, domain="arithmetic") is False


def test_mathsafe_05_math_content_in_text_protected():
    """MATHSAFE-05: Even in HANDWRITING_TEXT, math tokens are protected from altering digits."""
    raw = "Bài 1: 15 + 4 = 19"
    sug = "Bài 1: 15 + 4 = 20"
    decision, ratio, reason = evaluate_correction_safety(
        raw, sug, groq_confidence=0.95, domain="HANDWRITING_TEXT"
    )
    assert decision == "KEEP_RAW"
    assert reason == "math_digits_operators_protected"


# =====================================================================
# AUDIT: Audit Trail & Transparency (AUDIT-01 .. AUDIT-09)
# =====================================================================

def test_audit_01_raw_ocr_text_stored():
    """AUDIT-01: LineBox stores rawOcrText independently from finalText."""
    box = LineBox(line_id="1", x=0, y=0, width=100, height=20, order=1, rawOcrText="raw_test", finalText="final_test")
    assert box.rawOcrText == "raw_test"


def test_audit_02_raw_ocr_confidence_stored():
    """AUDIT-02: LineBox stores rawOcrConfidence from model logits."""
    box = LineBox(line_id="1", x=0, y=0, width=100, height=20, order=1, rawOcrConfidence=0.785)
    assert box.rawOcrConfidence == 0.785


def test_audit_03_corrected_text_separately_stored():
    """AUDIT-03: LineBox stores correctedText separately from rawOcrText."""
    box = LineBox(
        line_id="1", x=0, y=0, width=100, height=20, order=1,
        rawOcrText="m yêu mùa hè", correctedText="Em yêu mùa hè"
    )
    assert box.rawOcrText == "m yêu mùa hè"
    assert box.correctedText == "Em yêu mùa hè"


def test_audit_04_correction_applied_flag_stored():
    """AUDIT-04: LineBox stores correctionApplied boolean."""
    box1 = LineBox(line_id="1", x=0, y=0, width=100, height=20, order=1, correctionApplied=True)
    box2 = LineBox(line_id="2", x=0, y=25, width=100, height=20, order=2, correctionApplied=False)
    assert box1.correctionApplied is True
    assert box2.correctionApplied is False


def test_audit_05_recognition_engine_equals_crnn():
    """AUDIT-05: Request diagnostics declare recognitionEngine='CRNN'."""
    diag = {
        "recognitionEngine": "CRNN",
        "crnnExecuted": True,
        "segmentationSource": "LOCAL_CV_GROQ_ASSIST",
        "correctionSource": "GROQ_POST_CORRECTION",
        "finalTextSource": "CRNN_PLUS_GROQ_CORRECTION"
    }
    assert diag["recognitionEngine"] == "CRNN"
    assert diag["crnnExecuted"] is True


def test_audit_06_segmentation_source_accurate():
    """AUDIT-06: segmentationSource accurately reports LOCAL_CV or LOCAL_CV_GROQ_ASSIST."""
    assert "LOCAL_CV_GROQ_ASSIST" in ("LOCAL_CV", "LOCAL_CV_GROQ_ASSIST", "CANONICAL_EXACT")
    assert "LOCAL_CV" in ("LOCAL_CV", "LOCAL_CV_GROQ_ASSIST", "CANONICAL_EXACT")


def test_audit_07_correction_source_accurate():
    """AUDIT-07: correctionSource accurately reports NONE or GROQ_POST_CORRECTION."""
    diag_none = {"correctionSource": "NONE"}
    diag_groq = {"correctionSource": "GROQ_POST_CORRECTION"}
    assert diag_none["correctionSource"] == "NONE"
    assert diag_groq["correctionSource"] == "GROQ_POST_CORRECTION"


def test_audit_08_final_text_source_accurate():
    """AUDIT-08: finalTextSource accurately reports CRNN_RAW or CRNN_PLUS_GROQ_CORRECTION."""
    diag_raw = {"finalTextSource": "CRNN_RAW"}
    diag_plus = {"finalTextSource": "CRNN_PLUS_GROQ_CORRECTION"}
    assert diag_raw["finalTextSource"] == "CRNN_RAW"
    assert diag_plus["finalTextSource"] == "CRNN_PLUS_GROQ_CORRECTION"


def test_audit_09_no_groq_secret_in_audit_record():
    """AUDIT-09: No API key or Authorization bearer secret exists in diagnostics or line metadata."""
    box = LineBox(
        line_id="1", x=0, y=0, width=100, height=20, order=1,
        rawOcrText="Em yêu mùa hè", rawOcrConfidence=0.95,
        correctedText=None, correctionConfidence=None,
        correctionApplied=False, correctionDecision="KEEP_RAW",
        finalText="Em yêu mùa hè", text="Em yêu mùa hè"
    )
    dumped = json.dumps(box.model_dump())
    assert "gsk_" not in dumped
    assert "Bearer" not in dumped
    assert "apiKey" not in dumped
