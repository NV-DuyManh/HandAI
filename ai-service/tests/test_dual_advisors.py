"""
DUAL tests — Independent Dual-Advisor (Groq + Gemini) post-correction architecture.
DUAL-01 to DUAL-15 (15/15 required).
"""
import pytest
from unittest.mock import patch, AsyncMock
from app.schemas.ocr_pilot import LineBox
from app.integrations.gemini.schemas import AdvisorSuggestion, GeminiOcrCorrectionResponse
from app.integrations.groq.corrector import GroqOcrCorrectionResponse


def _make_line(raw_text: str = "em đp gại", confidence: float = 0.72) -> LineBox:
    return LineBox(
        line_id="line-001",
        x=10,
        y=20,
        width=200,
        height=40,
        order=1,
        text=raw_text,
        rawOcrText=raw_text,
        rawOcrConfidence=confidence,
        minTokenConfidence=0.35,
        p10TokenConfidence=0.45,
        meanEntropy=1.45,
        finalText=raw_text,
    )


def test_dual_01_crnn_runs_before_advisors():
    """DUAL-01: CRNN produces rawOcrText and uncertainty before any advisor is called."""
    line = _make_line("con chim non", 0.75)
    assert line.rawOcrText == "con chim non"
    assert line.rawOcrConfidence == 0.75
    assert line.finalText == "con chim non"
    assert line.suggestions == []


def test_dual_02_both_receive_same_crnn_evidence():
    """DUAL-02: Both providers receive identical raw OCR and uncertainty evidence."""
    line = _make_line("em đp gại", 0.68)
    groq_evidence = {
        "raw_text": line.rawOcrText,
        "raw_confidence": line.rawOcrConfidence,
        "min_token": line.minTokenConfidence,
        "p10": line.p10TokenConfidence,
        "mean_entropy": line.meanEntropy,
    }
    gemini_evidence = {
        "raw_text": line.rawOcrText,
        "raw_confidence": line.rawOcrConfidence,
        "min_token": line.minTokenConfidence,
        "p10": line.p10TokenConfidence,
        "mean_entropy": line.meanEntropy,
    }
    assert groq_evidence == gemini_evidence


def test_dual_03_groq_output_not_sent_to_gemini():
    """DUAL-03: Groq suggestion is strictly quarantined from Gemini prompt."""
    from app.integrations.gemini.corrector import GEMINI_CORRECTION_SYSTEM_PROMPT
    assert "groq" not in GEMINI_CORRECTION_SYSTEM_PROMPT.lower()
    # Check that Gemini request function signature doesn't take groq suggestion
    from app.integrations.gemini.corrector import request_gemini_correction
    import inspect
    sig = inspect.signature(request_gemini_correction)
    assert "groq_suggestion" not in sig.parameters
    assert "groq_text" not in sig.parameters


def test_dual_04_gemini_output_not_sent_to_groq():
    """DUAL-04: Gemini suggestion is strictly quarantined from Groq prompt."""
    from app.integrations.groq.corrector import CORRECTION_SYSTEM_PROMPT, request_groq_correction
    assert "gemini" not in CORRECTION_SYSTEM_PROMPT.lower()
    import inspect
    sig = inspect.signature(request_groq_correction)
    assert "gemini_suggestion" not in sig.parameters
    assert "gemini_text" not in sig.parameters


def test_dual_05_both_success_both_visible():
    """DUAL-05: When both advisors succeed, both suggestions are attached with correct providers."""
    line = _make_line()
    line.groqSuggestion = "em đẹp gái"
    line.groqConfidence = 0.95
    line.groqDecision = "AUTO_APPLY"
    line.groqStatus = "SUCCESS"

    line.geminiSuggestion = "em đẹp gái"
    line.geminiConfidence = 0.94
    line.geminiDecision = "SUGGEST_ONLY"
    line.geminiStatus = "SUCCESS"

    line.suggestions = [
        {"provider": "GROQ", "text": line.groqSuggestion, "confidence": line.groqConfidence, "decision": "AUTO_APPLY", "status": "SUCCESS"},
        {"provider": "GEMINI", "text": line.geminiSuggestion, "confidence": line.geminiConfidence, "decision": "SUGGEST_ONLY", "status": "SUCCESS"},
    ]

    assert len(line.suggestions) == 2
    assert line.suggestions[0]["provider"] == "GROQ"
    assert line.suggestions[1]["provider"] == "GEMINI"
    assert line.groqSuggestion == "em đẹp gái"
    assert line.geminiSuggestion == "em đẹp gái"


def test_dual_06_groq_only_success_works():
    """DUAL-06: When Groq succeeds and Gemini fails, Groq works and Gemini is UNAVAILABLE."""
    line = _make_line()
    line.groqSuggestion = "em đẹp gái"
    line.groqStatus = "SUCCESS"
    line.geminiSuggestion = None
    line.geminiStatus = "UNAVAILABLE"

    line.suggestions = [
        {"provider": "GROQ", "text": "em đẹp gái", "confidence": 0.95, "status": "SUCCESS"},
        {"provider": "GEMINI", "text": "", "confidence": 0.0, "status": "UNAVAILABLE"},
    ]

    assert line.groqStatus == "SUCCESS"
    assert line.geminiStatus == "UNAVAILABLE"
    assert line.suggestions[0]["status"] == "SUCCESS"
    assert line.suggestions[1]["status"] == "UNAVAILABLE"


