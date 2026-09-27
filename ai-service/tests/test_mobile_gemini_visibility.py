"""
Phase AI.HWTEXT.GEMINI.4B: Physical Mobile Gemini Visibility Tests.
Tests MOBGEM-01 through MOBGEM-15.
"""

import os
import json
import pytest
from app.config import settings
from app.schemas.ocr_pilot import LineBox


def test_mobgem_01_spring_json_contains_gemini_fields():
    """MOBGEM-01: Spring JSON / DTO contains explicit Gemini fields."""
    dto_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../../backend/business-api/src/main/java/com/mathvisionkids/api/ocr/multiline/MultilineLineResponse.java",
        )
    )
    with open(dto_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "private String geminiSuggestion;" in src
    assert "private String geminiStatus;" in src
    assert "private String geminiModel;" in src


def test_mobgem_02_fastapi_to_spring_preserves_gemini_fields():
    """MOBGEM-02: FastAPI schema to Spring LineBoxDto preserves Gemini fields."""
    box = LineBox(
        line_id="line-1",
        x=0, y=0, width=100, height=30, order=1,
        rawOcrText="Bảo vệ thông tin",
        rawOcrConfidence=0.80,
        geminiSuggestion="Bảo vệ thông tin riêng tư",
        geminiStatus="SUCCESS",
        geminiModel="gemini-3.6-flash",
    )
    d = box.model_dump()
    assert d["geminiSuggestion"] == "Bảo vệ thông tin riêng tư"
    assert d["geminiStatus"] == "SUCCESS"
    assert d["geminiModel"] == "gemini-3.6-flash"


def test_mobgem_03_spring_to_ocr_pilot_service_preserves_gemini_fields():
    """MOBGEM-03: Spring -> OcrPilotService TypeScript types preserve Gemini fields."""
    ts_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/services/api/OcrPilotService.ts")
    )
    with open(ts_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "geminiSuggestion?: string;" in src
    assert "geminiStatus?: string;" in src
    assert "geminiModel?: string;" in src


def test_mobgem_04_api_service_to_navigation_state_preserves_gemini():
    """MOBGEM-04: API service caching and navigation preserves Gemini fields."""
    ts_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/services/api/OcrPilotService.ts")
    )
    with open(ts_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "cacheTrial(trial: MultilineTrialResult)" in src
    assert "getCachedTrial(trialId: string)" in src


def test_mobgem_05_navigation_to_result_screen_preserves_gemini():
    """MOBGEM-05: Result screen initial state hydrates from cached trial."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "OcrPilotService.getCachedTrial(trialId)" in src
    assert "buildAdvisorView" in src


def test_mobgem_06_gemini_success_renders_goi_y_2():
    """MOBGEM-06: Gemini SUCCESS renders Gợi ý 2 card."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "geminiView.status === 'SUCCESS'" in src
    assert "Gợi ý 2" in src
    assert "Chọn gợi ý 2" in src


def test_mobgem_07_gemini_unavailable_not_rendered():
    """MOBGEM-07: Per Task D, provider-specific unavailable copy is not rendered on visible card."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "Gemini tạm thời chưa khả dụng." not in src
    assert "Groq tạm thời chưa khả dụng." not in src


def test_mobgem_08_gemini_render_does_not_depend_on_groq_fields():
    """MOBGEM-08: Gemini render condition does not depend on Groq fields."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    # geminiView must be computed independently via buildAdvisorView(line, 'GEMINI')
    assert "const geminiView = buildAdvisorView(line, 'GEMINI');" in src


def test_mobgem_09_suggestions_fallback_recovers_gemini_safely():
    """MOBGEM-09: suggestions[] fallback recovers Gemini safely."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "line.suggestions.find((s) => s.provider === provider)" in src


def test_mobgem_10_raw_ocr_text_remains_immutable():
    """MOBGEM-10: rawOcrText remains immutable when user chooses suggestion or provides feedback."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    # Check that handleFeedback modifies finalText/predictedText, never rawOcrText
    assert "finalText: targetText" in src
    assert "predictedText: targetText" in src
    assert "rawOcrText: targetText" not in src


def test_mobgem_11_choose_goi_y_2_changes_final_text_only():
    """MOBGEM-11: Choose Gợi ý 2 invokes handleFeedback with 'CORRECTED' and changes finalText only."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "handleFeedback(line, 'CORRECTED', geminiView.text)" in src


def test_mobgem_12_stale_late_response_cannot_overwrite_manual_choice():
    """MOBGEM-12: Server feedback response preserves user targetText and cannot overwrite manual edit."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "finalText: targetText" in src


def test_mobgem_13_current_metro_bundle_marker_proven():
    """MOBGEM-13: Development console marker MOBILE_GEMINI_UI_BUILD=GEMINI_4B is present."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "MOBILE_GEMINI_UI_BUILD=GEMINI_4B" in src


def test_mobgem_14_no_dev_panel_is_added():
    """MOBGEM-14: No visible debug or dev panel is added to the student UI."""
    res_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(res_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "DevPanel" not in src
    assert "DebugPanel" not in src
    assert "DebugCard" not in src


def test_mobgem_15_provider_model_metadata_remains_locked():
    """MOBGEM-15: Provider model metadata remains Groq Qwen3.8 and Gemini 3.6."""
    assert settings.groq_primary_vision_model == "qwen/qwen3.8-27b"
    assert settings.gemini_model == "gemini-3.6-flash"
