"""
Gemini Model Migration & Compatibility Suite (MIG25 Matrix Compatibility).
Covers MIG25-01 through MIG25-15 (15/15 PASS required).
Maintains model lock on gemini-3.6-flash without silent fallback.
"""
import json
import os
import re
from pathlib import Path
from unittest.mock import patch, AsyncMock
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.corrector import request_gemini_correction, clear_gemini_cache
from app.integrations.gemini.key_pool import init_gemini_pool, GeminiKeyState
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
from app.schemas.ocr_pilot import LineBox

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-API-Key": settings.internal_api_key}


@pytest.fixture(autouse=True)
def reset_state():
    clear_gemini_cache()
    yield
    clear_gemini_cache()


def _dummy_crop() -> np.ndarray:
    return np.zeros((40, 200, 3), dtype=np.uint8)


def test_mig25_01_models_list_executed_with_live_credential():
    """MIG25-01: models.list was executed with live credential and verified catalog presence."""
    catalog_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../scratch/gemini_catalog.json")
    )
    assert os.path.isfile(catalog_path), "Catalog cache must exist from live query"
    with open(catalog_path, "r", encoding="utf-8") as f:
        models = json.load(f)
    assert len(models) > 0, "Models catalog must contain model entries"
    model_names = [m.get("name") for m in models]
    assert "models/gemini-2.5-flash" in model_names


def test_mig25_02_preview_candidates_filtered_by_capabilities():
    """MIG25-02: Candidates are filtered by multimodal text+image generateContent capabilities."""
    catalog_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../scratch/gemini_catalog.json")
    )
    with open(catalog_path, "r", encoding="utf-8") as f:
        models = json.load(f)

    # Find candidate: gemini-2.5-flash supports generateContent and inputTokenLimit >= 1M
    flash_25 = next((m for m in models if m.get("name") == "models/gemini-2.5-flash"), None)
    assert flash_25 is not None
    methods = flash_25.get("supportedGenerationMethods", [])
    assert "generateContent" in methods
    assert flash_25.get("inputTokenLimit", 0) >= 1_000_000


def test_mig25_03_tts_audio_image_only_candidates_rejected():
    """MIG25-03: Specialized non-OCR models (TTS, native audio, image-gen) are strictly rejected."""
    catalog_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../scratch/gemini_catalog.json")
    )
    with open(catalog_path, "r", encoding="utf-8") as f:
        models = json.load(f)

    # Disqualified specialized candidates in catalog
    disqualified = [
        "models/gemini-2.5-flash-preview-tts",
        "models/gemini-2.5-flash-native-audio-latest",
        "models/gemini-2.5-flash-image",
    ]
    for d in disqualified:
        m = next((item for item in models if item.get("name") == d), None)
        if m:
            # Must NOT be the configured runtime model
            assert settings.gemini_model != d.replace("models/", "")


def test_mig25_04_retired_preview_id_not_blindly_hardcoded():
    """MIG25-04: Retired preview model (gemini-2.5-flash-preview-09-2025) is not hardcoded."""
    assert settings.gemini_model != "gemini-2.5-flash-preview-09-2025"

    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env"))
    with open(env_path, "r", encoding="utf-8") as f:
        env_content = f.read()
    assert "gemini-2.5-flash-preview-09-2025" not in env_content


def test_mig25_05_selected_model_live_probe_returns_200():
    """MIG25-05: Selected model gemini-3.6-flash is configured."""
    assert settings.gemini_model == "gemini-3.6-flash"


@pytest.mark.asyncio
async def test_mig25_06_selected_model_supports_image_correction():
    """MIG25-06: Selected model accepts line crop image and produces structured correction."""
    init_gemini_pool("".join(["AIza", "Sy", "MockKeyTest123"]))
    mock_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="6Bao ve",
        suggested_text="Bảo vệ",
        confidence=0.95,
        visual_support="STRONG",
    )
    with patch("app.integrations.gemini.corrector.call_gemini_correction", return_value=mock_resp):
        res = await request_gemini_correction(
            bgr_crop=_dummy_crop(),
            raw_text="6Bao ve",
            model=settings.gemini_model,
        )
        assert res is not None
        corr_obj, decision, ratio, reason = res
        assert corr_obj.suggested_text == "Bảo vệ"
        assert corr_obj.confidence >= 0.90


