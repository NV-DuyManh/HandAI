"""
GEMPROV tests — Provider lifecycle, isolation, structured response parsing, error failover, and caching.
GEMPROV-01 to GEMPROV-10 (10/10 required).
"""
import asyncio
import time
import pytest
import numpy as np
from unittest.mock import patch, AsyncMock, MagicMock

from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse, GeminiSpanChange
from app.integrations.gemini.key_pool import GeminiKeyPool, GeminiKeyState, init_gemini_pool
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.corrector import (
    request_gemini_correction,
    clear_gemini_cache,
    compute_gemini_cache_key,
    evaluate_gemini_safety,
)


@pytest.fixture(autouse=True)
def reset_state():
    clear_gemini_cache()
    yield
    clear_gemini_cache()


def _dummy_crop() -> np.ndarray:
    return np.zeros((32, 128, 3), dtype=np.uint8)


@pytest.mark.asyncio
async def test_gemprov_01_valid_structured_response():
    """GEMPROV-01: Valid structured JSON response parsed into GeminiOcrCorrectionResponse."""
    raw_response = {
        "provider": "GEMINI",
        "raw_text": "em đp gại",
        "suggested_text": "em đẹp gái",
        "correction_needed": True,
        "confidence": 0.94,
        "visual_support": "STRONG",
        "changes": [
            {
                "raw_span": "đp",
                "suggested_span": "đẹp",
                "reason": "visual_character_evidence",
                "confidence": 0.92,
            }
        ],
        "uncertain": False,
    }
    validated = GeminiOcrCorrectionResponse.model_validate(raw_response)
    assert validated.provider == "GEMINI"
    assert validated.suggested_text == "em đẹp gái"
    assert validated.confidence == 0.94
    assert validated.visual_support == "STRONG"
    assert len(validated.changes) == 1
    assert validated.changes[0].suggested_span == "đẹp"


def test_gemprov_02_malformed_response_rejected():
    """GEMPROV-02: Malformed response missing required fields is rejected."""
    bad_data = {
        "provider": "GEMINI",
        "random_field": "test",
        # missing raw_text, suggested_text
    }
    with pytest.raises(Exception):
        GeminiOcrCorrectionResponse.model_validate(bad_data)


@pytest.mark.asyncio
async def test_gemprov_03_timeout_isolated():
    """GEMPROV-03: Timeout in Gemini call is caught and returns None without propagating."""
    pool = init_gemini_pool("AIzaFakeKey1,AIzaFakeKey2")

    async def mock_timeout(*args, **kwargs):
        raise GeminiError("TIMEOUT", "Request timed out after 10s")

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_timeout):
        res = await request_gemini_correction(
            bgr_crop=_dummy_crop(),
            raw_text="thử nghiệm",
            raw_confidence=0.75,
            timeout_seconds=0.1,
        )
        assert res is None


@pytest.mark.asyncio
async def test_gemprov_04_401_failover():
    """GEMPROV-04: 401 error disables the bad credential and fails over to the next healthy key."""
    pool = init_gemini_pool("AIzaBadKey1,AIzaGoodKey2")

    calls = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        calls.append(key_entry.raw_key)
        if key_entry.raw_key == "AIzaBadKey1":
            raise GeminiError("AUTH_ERROR", "Invalid API Key", status_code=401)
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="kết quả tốt",
            correction_needed=True,
            confidence=0.92,
        )

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        # Call 1: BadKey1 -> AUTH_ERROR -> disabled -> immediate failover to GoodKey2 -> success
        res1 = await request_gemini_correction(_dummy_crop(), "kết quả", raw_confidence=0.70)
        assert res1 is not None, "Multi-key failover should succeed when key2 is healthy"
        assert res1[0].suggested_text == "kết quả tốt"
        assert pool.entries[0].state == GeminiKeyState.DISABLED_AUTH
        assert pool.entries[1].state == GeminiKeyState.HEALTHY
        assert calls == ["AIzaBadKey1", "AIzaGoodKey2"]


@pytest.mark.asyncio
async def test_gemprov_05_403_handling():
    """GEMPROV-05: 403 permission/auth error disables the credential safely."""
    pool = init_gemini_pool("AIzaForbiddenKey")
    k = pool.lease_key()
    pool.mark_failure(k, "403")
    assert k.state == GeminiKeyState.DISABLED_AUTH
    assert pool.active_keys == 0
    assert pool.lease_key() is None


@pytest.mark.asyncio
async def test_gemprov_06_5xx_bounded_failover():
    """GEMPROV-06: 5xx transient server error sets key into cooldown without permanent disabling."""
    pool = init_gemini_pool("AIzaKeyA,AIzaKeyB", rotate_on_429=False)
    k1 = pool.lease_key()
    assert k1.raw_key == "AIzaKeyA"
    pool.mark_failure(k1, "503")
    assert k1.state == GeminiKeyState.COOLING_DOWN

    # Next lease returns KeyB
    k2 = pool.lease_key()
    assert k2.raw_key == "AIzaKeyB"


@pytest.mark.asyncio
async def test_gemprov_07_429_no_aggressive_key_sweep():
    """GEMPROV-07: 429 quota exhaustion respects GEMINI_ROTATE_ON_429=false without sweeping."""
    pool = init_gemini_pool("AIzaKey1,AIzaKey2,AIzaKey3", rotate_on_429=False)
    assert pool.rotate_on_429 is False

    k1 = pool.lease_key()
    assert k1.raw_key == "AIzaKey1"
    # Mark 429 failure
    pool.mark_failure(k1, "429", retry_after=30.0)
    assert k1.state == GeminiKeyState.COOLING_DOWN
    assert k1.cooldown_until > time.time() + 25.0


@pytest.mark.asyncio
async def test_gemprov_08_cache_hit_avoids_second_call():
    """GEMPROV-08: Identical crop and raw text hits cache and avoids network call."""
    pool = init_gemini_pool("AIzaCacheKey")
    call_count = 0

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        nonlocal call_count
        call_count += 1
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="dòng chữ chuẩn",
            confidence=0.95,
            visual_support="STRONG",
        )

    crop = _dummy_crop()
    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res1 = await request_gemini_correction(crop, "dòng chữ", raw_confidence=0.7)
        assert res1 is not None
        assert call_count == 1

        # Second call with identical crop and raw_text
        res2 = await request_gemini_correction(crop, "dòng chữ", raw_confidence=0.7)
        assert res2 is not None
        assert call_count == 1  # No network call


@pytest.mark.asyncio
async def test_gemprov_09_raw_ocr_change_causes_cache_miss():
    """GEMPROV-09: Changing raw OCR text causes cache miss and triggers new request."""
    pool = init_gemini_pool("AIzaCacheKey")
    call_count = 0

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        nonlocal call_count
        call_count += 1
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="sửa lại",
            confidence=0.91,
            visual_support="STRONG",
        )

    crop = _dummy_crop()
    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res1 = await request_gemini_correction(crop, "văn bản 1", raw_confidence=0.7)
        assert call_count == 1

        res2 = await request_gemini_correction(crop, "văn bản 2", raw_confidence=0.7)
        assert call_count == 2


@pytest.mark.asyncio
async def test_gemprov_10_gemini_error_never_breaks_crnn_result():
    """GEMPROV-10: Complete Gemini failure returns None, keeping raw CRNN untouched."""
    init_gemini_pool("AIzaCrashKey")

    async def mock_crash(*args, **kwargs):
        raise RuntimeError("Complete unexpected network crash")

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_crash):
        res = await request_gemini_correction(_dummy_crop(), "chữ gốc crnn", raw_confidence=0.6)
        assert res is None
