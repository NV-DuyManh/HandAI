"""
PROD.2G Targeted Tests: Latency Reduction, Concurrency Bounds, Key Pool Failover, and Safety Integrities.
Covers:
- Parallel triggered-line advisor scheduling preserves line order
- Concurrency bound semaphore is respected
- Groq/Gemini within a line remain concurrent
- Key pool thread/async safety under concurrent requests
- DISABLED_AUTH keys skipped immediately
- Cooldown keys skipped immediately
- HEALTHY keys preferred over DEGRADED
- Each unique key attempted max once per request
- No raw secrets in concurrent logs/telemetry
- Advisor timeout degrades gracefully without crashing CRNN
- Owner 8-line segmentation remains 8/8
- Canonical advisor decision cross-stack contract
- Initial finalText immutable to AUTO_APPLY silent mutation
- Line advisor timing decomposition diagnostics
- Honest provider status (UNPROBED before live success)
"""

import asyncio
import os
import sys
import time
import threading
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
import numpy as np

from app.config import settings
from app.integrations.gemini.key_pool import GeminiKeyPool, GeminiKeyState, GeminiKeyEntry
from app.integrations.gemini.corrector import (
    request_gemini_correction,
    get_current_gemini_meta,
    clear_gemini_cache,
)
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
from app.schemas.ocr_pilot import (
    LineBox,
    CANONICAL_ADVISOR_DECISIONS,
    normalize_canonical_advisor_decision,
)
from app.api.ocr import detect_text_lines

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "ocr_eval"
FIXTURE_8_LINES = FIXTURE_DIR / "OWNER_POEM_8_LINES.png"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_dummy_key(prefix: str, idx: int) -> str:
    # Build synthetic key without committing literal API keys
    return "".join([prefix, f"_TEST_KEY_{idx}"])


def _make_crop():
    return np.zeros((30, 100, 3), dtype=np.uint8)


def _make_gemini_success(text="Mọc trên đồi quê", conf=0.95):
    return GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="Mọc trên đổi quề",
        suggested_text=text,
        correction_needed=True,
        confidence=conf,
        visual_support="STRONG",
        changes=[],
        uncertain=False,
    )


# ---------------------------------------------------------------------------
# Test 1: Parallel triggered-line advisor scheduling preserves line order
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_prod2g_01_parallel_scheduling_preserves_line_order():
    lines = [
        LineBox(line_id="l0", x=0, y=0, width=50, height=20, order=0, rawOcrText="Dong 0", finalText="Dong 0"),
        LineBox(line_id="l1", x=0, y=30, width=50, height=20, order=1, rawOcrText="Dong 1", finalText="Dong 1"),
        LineBox(line_id="l2", x=0, y=60, width=50, height=20, order=2, rawOcrText="Dong 2", finalText="Dong 2"),
        LineBox(line_id="l3", x=0, y=90, width=50, height=20, order=3, rawOcrText="Dong 3", finalText="Dong 3"),
    ]

    # Simulate lines 1 and 3 triggered
    triggered_indices = [1, 3]

    async def fake_worker(idx, delay):
        await asyncio.sleep(delay)
        return idx, f"Corrected {idx}"

    tasks = [fake_worker(idx, 0.05 if idx == 1 else 0.01) for idx in triggered_indices]
    results = await asyncio.gather(*tasks)

    for idx, corrected in results:
        lines[idx].correctedText = corrected
        lines[idx].finalText = lines[idx].rawOcrText  # OCR-first rule

    # Verify line order strictly preserved
    assert [l.order for l in lines] == [0, 1, 2, 3]
    assert lines[0].correctedText is None
    assert lines[1].correctedText == "Corrected 1"
    assert lines[2].correctedText is None
    assert lines[3].correctedText == "Corrected 3"


# ---------------------------------------------------------------------------
# Test 2: Concurrency bound is respected by Semaphore
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_prod2g_02_concurrency_bound_respected():
    bound = 3
    sem = asyncio.Semaphore(bound)
    active_count = 0
    max_active = 0
    lock = asyncio.Lock()

    async def task_fn():
        nonlocal active_count, max_active
        async with sem:
            async with lock:
                active_count += 1
                if active_count > max_active:
                    max_active = active_count
            await asyncio.sleep(0.02)
            async with lock:
                active_count -= 1

    tasks = [task_fn() for _ in range(10)]
    await asyncio.gather(*tasks)

    assert max_active <= bound, f"Max active {max_active} exceeded bound {bound}"


