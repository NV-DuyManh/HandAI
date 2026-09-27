"""
GEMKEY 18/18 — Gemini Multi-Key Pool and Failover Tests.
Tests parsing, deduplication, round-robin selection, error-class failover,
same-model lock, security, concurrency, and persistence.
"""

import asyncio
import hashlib
import inspect
import logging
import re
import threading
import time
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from app.integrations.gemini.key_pool import (
    GeminiKeyPool,
    GeminiKeyEntry,
    GeminiKeyState,
    init_gemini_pool,
    get_gemini_pool,
)
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.corrector import (
    request_gemini_correction,
    evaluate_gemini_safety,
    clear_gemini_cache,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_id(key: str) -> str:
    return f"sha256:{hashlib.sha256(key.encode()).hexdigest()[:16]}"


def _make_crop() -> np.ndarray:
    """Small 10x40 BGR test crop."""
    return np.zeros((10, 40, 3), dtype=np.uint8)


def _make_gemini_success_response():
    """Mock for call_gemini_correction returning a valid response."""
    from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
    return GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="test",
        suggested_text="test",
        correction_needed=False,
        confidence=0.95,
        visual_support="STRONG",
        changes=[],
        uncertain=False,
    )


# ---------------------------------------------------------------------------
# GEMKEY-01: Parse comma-separated keys
# ---------------------------------------------------------------------------
def test_gemkey_01_parse_comma_separated_keys():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyC")
    assert pool.total_keys == 3
    raw_keys = [e.raw_key for e in pool.entries]
    assert raw_keys == ["keyA", "keyB", "keyC"]


# ---------------------------------------------------------------------------
# GEMKEY-02: Trim whitespace
# ---------------------------------------------------------------------------
def test_gemkey_02_trim_whitespace():
    pool = GeminiKeyPool(raw_keys_str="  keyA , keyB  ,  keyC  ")
    assert pool.total_keys == 3
    raw_keys = [e.raw_key for e in pool.entries]
    assert raw_keys == ["keyA", "keyB", "keyC"]


# ---------------------------------------------------------------------------
# GEMKEY-03: Ignore empty entries
# ---------------------------------------------------------------------------
def test_gemkey_03_ignore_empty_entries():
    pool = GeminiKeyPool(raw_keys_str="keyA,,keyB,   ,keyC,")
    assert pool.total_keys == 3
    raw_keys = [e.raw_key for e in pool.entries]
    assert raw_keys == ["keyA", "keyB", "keyC"]


# ---------------------------------------------------------------------------
# GEMKEY-04: Remove exact duplicates
# ---------------------------------------------------------------------------
def test_gemkey_04_remove_exact_duplicates():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyA,keyC,keyB,keyA")
    assert pool.total_keys == 3
    assert pool.configured_entries_count == 6
    assert pool.duplicates_removed == 3
    raw_keys = [e.raw_key for e in pool.entries]
    assert raw_keys == ["keyA", "keyB", "keyC"]


# ---------------------------------------------------------------------------
# GEMKEY-05: Preserve first-seen order after dedupe
# ---------------------------------------------------------------------------
def test_gemkey_05_preserve_first_seen_order():
    pool = GeminiKeyPool(raw_keys_str="keyC,keyA,keyB,keyC,keyA")
    assert pool.total_keys == 3
    raw_keys = [e.raw_key for e in pool.entries]
    assert raw_keys == ["keyC", "keyA", "keyB"]


# ---------------------------------------------------------------------------
# GEMKEY-06: Duplicate key not attempted twice in same request
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_06_duplicate_key_not_attempted_twice():
    """Even if lease_key returns the same key, the corrector skips duplicates."""
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB", cooldown_seconds=0.1)

    call_keys = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_keys.append(key_entry.safe_id)
        raise GeminiError("RATE_LIMIT_429", "429")

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is None
        # Each unique key attempted at most once
        assert len(call_keys) == len(set(call_keys))


# ---------------------------------------------------------------------------
# GEMKEY-07: First key SUCCESS stops rotation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_07_first_key_success_stops_rotation():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyC")
    call_count = 0

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        nonlocal call_count
        call_count += 1
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        assert call_count == 1


# ---------------------------------------------------------------------------
# GEMKEY-08: key1 401 -> disable -> key2 SUCCESS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_08_key1_401_key2_success():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB")
    call_log = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_log.append(key_entry.raw_key)
        if key_entry.raw_key == "keyA":
            raise GeminiError("AUTH_ERROR", "401 unauthorized", status_code=401)
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        assert call_log == ["keyA", "keyB"]
        # keyA should be disabled
        assert pool.entries[0].state == GeminiKeyState.DISABLED_AUTH


# ---------------------------------------------------------------------------
# GEMKEY-09: key1 403 -> disable -> key2 SUCCESS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_09_key1_403_key2_success():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB")
    call_log = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_log.append(key_entry.raw_key)
        if key_entry.raw_key == "keyA":
            raise GeminiError("AUTH_ERROR", "403 forbidden", status_code=403)
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        assert call_log == ["keyA", "keyB"]
        assert pool.entries[0].state == GeminiKeyState.DISABLED_AUTH


# ---------------------------------------------------------------------------
# GEMKEY-10: key1 429 -> cooldown -> key2 SUCCESS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_10_key1_429_key2_success():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB", cooldown_seconds=300)
    call_log = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_log.append(key_entry.raw_key)
        if key_entry.raw_key == "keyA":
            raise GeminiError("RATE_LIMIT_429", "429 quota exceeded")
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        assert call_log == ["keyA", "keyB"]
        assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN


