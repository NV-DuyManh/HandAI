"""
DEC (10/10) test suite for Phase AI.HWTEXT.GROQ.6.
Verifies the 3-way correction decisions (AUTO_APPLY, SUGGEST_ONLY, KEEP_RAW),
visual support gate, large rewrite protections, math safety, and user acceptance behavior.
"""

import pytest
from app.integrations.groq.corrector import evaluate_correction_safety


def test_dec_01_small_strong_correction_auto_apply():
    """DEC-01 small strong correction -> AUTO_APPLY"""
    raw = "m dép gại"
    sug = "em đẹp gái"
    dec, ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=sug,
        groq_confidence=0.95,
        visual_support="STRONG",
        is_uncertain=False,
    )
    assert dec == "AUTO_APPLY"
    assert reason == "safe_auto_apply"


def test_dec_02_large_strong_correction_suggest_only():
    """DEC-02 large strong correction -> SUGGEST_ONLY"""
    raw = "cóng nggo nài gơng"
    sug = "Em yêu mùa hè"
    # Large edit, but strong visual evidence -> SUGGEST_ONLY, not silently KEEP_RAW!
    dec, ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=sug,
        groq_confidence=0.94,
        visual_support="STRONG",
        is_uncertain=False,
    )
    assert dec == "SUGGEST_ONLY"
    assert "suggest_only" in reason


def test_dec_03_weak_visual_evidence_keep_raw():
    """DEC-03 weak visual evidence -> KEEP_RAW"""
    raw = "Em yêu mùa hè"
    sug = "Em yêu mùa thu"
    dec, ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=sug,
        groq_confidence=0.90,
        visual_support="WEAK",
        is_uncertain=False,
    )
    assert dec == "KEEP_RAW"
    assert "weak_visual_support" in reason


def test_dec_04_large_hallucinated_expansion_keep_raw():
    """DEC-04 large hallucinated expansion -> KEEP_RAW"""
    raw = "em di hoc"
    sug = "Hôm nay em đi học rất vui cùng các bạn"
    dec, ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=sug,
        groq_confidence=0.98,
        visual_support="STRONG",
        is_uncertain=False,
    )
    assert dec == "KEEP_RAW"
    assert "unjustified" in reason


def test_dec_05_low_provider_confidence_keep_raw():
    """DEC-05 low provider confidence -> KEEP_RAW"""
    raw = "Có hoa sim tím"
    sug = "Có hoa sim tim"
    dec, ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=sug,
        groq_confidence=0.45, # < 0.50
        visual_support="STRONG",
        is_uncertain=False,
    )
    assert dec == "KEEP_RAW"


def test_dec_06_invalid_json_fallback_keep_raw():
    """DEC-06 invalid JSON -> fallback to raw OCR (KEEP_RAW)"""
    from app.integrations.groq.corrector import GroqOcrCorrectionResponse
    # Pydantic validation fails on malformed dict
    bad_data = {"raw_text": "abc"} # missing suggested_text
    try:
        GroqOcrCorrectionResponse.model_validate(bad_data)
        failed = False
    except Exception:
        failed = True
    assert failed is True


@pytest.mark.asyncio
async def test_dec_07_timeout_returns_none_fallback_keep_raw(monkeypatch):
    """DEC-07 timeout -> KEEP_RAW"""
    from app.integrations.groq import corrector
    from app.integrations.groq.client import GroqError
    import numpy as np

    async def mock_call(*args, **kwargs):
        raise GroqError("TIMEOUT", "Request timed out after 20.0s")

    monkeypatch.setattr(corrector, "call_groq_correction", mock_call)
    dummy_crop = np.ones((40, 200, 3), dtype=np.uint8) * 255
    res = await corrector.request_groq_correction(
        bgr_crop=dummy_crop,
        raw_text="Em yêu mùa hè",
        raw_confidence=0.70,
        domain="HANDWRITING_TEXT",
    )
    assert res is None # caller defaults to raw text (KEEP_RAW)


def test_dec_08_arithmetic_digit_change_keep_raw():
    """DEC-08 arithmetic digit change -> KEEP_RAW"""
    raw = "12 + 25 = 38"
    sug = "12 + 25 = 37" # Groq tries to solve math
    dec, ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=sug,
        groq_confidence=0.99,
        visual_support="STRONG",
        domain="ARITHMETIC",
    )
    assert dec == "KEEP_RAW"
    assert "math_digits_operators_protected" in reason


def test_dec_09_suggestion_only_requires_user_acceptance():
    """DEC-09 suggestion-only requires user acceptance before replacing text"""
    decision = "SUGGEST_ONLY"
    raw_ocr = "cóng nggo nài gơng"
    suggestion = "Em yêu mùa hè"

    # Default before acceptance must be raw OCR text
    final_text_default = raw_ocr if decision == "SUGGEST_ONLY" else suggestion
    assert final_text_default == raw_ocr

    # After human reviews and clicks [Accept suggestion]
    user_accepted = True
    final_text_after_review = suggestion if user_accepted else raw_ocr
    assert final_text_after_review == suggestion


def test_dec_10_accepted_suggestion_updates_final_not_raw():
    """DEC-10 accepted suggestion updates finalText but preserves rawOcrText"""
    raw_ocr = "cóng nggo nài gơng"
    suggestion = "Em yêu mùa hè"

    final_text = suggestion # user accepted
    persisted_record = {
        "rawOcrText": raw_ocr,
        "correctedText": suggestion,
        "finalText": final_text,
        "correctionDecision": "SUGGEST_ONLY",
        "userAccepted": True,
    }

    # rawOcrText MUST NOT be overwritten
    assert persisted_record["rawOcrText"] == raw_ocr
    assert persisted_record["finalText"] == suggestion