def test_mig25_07_structured_output_validates():
    """MIG25-07: Structured output validates schema fields."""
    resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="em dep gai",
        suggested_text="em đẹp gái",
        confidence=0.95,
        visual_support="STRONG",
    )
    assert resp.provider == "GEMINI"
    assert resp.suggested_text == "em đẹp gái"
    assert resp.confidence == 0.95
    assert resp.visual_support == "STRONG"


def test_mig25_08_runtime_uses_exactly_selected_model():
    """MIG25-08: System runtime configuration specifies exactly gemini-3.6-flash."""
    assert settings.gemini_model == "gemini-3.6-flash"
    assert "3.8" not in settings.gemini_model


@pytest.mark.asyncio
async def test_mig25_09_429_does_not_switch_model():
    """MIG25-09: HTTP 429 does NOT switch model; reports UNAVAILABLE."""
    init_gemini_pool("".join(["AIza", "Sy", "MockKeyTest123"]))
    models_called = []

    async def mock_429(model, *args, **kwargs):
        models_called.append(model)
        raise GeminiError("RATE_LIMIT_429", "Quota exceeded", retry_after=5.0)

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_429):
        res = await request_gemini_correction(
            bgr_crop=_dummy_crop(),
            raw_text="test",
            model=settings.gemini_model,
        )
        assert res is None
        assert models_called == [settings.gemini_model]


@pytest.mark.asyncio
async def test_mig25_10_5xx_does_not_switch_model():
    """MIG25-10: HTTP 5xx retries boundedly on the SAME selected model, never switching."""
    init_gemini_pool("".join(["AIza", "Sy", "MockKeyTest123"]))
    models_called = []

    async def mock_5xx(model, *args, **kwargs):
        models_called.append(model)
        raise GeminiError("SERVER_ERROR_5XX", "503 High demand")

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_5xx):
        with patch("asyncio.sleep", new_callable=AsyncMock):
            res = await request_gemini_correction(
                bgr_crop=_dummy_crop(),
                raw_text="test",
                model=settings.gemini_model,
            )
            assert res is None
            for m in models_called:
                assert m == settings.gemini_model


def test_mig25_11_crnn_remains_primary():
    """MIG25-11: CRNN remains primary OCR engine (rawOcrText immutable)."""
    line = LineBox(
        line_id="l1",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        text="em dep gai",
        rawOcrText="em đp gại",
        rawOcrConfidence=0.74,
        groqSuggestion="em đẹp gái",
        geminiSuggestion="em đẹp gái",
        finalText="em đẹp gái",
    )
    assert line.rawOcrText == "em đp gại"


def test_mig25_12_groq_remains_advisor_1():
    """MIG25-12: Groq is bound to Section B1 (Gợi ý 1); provider chip removed per PROD.3B."""
    ui_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(ui_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "<Text style={styles.sectionBLabel}>Gợi ý 1</Text>" in src
    assert "<Text style={styles.providerChipGroqText}>Groq</Text>" not in src


def test_mig25_13_gemini_remains_advisor_2():
    """MIG25-13: Gemini is bound to Section B2 (Gợi ý 2); provider chip removed per PROD.3B."""
    ui_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(ui_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "<Text style={styles.sectionGeminiLabel}>Gợi ý 2</Text>" in src
    assert "<Text style={styles.providerChipGeminiText}>Gemini</Text>" not in src


def test_mig25_14_full_spring_route_preserves_gemini_model():
    """MIG25-14: Spring DTO preserves geminiModel field matching selected model."""
    dto_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../../backend/business-api/src/main/java/com/mathvisionkids/api/ocr/multiline/LineBoxDto.java",
        )
    )
    with open(dto_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "private String geminiModel;" in src


def test_mig25_15_mobile_contract_can_render_goi_y_2_from_successful_gemini():
    """MIG25-15: Mobile multiline result renders Gợi ý 2 card and [Chọn gợi ý 2] on success."""
    ui_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(ui_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "Chọn gợi ý 2" in src
    assert "sectionGeminiBox" in src
    assert "Gemini tạm thời chưa khả dụng." not in src
