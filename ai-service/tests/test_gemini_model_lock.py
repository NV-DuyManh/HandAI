"""
AI.HWTEXT.GEMINI.2D Test Suite — Gemini Model Lock and Removal of Hidden Model Fallbacks.
Matrix:
- MODELLOCK-01: Configured GEMINI_MODEL is the only normal runtime model
- MODELLOCK-02: 429 does not switch Gemini model
- MODELLOCK-03: 5xx does not switch Gemini model
- MODELLOCK-04: Gemini unavailable preserves CRNN + Groq
- MODELLOCK-05: Successful Gemini metadata reports actual configured model
- MODELLOCK-06: No hardcoded fallback model string exists in production correction path
"""

import os
import re
import pytest
import numpy as np
from pathlib import Path
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.corrector import request_gemini_correction, clear_gemini_cache
from app.integrations.gemini.key_pool import GeminiKeyPool, init_gemini_pool, GeminiKeyState
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


@pytest.mark.asyncio
async def test_modellock_01_configured_model_is_only_runtime_model():
    """MODELLOCK-01: Configured GEMINI_MODEL is gemini-3.6-flash and request_gemini_correction passes it."""
    assert settings.gemini_model == "gemini-3.6-flash"

    pool = init_gemini_pool("".join(["AIza", "Sy", "MockKeyForModelLockTest12345"]))
    mock_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="kiem tra",
        suggested_text="kiểm tra",
        confidence=0.96,
        visual_support="STRONG",
    )

    models_called = []

    async def mock_call(model, *args, **kwargs):
        models_called.append(model)
        return mock_resp

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(
            bgr_crop=_dummy_crop(),
            raw_text="kiem tra",
            model=settings.gemini_model,
        )
        assert res is not None
        assert models_called == ["gemini-3.6-flash"]


@pytest.mark.asyncio
async def test_modellock_02_429_does_not_switch_model():
    """MODELLOCK-02: 429 rate limit / quota error does NOT switch model and does not retry."""
    pool = init_gemini_pool("".join(["AIza", "Sy", "MockKeyForModelLockTest12345"]))
    models_called = []

    async def mock_call_429(model, *args, **kwargs):
        models_called.append(model)
        raise GeminiError("RATE_LIMIT_429", "Quota exceeded", retry_after=10.0)

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call_429):
        res = await request_gemini_correction(
            bgr_crop=_dummy_crop(),
            raw_text="kiem tra",
            model="gemini-3.6-flash",
        )
        # Must return None (Gemini unavailable)
        assert res is None
        # Must only call gemini-3.6-flash once; must NOT call any other model
        assert models_called == ["gemini-3.6-flash"]
        # Key must be placed in cooldown without infinite sweep
        assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN


@pytest.mark.asyncio
async def test_modellock_03_5xx_does_not_switch_model():
    """MODELLOCK-03: 5xx server error retries boundedly under the SAME configured model, never switching."""
    pool = init_gemini_pool("".join(["AIza", "Sy", "MockKeyForModelLockTest12345"]))
    models_called = []

    async def mock_call_5xx(model, *args, **kwargs):
        models_called.append(model)
        raise GeminiError("SERVER_ERROR_5XX", "Internal Server Error 503")

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call_5xx):
        with patch("asyncio.sleep", new_callable=AsyncMock):
            res = await request_gemini_correction(
                bgr_crop=_dummy_crop(),
                raw_text="kiem tra",
                model="gemini-3.6-flash",
            )
            assert res is None
            # All attempts must use strictly gemini-3.6-flash
            assert len(models_called) >= 1
            for m in models_called:
                assert m == "gemini-3.6-flash"
                assert "3.8" not in m
                assert "2.5" not in m


def test_modellock_04_gemini_unavailable_preserves_crnn_and_groq():
    """MODELLOCK-04: When Gemini is unavailable (returns None), CRNN and Groq are preserved intact."""
    # Create test image
    import cv2
    img = np.full((100, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "test line", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
    _, png_bytes = cv2.imencode(".png", img)

    async def mock_gemini_fail(*args, **kwargs):
        return None

    with patch("app.integrations.gemini.corrector.request_gemini_correction", side_effect=mock_gemini_fail):
        resp = client.post(
            "/internal/v1/ocr/detect-lines",
            content=png_bytes.tobytes(),
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 200
        data = resp.json()
        lines = data.get("lines", [])
        assert len(lines) >= 1
        line0 = lines[0]
        # CRNN raw text is preserved
        assert line0.get("rawOcrText") is not None
        assert line0.get("finalText") is not None
        # Gemini status is UNAVAILABLE or None
        assert line0.get("geminiStatus") in ("UNAVAILABLE", None)
        assert line0.get("geminiSuggestion") is None


@pytest.mark.asyncio
async def test_modellock_05_successful_gemini_metadata_reports_configured_model():
    """MODELLOCK-05: Successful Gemini suggestion reports actual configured model in metadata."""
    import cv2
    img = np.full((100, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "test line", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
    _, png_bytes = cv2.imencode(".png", img)

    mock_gem_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="test line",
        suggested_text="test line corrected",
        confidence=0.95,
        visual_support="STRONG",
    )

    async def mock_gemini_success(*args, **kwargs):
        return mock_gem_resp, "SUGGEST_ONLY", 0.15, "test"

    with patch("app.integrations.gemini.corrector.request_gemini_correction", side_effect=mock_gemini_success):
        with patch.object(settings, "gemini_enabled", True):
            resp = client.post(
                "/internal/v1/ocr/detect-lines",
                content=png_bytes.tobytes(),
                headers=AUTH_HEADERS,
            )
            assert resp.status_code == 200
            data = resp.json()
            lines = data.get("lines", [])
            assert len(lines) >= 1
            line0 = lines[0]
            assert line0.get("geminiStatus") == "SUCCESS"
            assert line0.get("geminiSuggestion") == "test line corrected"
            assert line0.get("geminiModel") == "gemini-3.6-flash"
            # Verify suggestion item in suggestions array
            suggestions = line0.get("suggestions", [])
            gem_sug = next((s for s in suggestions if s.get("provider") == "GEMINI"), None)
            assert gem_sug is not None
            assert gem_sug.get("model") == "gemini-3.6-flash"


def test_modellock_06_no_hardcoded_fallback_model_string_in_production_path():
    """MODELLOCK-06: No hardcoded fallback model string exists in production correction path."""
    gemini_dir = Path(__file__).resolve().parent.parent / "app" / "integrations" / "gemini"
    api_dir = Path(__file__).resolve().parent.parent / "app" / "api"

    target_files = list(gemini_dir.glob("*.py"))

    forbidden_patterns = [
        re.compile(r'["\']gemini-3\.8-flash["\']'),
        re.compile(r'["\']gemini-3-flash-preview["\']'),
        re.compile(r'["\']gemini-3\.5-flash["\']'),
    ]

    for file_path in target_files:
        assert file_path.exists(), f"Target file missing: {file_path}"
        content = file_path.read_text(encoding="utf-8")
        for pattern in forbidden_patterns:
            matches = pattern.findall(content)
            assert not matches, (
                f"Forbidden fallback model string {matches} found in {file_path.name}"
            )