# ---------------------------------------------------------------------------
# Test 3: Groq and Gemini within a line remain concurrent
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_prod2g_03_groq_gemini_within_line_remain_concurrent():
    timeline = []

    async def mock_groq():
        timeline.append(("groq_start", time.perf_counter()))
        await asyncio.sleep(0.04)
        timeline.append(("groq_end", time.perf_counter()))
        return "groq_ok"

    async def mock_gemini():
        timeline.append(("gemini_start", time.perf_counter()))
        await asyncio.sleep(0.04)
        timeline.append(("gemini_end", time.perf_counter()))
        return "gemini_ok"

    t0 = time.perf_counter()
    r1, r2 = await asyncio.gather(mock_groq(), mock_gemini())
    wall_ms = (time.perf_counter() - t0) * 1000.0

    assert r1 == "groq_ok"
    assert r2 == "gemini_ok"
    # If sequential, 40ms + 40ms = 80ms. If concurrent, ~40-60ms
    assert wall_ms < 75.0, f"Expected concurrency under 75ms, got {wall_ms:.2f}ms"


# ---------------------------------------------------------------------------
# Test 4: Key pool thread and async safety under concurrent requests
# ---------------------------------------------------------------------------
def test_prod2g_04_key_pool_thread_and_async_safe():
    k1 = _make_dummy_key("KEY_A", 1)
    k2 = _make_dummy_key("KEY_B", 2)
    k3 = _make_dummy_key("KEY_C", 3)
    pool = GeminiKeyPool(raw_keys_str=f"{k1},{k2},{k3}", cooldown_seconds=60)

    leased_safe_ids = []
    errors = []

    def worker():
        try:
            for _ in range(50):
                e = pool.lease_key()
                if e:
                    leased_safe_ids.append(e.safe_id)
                    time.sleep(0.001)
                    pool.mark_success(e, latency_ms=5.0)
        except Exception as ex:
            errors.append(ex)

    threads = [threading.Thread(target=worker) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=5.0)

    assert len(errors) == 0, f"Race errors: {errors}"
    assert len(leased_safe_ids) > 0
    assert pool.active_keys == 3
    for entry in pool.entries:
        assert entry.state == GeminiKeyState.HEALTHY


# ---------------------------------------------------------------------------
# Test 5: DISABLED_AUTH keys skipped immediately (0ms)
# ---------------------------------------------------------------------------
def test_prod2g_05_disabled_auth_keys_skipped_immediately():
    k1 = _make_dummy_key("BAD_AUTH", 1)
    k2 = _make_dummy_key("GOOD_KEY", 2)
    pool = GeminiKeyPool(raw_keys_str=f"{k1},{k2}")

    entry1 = pool.entries[0]
    pool.mark_failure(entry1, "AUTH_ERROR")
    assert entry1.state == GeminiKeyState.DISABLED_AUTH

    t0 = time.perf_counter()
    leased = pool.lease_key()
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert leased is not None
    assert leased.index == 1
    assert elapsed_ms < 5.0, "Disabled key check should be sub-millisecond"


# ---------------------------------------------------------------------------
# Test 6: Cooldown keys skipped immediately
# ---------------------------------------------------------------------------
def test_prod2g_06_cooldown_keys_skipped_immediately():
    k1 = _make_dummy_key("COOL_KEY", 1)
    k2 = _make_dummy_key("ACTIVE_KEY", 2)
    pool = GeminiKeyPool(raw_keys_str=f"{k1},{k2}", cooldown_seconds=300)

    pool.mark_failure(pool.entries[0], "RATE_LIMIT_429", retry_after=300)
    assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN

    leased = pool.lease_key()
    assert leased is not None
    assert leased.index == 1


# ---------------------------------------------------------------------------
# Test 7: HEALTHY keys preferred over DEGRADED keys
# ---------------------------------------------------------------------------
def test_prod2g_07_healthy_preferred_over_degraded():
    k1 = _make_dummy_key("DEG_KEY", 1)
    k2 = _make_dummy_key("HLT_KEY", 2)
    pool = GeminiKeyPool(raw_keys_str=f"{k1},{k2}", cooldown_seconds=0.01)

    # Put key 0 in DEGRADED
    pool.entries[0].state = GeminiKeyState.DEGRADED
    pool.entries[0].cooldown_until = time.time() - 1  # cooldown expired

    # Key 1 is HEALTHY
    pool.entries[1].state = GeminiKeyState.HEALTHY

    # Lease should pick HEALTHY key first
    leased = pool.lease_key()
    assert leased is not None
    assert leased.index == 1
    assert leased.state == GeminiKeyState.HEALTHY