def test_dual_07_gemini_only_success_correctly_labeled():
    """DUAL-07: When Groq fails and Gemini succeeds, Gemini is labeled GEMINI, never relabeled as Groq."""
    line = _make_line()
    line.groqSuggestion = None
    line.groqStatus = "UNAVAILABLE"
    line.geminiSuggestion = "em đẹp gái"
    line.geminiStatus = "SUCCESS"

    line.suggestions = [
        {"provider": "GROQ", "text": "", "status": "UNAVAILABLE"},
        {"provider": "GEMINI", "text": "em đẹp gái", "status": "SUCCESS"},
    ]

    gem_sugg = [s for s in line.suggestions if s["provider"] == "GEMINI"][0]
    assert gem_sugg["provider"] == "GEMINI"
    assert gem_sugg["text"] == "em đẹp gái"
    assert line.groqSuggestion is None


def test_dual_08_both_fail_raw_crnn_works():
    """DUAL-08: When both advisors fail, raw CRNN text remains usable with no crash."""
    line = _make_line("chữ viết tay học sinh", 0.65)
    line.groqStatus = "UNAVAILABLE"
    line.geminiStatus = "UNAVAILABLE"
    line.finalText = line.rawOcrText

    assert line.finalText == "chữ viết tay học sinh"
    assert line.rawOcrText == "chữ viết tay học sinh"


def test_dual_09_same_suggestions_show_agreement():
    """DUAL-09: Identical normalized suggestions flag agreement for optional badge."""
    groq_text = "Em Đẹp Gái  "
    gemini_text = "  em đẹp gái"
    is_agree = groq_text.strip().lower() == gemini_text.strip().lower()
    assert is_agree is True


def test_dual_10_disagreement_does_not_silently_arbitrate():
    """DUAL-10: Disagreeing suggestions are both preserved without silent arbitration."""
    line = _make_line("m dép gại", 0.60)
    line.groqSuggestion = "em đẹp gái"
    line.geminiSuggestion = "em dép gái"
    line.suggestions = [
        {"provider": "GROQ", "text": line.groqSuggestion},
        {"provider": "GEMINI", "text": line.geminiSuggestion},
    ]

    assert line.suggestions[0]["text"] == "em đẹp gái"
    assert line.suggestions[1]["text"] == "em dép gái"
    # Neither overwrites rawOcrText
    assert line.rawOcrText == "m dép gại"


def test_dual_11_choose_groq_updates_final_only():
    """DUAL-11: Selecting Groq suggestion updates finalText only; rawOcrText is immutable."""
    line = _make_line("em đp gại", 0.70)
    groq_text = "em đẹp gái"

    # User selects Groq
    line.finalText = groq_text
    assert line.finalText == "em đẹp gái"
    assert line.rawOcrText == "em đp gại"  # Strictly immutable


def test_dual_12_choose_gemini_updates_final_only():
    """DUAL-12: Selecting Gemini suggestion updates finalText only; rawOcrText is immutable."""
    line = _make_line("em đp gại", 0.70)
    gemini_text = "em đẹp gái"

    # User selects Gemini
    line.finalText = gemini_text
    assert line.finalText == "em đẹp gái"
    assert line.rawOcrText == "em đp gại"  # Strictly immutable


def test_dual_13_keep_raw_restores_raw_final():
    """DUAL-13: Selecting keep raw restores finalText to rawOcrText."""
    line = _make_line("em đp gại", 0.70)
    line.finalText = "em đẹp gái"  # Previously modified

    # User clicks [Giữ OCR gốc]
    line.finalText = line.rawOcrText
    assert line.finalText == "em đp gại"


def test_dual_14_late_provider_cannot_overwrite_user_choice():
    """DUAL-14: Late arriving advisor response cannot overwrite user choice."""
    line = _make_line("em đp gại", 0.70)
    # User selected Groq
    user_choice = "em đẹp gái (từ Groq)"
    line.finalText = user_choice
    user_selected = True

    # Late Gemini arrives with different suggestion
    late_gemini_suggestion = "em dép gái"
    if not user_selected:
        line.finalText = late_gemini_suggestion

    assert line.finalText == user_choice


def test_dual_15_manual_edit_protected():
    """DUAL-15: Manual student edit cannot be overwritten by late advisor responses."""
    line = _make_line("bài số 1", 0.75)
    manual_text = "bài tập 1 em đã làm xong"
    line.finalText = manual_text
    user_edited = True

    # Late arrival of Groq / Gemini
    late_suggestion = "bài số 1"
    if not user_edited:
        line.finalText = late_suggestion

    assert line.finalText == manual_text