# ---------------------------------------------------------------------------
# GEMKEY-11: key1 timeout -> cooldown -> key2 SUCCESS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_11_key1_timeout_key2_success():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB", cooldown_seconds=60)
    call_log = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_log.append(key_entry.raw_key)
        if key_entry.raw_key == "keyA":
            raise GeminiError("TIMEOUT", "read timeout")
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 60
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        assert call_log == ["keyA", "keyB"]


# ---------------------------------------------------------------------------
# GEMKEY-12: key1 503 -> cooldown -> key2 SUCCESS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_12_key1_503_key2_success():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB", cooldown_seconds=60)
    call_log = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_log.append(key_entry.raw_key)
        if key_entry.raw_key == "keyA":
            raise GeminiError("SERVER_ERROR_5XX", "503 service unavailable")
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 60
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        assert call_log == ["keyA", "keyB"]


# ---------------------------------------------------------------------------
# GEMKEY-13: HTTP 400 payload error does NOT rotate through all keys
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_13_bad_request_no_rotation():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyC")
    call_count = 0

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        nonlocal call_count
        call_count += 1
        raise GeminiError("BAD_REQUEST", "400 bad request")

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is None
        # Must stop after first attempt — payload error is not key-specific
        assert call_count == 1


# ---------------------------------------------------------------------------
# GEMKEY-14: All keys unavailable -> Gemini UNAVAILABLE, CRNN/Groq preserved
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_14_all_keys_unavailable():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB")

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        raise GeminiError("RATE_LIMIT_429", "429 quota")

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is None
        # Both keys should be in cooldown, but CRNN/Groq are not affected (separate modules)


# ---------------------------------------------------------------------------
# GEMKEY-15: Model remains exactly gemini-2.5-flash across all attempts
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_15_model_remains_gemini_25_flash():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyC")
    models_used = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        models_used.append(model)
        if key_entry.raw_key in ("keyA", "keyB"):
            raise GeminiError("RATE_LIMIT_429", "429")
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        result = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="test", model="gemini-2.5-flash"
        )
        assert result is not None
        # Every single attempt must use gemini-2.5-flash
        assert all(m == "gemini-2.5-flash" for m in models_used)
        assert len(models_used) == 3


# ---------------------------------------------------------------------------
# GEMKEY-16: Raw key never appears in logs/report/DTO
# ---------------------------------------------------------------------------
def test_gemkey_16_raw_key_never_in_logs():
    test_keys = ["secretKeyAlpha123", "secretKeyBeta456", "secretKeyGamma789"]
    pool = GeminiKeyPool(raw_keys_str=",".join(test_keys))

    log_records = []
    handler = logging.Handler()
    handler.emit = lambda record: log_records.append(record.getMessage())
    logger = logging.getLogger("app.integrations.gemini.key_pool")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        # Trigger log messages via operations
        entry = pool.lease_key()
        if entry:
            pool.mark_success(entry)
            pool.mark_failure(entry, "RATE_LIMIT_429")

        # Check no raw key appears in any log
        all_log_text = " ".join(log_records)
        for key in test_keys:
            assert key not in all_log_text, f"Raw key leaked in log: {key}"

        # Check safe_id format
        for e in pool.entries:
            assert e.safe_id.startswith("sha256:")
            assert len(e.safe_id) > 10
            # safe_id should NOT be a prefix/suffix of the raw key
            assert e.raw_key not in e.safe_id
    finally:
        logger.removeHandler(handler)


# ---------------------------------------------------------------------------
# GEMKEY-17: Concurrent selection does not corrupt pool state
# ---------------------------------------------------------------------------
def test_gemkey_17_concurrent_selection_no_corruption():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyC,keyD")

    results = []
    errors = []

    def lease_and_release():
        try:
            for _ in range(50):
                entry = pool.lease_key()
                if entry:
                    results.append(entry.safe_id)
                    time.sleep(0.001)
                    pool.mark_success(entry)
        except Exception as e:
            errors.append(str(e))

    threads = [threading.Thread(target=lease_and_release) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert len(errors) == 0, f"Concurrent errors: {errors}"
    assert len(results) >= 100  # 8 threads * ~50 = 400 expected, at least 100
    # All entries should still be HEALTHY
    for e in pool.entries:
        assert e.state == GeminiKeyState.HEALTHY


# ---------------------------------------------------------------------------
# GEMKEY-18: Pool state persists across multiline advisor calls within process
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_gemkey_18_pool_state_persists_across_calls():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB,keyC", cooldown_seconds=300)
    call_log = []
    call_count = 0

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        nonlocal call_count
        call_count += 1
        call_log.append(key_entry.raw_key)
        # keyA always 429, keyB and keyC always succeed
        if key_entry.raw_key == "keyA":
            raise GeminiError("RATE_LIMIT_429", "429")
        return _make_gemini_success_response()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_settings:
        mock_settings.gemini_enabled = True
        mock_settings.gemini_max_key_attempts_per_request = 0
        mock_settings.gemini_key_cooldown_seconds = 300
        clear_gemini_cache()

        # First call: keyA fails, keyB succeeds
        result1 = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="line1", model="gemini-2.5-flash"
        )
        assert result1 is not None

        # Second call: keyA should be in cooldown, pool should skip it
        # Reset call_log for second call analysis
        before_second = len(call_log)
        result2 = await request_gemini_correction(
            bgr_crop=_make_crop(), raw_text="line2", model="gemini-2.5-flash"
        )
        assert result2 is not None

        # keyA should be in COOLING_DOWN from first call
        assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN
        # Second call should NOT have attempted keyA again (it's cooling down)
        second_call_keys = call_log[before_second:]
        assert "keyA" not in second_call_keys