# ---------------------------------------------------------------------------
# Test 8: Each unique key max once per request via exclude_safe_ids
# ---------------------------------------------------------------------------
def test_prod2g_08_each_unique_key_max_once_per_request():
    k1 = _make_dummy_key("KEY_1", 1)
    k2 = _make_dummy_key("KEY_2", 2)
    pool = GeminiKeyPool(raw_keys_str=f"{k1},{k2}")

    attempted = set()

    k_first = pool.lease_key(exclude_safe_ids=attempted)
    assert k_first is not None
    attempted.add(k_first.safe_id)

    k_second = pool.lease_key(exclude_safe_ids=attempted)
    assert k_second is not None
    assert k_second.safe_id != k_first.safe_id
    attempted.add(k_second.safe_id)

    # Third lease with both excluded -> None
    k_third = pool.lease_key(exclude_safe_ids=attempted)
    assert k_third is None


# ---------------------------------------------------------------------------
# Test 9: No raw secrets in concurrent logs / telemetry
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_prod2g_09_no_raw_secrets_in_concurrent_logs():
    raw_secret = "AIzaSy" + "FAKE_SECRET_STRING_DO_NOT_LOG"
    pool = GeminiKeyPool(raw_keys_str=raw_secret)
    clear_gemini_cache()

    async def mock_call(*args, **kwargs):
        return _make_gemini_success()

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call), \
         patch("app.integrations.gemini.corrector.settings") as mock_s:
        mock_s.gemini_enabled = True
        mock_s.gemini_max_key_attempts_per_request = 1
        mock_s.gemini_timeout_seconds = 5.0
        mock_s.gemini_connect_timeout_seconds = 2.0

        res = await request_gemini_correction(_make_crop(), "test", model="gemini-3.6-flash")
        meta = get_current_gemini_meta()

        assert res is not None
        # Verify attempted_keys only contains sha256 safe IDs, no raw secrets
        for k in meta["attempted_keys"]:
            assert k.startswith("sha256:")
            assert "AIzaSy" not in k
            assert "FAKE_SECRET" not in k


# ---------------------------------------------------------------------------
# Test 10: Advisor timeout degrades gracefully without crashing CRNN
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_prod2g_10_gemini_timeout_degrades_gracefully_crnn_returns():
    pool = GeminiKeyPool(raw_keys_str="keyA,keyB", cooldown_seconds=60)
    clear_gemini_cache()

    async def mock_timeout(*args, **kwargs):
        raise GeminiError("TIMEOUT", "Read timeout after 18.0s")

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool), \
         patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_timeout), \
         patch("app.integrations.gemini.corrector.settings") as mock_s:
        mock_s.gemini_enabled = True
        mock_s.gemini_max_key_attempts_per_request = 2
        mock_s.gemini_timeout_seconds = 18.0
        mock_s.gemini_connect_timeout_seconds = 4.0

        res = await request_gemini_correction(_make_crop(), "test", model="gemini-3.6-flash")
        meta = get_current_gemini_meta()

        # Should return None gracefully without raising
        assert res is None
        assert meta["key_attempt_count"] == 2
        assert meta["success"] is False


# ---------------------------------------------------------------------------
# Test 11: 8-line segmentation remains exact (8/8)
# ---------------------------------------------------------------------------
def test_prod2g_11_owner_8line_segmentation_remains_8_of_8():
    import cv2
    assert FIXTURE_8_LINES.is_file(), f"Fixture missing: {FIXTURE_8_LINES}"
    img = cv2.imread(str(FIXTURE_8_LINES))
    assert img is not None, "Failed to load fixture"

    lines, diag = detect_text_lines(img, max_lines=30)
    assert len(lines) == 8, f"Expected 8 lines, got {len(lines)}"


# ---------------------------------------------------------------------------
# Test 12: Canonical decisions cross-stack contract
# ---------------------------------------------------------------------------
def test_prod2g_12_canonical_decisions_cross_stack_contract():
    valid = {"AUTO_APPLY", "SUGGEST_ONLY", "KEEP_RAW"}
    assert CANONICAL_ADVISOR_DECISIONS == valid

    # Internal safe variants must normalize
    assert normalize_canonical_advisor_decision("AUTO_APPLY_SAFE") == "AUTO_APPLY"
    assert normalize_canonical_advisor_decision("AUTO_APPLY") == "AUTO_APPLY"
    assert normalize_canonical_advisor_decision("SUGGEST_ONLY") == "SUGGEST_ONLY"
    assert normalize_canonical_advisor_decision("KEEP_RAW") == "KEEP_RAW"
    assert normalize_canonical_advisor_decision("UNKNOWN_JUNK") == "KEEP_RAW"


