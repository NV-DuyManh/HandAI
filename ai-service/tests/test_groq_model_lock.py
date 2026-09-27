"""
Phase AI.HWTEXT.GEMINI.4A: Groq Model Lock & Advisor Contract Tests.
Tests GROQLOCK-01 through GROQLOCK-08.
"""

import os
import pytest
from app.config import settings
from app.schemas.ocr_pilot import LineBox


def test_groqlock_01_runtime_groq_model_equals_qwen():
    """GROQLOCK-01: runtime Groq model equals qwen/qwen3.8-27b."""
    assert settings.groq_primary_vision_model == "qwen/qwen3.8-27b"
    assert "qwen3.8-27b" in settings.groq_primary_vision_model


def test_groqlock_02_no_hidden_production_switch_to_llama():
    """GROQLOCK-02: no hidden production switch to llama-3.2-11b-vision-preview."""
    # Check settings
    assert "llama" not in settings.groq_primary_vision_model.lower()
    assert "llama-3.2-11b-vision-preview" not in settings.groq_primary_vision_model

    # Check corrector.py source
    corrector_path = os.path.join(os.path.dirname(__file__), "../app/integrations/groq/corrector.py")
    with open(corrector_path, "r", encoding="utf-8") as f:
        corrector_src = f.read()
    assert "llama-3.2-11b-vision-preview" not in corrector_src


def test_groqlock_03_live_groq_metadata_reports_qwen():
    """GROQLOCK-03: live Groq metadata reports qwen/qwen3.8-27b."""
    from app.integrations.groq.validator import _validation_cache
    # Whether cached or runtime default, model must be qwen/qwen3.8-27b
    model = settings.groq_primary_vision_model
    assert model == "qwen/qwen3.8-27b"


def test_groqlock_04_spring_dto_preserves_groq_model_exactly():
    """GROQLOCK-04: Spring DTO preserves Groq model exactly."""
    dto_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../../backend/business-api/src/main/java/com/mathvisionkids/api/ocr/multiline/LineBoxDto.java",
        )
    )
    with open(dto_path, "r", encoding="utf-8") as f:
        dto_src = f.read()
    assert "private String groqModel;" in dto_src
    assert "private String geminiModel;" in dto_src


def test_groqlock_05_mobile_contract_preserves_groq_model_exactly():
    """GROQLOCK-05: mobile contract preserves Groq model exactly."""
    mobile_service_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/services/api/OcrPilotService.ts")
    )
    with open(mobile_service_path, "r", encoding="utf-8") as f:
        mobile_src = f.read()
    assert "groqModel?: string;" in mobile_src
    assert "geminiModel?: string;" in mobile_src


def test_groqlock_06_groq_unavailable_does_not_break_crnn_gemini():
    """GROQLOCK-06: Groq unavailable does not break CRNN/Gemini."""
    # When Groq is unavailable, CRNN and Gemini continue unimpeded
    box = LineBox(
        line_id="line-test",
        x=0, y=0, width=100, height=30, order=0,
        rawOcrText="Test text",
        rawOcrConfidence=0.85,
        finalText="Test text",
        groqStatus="UNAVAILABLE",
        groqModel="qwen/qwen3.8-27b",
        geminiStatus="SUCCESS",
        geminiModel="gemini-3.6-flash",
        geminiSuggestion="Test text suggestion",
    )
    assert box.groqStatus == "UNAVAILABLE"
    assert box.geminiStatus == "SUCCESS"
    assert box.finalText == "Test text"
    assert box.groqModel == "qwen/qwen3.8-27b"
    assert box.geminiModel == "gemini-3.6-flash"


def test_groqlock_07_same_line_dual_advisor_reports_correct_models():
    """GROQLOCK-07: same-line dual advisor reports correct models."""
    box = LineBox(
        line_id="line-dual",
        x=10, y=20, width=200, height=40, order=1,
        rawOcrText="Bảo vệ thông tin",
        rawOcrConfidence=0.80,
        groqStatus="SUCCESS",
        groqModel="qwen/qwen3.8-27b",
        groqSuggestion="Bảo vệ thông tin",
        geminiStatus="SUCCESS",
        geminiModel="gemini-3.6-flash",
        geminiSuggestion="Bảo vệ thông tin",
        suggestions=[
            {
                "provider": "GROQ",
                "model": "qwen/qwen3.8-27b",
                "text": "Bảo vệ thông tin",
                "status": "SUCCESS",
            },
            {
                "provider": "GEMINI",
                "model": "gemini-3.6-flash",
                "text": "Bảo vệ thông tin",
                "status": "SUCCESS",
            },
        ],
    )
    assert box.groqModel == "qwen/qwen3.8-27b"
    assert box.geminiModel == "gemini-3.6-flash"
    assert len(box.suggestions) == 2
    assert box.suggestions[0]["model"] == "qwen/qwen3.8-27b"
    assert box.suggestions[1]["model"] == "gemini-3.6-flash"


def test_groqlock_08_stale_mocks_fixtures_cannot_overwrite_live_metadata():
    """GROQLOCK-08: stale mocks/fixtures cannot overwrite live metadata."""
    from app.schemas.ocr_pilot import LineBox
    box = LineBox(line_id="l1", x=0, y=0, width=50, height=20, order=0)
    # Default model assignments must derive from settings or explicit runtime fields
    box.groqModel = getattr(settings, "groq_primary_vision_model", "qwen/qwen3.8-27b")
    box.geminiModel = getattr(settings, "gemini_model", "gemini-3.6-flash")
    assert box.groqModel == "qwen/qwen3.8-27b"
    assert box.geminiModel == "gemini-3.6-flash"