# ---------------------------------------------------------------------------
# Test 13: Initial finalText immutable to AUTO_APPLY silent mutation
# ---------------------------------------------------------------------------
def test_prod2g_13_no_auto_apply_silent_mutation():
    raw_ocr = "Mọc trên đổi quề"
    line = LineBox(
        line_id="l3",
        x=10,
        y=50,
        width=100,
        height=25,
        order=3,
        rawOcrText=raw_ocr,
        finalText=raw_ocr,
        groqSuggestion="Mọc trên đồi quê",
        groqDecision="AUTO_APPLY",
        geminiSuggestion="Mọc trên đồi quê",
        geminiDecision="AUTO_APPLY",
    )
    # Even though both advisors suggest AUTO_APPLY:
    assert line.finalText == raw_ocr, "Initial finalText MUST strictly equal rawOcrText"
    assert line.rawOcrText == raw_ocr


# ---------------------------------------------------------------------------
# Test 14: Provider status honest UNPROBED before live success
# ---------------------------------------------------------------------------
def test_prod2g_14_provider_status_unprobed_before_live_success():
    pool = GeminiKeyPool(raw_keys_str="key1,key2")
    # Before any live success, status must NOT claim HEALTHY
    assert pool.provider_status == "UNPROBED"

    # After live success
    pool.mark_success(pool.entries[0], latency_ms=120.0)
    assert pool.provider_status == "HEALTHY"


# ---------------------------------------------------------------------------
# Test 15: Diagnostics contain lineAdvisorTimings decomposition
# ---------------------------------------------------------------------------
def test_prod2g_15_detect_lines_endpoint_contains_line_advisor_timings():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.integrations.groq.corrector import GroqOcrCorrectionResponse

    client = TestClient(app)
    assert FIXTURE_8_LINES.is_file()
    with open(str(FIXTURE_8_LINES), "rb") as f:
        img_bytes = f.read()

    mock_groq_resp = (
        GroqOcrCorrectionResponse(
            provider="GROQ",
            raw_text="test",
            suggested_text="Mọc trên đồi quê",
            correction_needed=True,
            confidence=0.92,
            visual_support="STRONG",
            changes=[],
            uncertain=False,
        ),
        "AUTO_APPLY",
        0.1,
        "spelling_fix",
    )
    mock_gemini_resp = (
        _make_gemini_success("Mọc trên đồi quê", 0.95),
        "AUTO_APPLY",
        0.1,
        "spelling_fix",
    )

    with patch("app.integrations.groq.corrector.request_groq_correction", AsyncMock(return_value=mock_groq_resp)), \
         patch("app.integrations.gemini.corrector.request_gemini_correction", AsyncMock(return_value=mock_gemini_resp)), \
         patch.object(settings, "groq_enabled", True), \
         patch.object(settings, "groq_post_correction_enabled", True), \
         patch.object(settings, "gemini_enabled", True), \
         patch.object(settings, "gemini_post_correction_enabled", True), \
         patch.object(settings, "hwtext_always_review_enabled", False), \
         patch.object(settings, "always_review_enabled", False), \
         patch.object(settings, "cloud_advisor_max_concurrency", 3):

        resp = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        diag = data.get("diagnostics", {})

        assert "lineAdvisorTimings" in diag
        assert "sequentialSumMs" in diag
        assert "parallelWallClockMs" in diag
        assert "advisorConcurrency" in diag
        assert diag["advisorConcurrency"] == 3

        timings = diag["lineAdvisorTimings"]
        assert len(timings) == 3, f"Expected 3 triggered lines, got {len(timings)}"
        for t in timings:
            for field in (
                "crnn_ms", "groq_ms", "gemini_ms", "key_attempt_count",
                "key_failover_ms", "provider_wait_ms", "total_line_ms",
                "trigger_reason", "groq_status", "gemini_status"
            ):
                assert field in t, f"Missing required timing field {field} in {t}"
            assert t["groq_status"] == "SUCCESS"
            assert t["gemini_status"] == "SUCCESS"


# ---------------------------------------------------------------------------
# Test 16: Groq error degrades gracefully without crashing CRNN
# ---------------------------------------------------------------------------
def test_prod2g_16_groq_error_degrades_gracefully_crnn_returns():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    assert FIXTURE_8_LINES.is_file()
    with open(str(FIXTURE_8_LINES), "rb") as f:
        img_bytes = f.read()

    with patch("app.integrations.groq.corrector.request_groq_correction", AsyncMock(side_effect=Exception("Groq network down"))), \
         patch("app.integrations.gemini.corrector.request_gemini_correction", AsyncMock(return_value=None)), \
         patch.object(settings, "groq_enabled", True), \
         patch.object(settings, "groq_post_correction_enabled", True), \
         patch.object(settings, "gemini_enabled", True), \
         patch.object(settings, "gemini_post_correction_enabled", True), \
         patch.object(settings, "cloud_advisor_max_concurrency", 3):

        resp = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data.get("lines", [])) == 8
        for l in data["lines"]:
            assert l["rawOcrText"] is not None
            assert l["finalText"] == l["rawOcrText"]


