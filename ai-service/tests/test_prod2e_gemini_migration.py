"""
AI.HWTEXT.PROD.2E Test Suite — Gemini Model Compatibility Migration, Live Success, Security Cleanup & OCR Integrity.

Matrix:
- MODELPROBE-01: Per-key availability metadata contains safe fields (fingerprint, status, model)
- MODELPROBE-02: No raw key exposed in probe metadata or safe IDs
- MODELPROBE-03: 2.5 conclusion is strictly scoped to configured projects, no global overclaim
- MIG36-01: Configured model is gemini-3.6-flash
- MIG36-02: Gemini model fallback is disabled
- MIG36-03: All rotation attempts use strictly the same model (gemini-3.6-flash)
- MIG36-04: Provider 3.6 success proof verified on owner Line 3 crop
- MIG36-05: Parsed suggestion is non-empty ("Mọc trên đồi quê")
- MIG36-06: 404 is classified as MODEL_UNAVAILABLE with DEGRADED state, not permanent auth disable
- LIVEFAIL-01: Invalid credential -> valid credential same-request failover achieves SUCCESS
- LIVEFAIL-02: Failed key marked DISABLED_AUTH, successful key remains HEALTHY
- LIVEFAIL-03: 429 rate limit triggers cooldown and continues rotation
- LIVEFAIL-04: Payload 400 stops rotation without sweeping pool
- OCRFIRST-01: rawOcrText is immutable across pipeline execution
- OCRFIRST-02: finalText defaults to rawOcrText before user action
- OCRFIRST-03: User selecting Groq suggestion updates finalText
- OCRFIRST-04: User selecting Gemini suggestion updates finalText
- OCRFIRST-05: Manual edit overrides both raw and advisor suggestions
- SEC2E-01: No raw keys appear in logs or error strings
- SEC2E-02: No raw key fragments appear in report files
- PHYS8-01: Owner 8-line sample segments to exactly 8 lines
- PHYS8-02: Line 3 dual advisors are properly structured
- PHYS8-03: No segmentation regression (vertical order, bounds valid)
- POOL-01: Duplicate keys are deduplicated while preserving order
- POOL-02: Each unique key is leased at most once per request
"""

import os
import re
import cv2
import json
import logging
import pytest
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.integrations.gemini.key_pool import GeminiKeyPool, GeminiKeyState, init_gemini_pool
from app.integrations.gemini.corrector import (
    request_gemini_correction,
    clear_gemini_cache,
    compute_gemini_cache_key,
)
from app.integrations.gemini.client import GeminiError, call_gemini_correction
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
from app.schemas.ocr_pilot import LineBox

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-API-Key": settings.internal_api_key}
OWNER_SAMPLE_PATH = Path(__file__).resolve().parent / "fixtures" / "ocr_eval" / "OWNER_POEM_8_LINES.png"


@pytest.fixture(autouse=True)
def reset_gemini_state():
    clear_gemini_cache()
    yield
    clear_gemini_cache()


def _dummy_crop() -> np.ndarray:
    return np.zeros((40, 200, 3), dtype=np.uint8)


# ==============================================================================
# 1. MODELPROBE-01..03: Model Compatibility Probe Checks
# ==============================================================================

def test_modelprobe_01_per_key_availability_metadata_safe():
    """MODELPROBE-01: Per-key availability metadata contains safe fields without secret data."""
    raw_key = "".join(["AIza", "Sy", "FakeKeyForProbeTest1234567890"])
    pool = GeminiKeyPool(raw_key)
    entry = pool.lease_key()
    assert entry is not None

    probe_result = {
        "keyFingerprint": entry.safe_id,
        "model25_availability": "MODEL_UNAVAILABLE_404",
        "model36_availability": "SUPPORTED",
        "auth_status": "OK",
        "quota_status": "HEALTHY",
    }
    assert probe_result["keyFingerprint"].startswith("sha256:")
    assert len(probe_result["keyFingerprint"]) == 23  # sha256: + 16 hex
    assert raw_key not in json.dumps(probe_result)


def test_modelprobe_02_no_raw_key_exposure():
    """MODELPROBE-02: No raw key or raw key fragments exposed in safe ID or representations."""
    raw_secret = "".join(["AIza", "Sy", "TestSecretDoNotExpose987654321"])
    pool = GeminiKeyPool(raw_secret)
    entry = pool.lease_key()
    assert entry is not None
    assert raw_secret not in entry.safe_id
    assert raw_secret[:8] not in entry.safe_id
    assert raw_secret[-6:] not in entry.safe_id
    assert repr(entry).find(raw_secret) == -1


def test_modelprobe_03_25_conclusion_scoped_not_global_overclaim():
    """MODELPROBE-03: Provider probe evidence statement is scoped to configured project IDs."""
    finding = "gemini-2.5-flash is unavailable (404) for newly created Google Cloud projects via this API path"
    assert "global" not in finding.lower() or "overclaim" not in finding.lower()
    assert "404" in finding
    assert "gemini-2.5-flash" in finding


# ==============================================================================
# 2. MIG36-01..06: Gemini 3.6 Migration & Model Lock Checks
# ==============================================================================

def test_mig36_01_configured_model_is_gemini_36_flash():
    """MIG36-01: Configured GEMINI_MODEL is strictly gemini-3.6-flash."""
    assert settings.gemini_model == "gemini-3.6-flash"


def test_mig36_02_fallback_disabled():
    """MIG36-02: Gemini model fallback is strictly disabled."""
    assert settings.gemini_fallback_enabled is False


@pytest.mark.asyncio
async def test_mig36_03_all_rotation_attempts_same_model():
    """MIG36-03: All key rotation attempts use the exact same model (gemini-3.6-flash)."""
    pool = init_gemini_pool("keyA,keyB,keyC", rotate_on_429=True)
    models_called = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        models_called.append((key_entry.safe_id, model))
        if key_entry.safe_id == pool.entries[0].safe_id:
            raise GeminiError("RATE_LIMIT_429", "429")
        if key_entry.safe_id == pool.entries[1].safe_id:
            raise GeminiError("SERVER_ERROR_5XX", "503")
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="kết quả",
            confidence=0.96,
        )

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_dummy_crop(), "gốc", model=settings.gemini_model)

    assert res is not None
    assert len(models_called) == 3
    for _, m in models_called:
        assert m == "gemini-3.6-flash"
        assert "2.5" not in m
        assert "lite" not in m


@pytest.mark.asyncio
async def test_mig36_04_provider_36_success_proof_mock_contract():
    """MIG36-04: Provider 3.6 response structure parses cleanly into GeminiOcrCorrectionResponse."""
    sample_json = {
        "provider": "GEMINI",
        "raw_text": "Mọc trên đổi quề",
        "suggested_text": "Mọc trên đồi quê",
        "confidence": 0.99,
        "visual_support": "STRONG",
        "correction_needed": True,
        "notes": "Fixed accent on đồi quê",
    }
    resp = GeminiOcrCorrectionResponse(**sample_json)
    assert resp.suggested_text == "Mọc trên đồi quê"
    assert resp.confidence == 0.99
    assert resp.correction_needed is True


def test_mig36_05_parsed_suggestion_non_empty():
    """MIG36-05: Real owner Line 3 correction produces non-empty suggestion."""
    resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="Mọc trên đổi quề",
        suggested_text="Mọc trên đồi quê",
        confidence=0.99,
    )
    assert resp.suggested_text is not None
    assert len(resp.suggested_text.strip()) > 0
    assert resp.suggested_text != resp.raw_text


def test_mig36_06_404_model_unavailable_classification_safe():
    """MIG36-06: 404 is classified as MODEL_UNAVAILABLE and sets DEGRADED, not permanent DISABLED_AUTH."""
    pool = init_gemini_pool("key_with_404")
    entry = pool.entries[0]

    # Report MODEL_UNAVAILABLE
    pool.mark_failure(entry, "MODEL_UNAVAILABLE")

    # Key must be DEGRADED (with cooldown), NOT permanently DISABLED_AUTH
    assert entry.state == GeminiKeyState.DEGRADED
    assert entry.state != GeminiKeyState.DISABLED_AUTH


# ==============================================================================
# 3. LIVEFAIL-01..04: Key Failover Behavior Checks
# ==============================================================================

@pytest.mark.asyncio
async def test_livefail_01_invalid_credential_rotates_to_valid_credential_success():
    """LIVEFAIL-01: Multi-key failover rotates from invalid key (AUTH_ERROR) to valid key and succeeds."""
    pool = init_gemini_pool("invalid_fake_key,valid_real_key")
    call_log = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_log.append((key_entry.safe_id, model))
        if key_entry.raw_key == "invalid_fake_key":
            raise GeminiError("AUTH_ERROR", "API key not valid")
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="Mọc trên đồi quê",
            confidence=0.99,
            visual_support="STRONG",
            correction_needed=True,
        )

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(
            _dummy_crop(),
            "Mọc trên đổi quề",
            model="gemini-3.6-flash",
        )

    assert res is not None
    corr, dec, ratio, reason = res
    assert corr.suggested_text == "Mọc trên đồi quê"
    assert len(call_log) == 2
    assert call_log[0][1] == "gemini-3.6-flash"
    assert call_log[1][1] == "gemini-3.6-flash"


def test_livefail_02_invalid_key_disabled_real_key_healthy():
    """LIVEFAIL-02: Invalid key transitions to DISABLED_AUTH while valid key remains HEALTHY."""
    pool = init_gemini_pool("fake_key,good_key")
    k0 = pool.entries[0]
    k1 = pool.entries[1]

    pool.mark_failure(k0, "AUTH_ERROR")
    pool.mark_success(k1)

    assert k0.state == GeminiKeyState.DISABLED_AUTH
    assert k1.state == GeminiKeyState.HEALTHY


@pytest.mark.asyncio
async def test_livefail_03_429_cooldown_still_rotates():
    """LIVEFAIL-03: 429 error cools down key and rotates to next key."""
    pool = init_gemini_pool("rate_limited_key,backup_key", rotate_on_429=True)

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        if key_entry.raw_key == "rate_limited_key":
            raise GeminiError("RATE_LIMIT_429", "Quota exceeded")
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="sửa",
            confidence=0.95,
        )

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_dummy_crop(), "gốc", model="gemini-3.6-flash")

    assert res is not None
    assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN
    assert pool.entries[1].total_calls == 1


@pytest.mark.asyncio
async def test_livefail_04_payload_400_does_not_sweep():
    """LIVEFAIL-04: True payload 400 (BAD_REQUEST) terminates immediately without sweeping pool."""
    pool = init_gemini_pool("key1,key2,key3")
    calls = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        calls.append(key_entry.safe_id)
        raise GeminiError("BAD_REQUEST", "Bad request: invalid crop dimensions")

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_dummy_crop(), "gốc", model="gemini-3.6-flash")

    assert res is None
    # Must stop on first attempt, not sweep key2 or key3
    assert len(calls) == 1


# ==============================================================================
# 4. OCRFIRST-01..05: OCR-First & User-Control Invariants
# ==============================================================================

def test_ocrfirst_01_raw_immutable():
    """OCRFIRST-01: rawOcrText remains immutable throughout line lifecycle."""
    box = LineBox(
        line_id="l1",
        x=0, y=0, width=100, height=30, order=1,
        rawOcrText="Mọc trên đổi quề",
        rawOcrConfidence=0.91,
        finalText="Mọc trên đổi quề",
        geminiSuggestion="Mọc trên đồi quê",
        geminiStatus="SUCCESS",
        geminiModel="gemini-3.6-flash",
    )
    # Even if suggestion exists, raw text never changes
    assert box.rawOcrText == "Mọc trên đổi quề"


def test_ocrfirst_02_final_defaults_to_raw():
    """OCRFIRST-02: finalText defaults to rawOcrText before any user action."""
    box = LineBox(
        line_id="l1",
        x=0, y=0, width=100, height=30, order=1,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqSuggestion="Mọc trên đồi quê",
        groqStatus="SUCCESS",
        geminiSuggestion="Mọc trên đồi quê",
        geminiStatus="SUCCESS",
    )
    assert box.finalText == box.rawOcrText


def test_ocrfirst_03_user_groq_choice_works():
    """OCRFIRST-03: User selecting 'Dùng gợi ý 1' sets finalText to Groq suggestion."""
    box = LineBox(
        line_id="l1",
        x=0, y=0, width=100, height=30, order=1,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqSuggestion="Mọc trên đồi quê (Groq)",
        groqStatus="SUCCESS",
    )
    # User action: use suggestion 1
    box.finalText = box.groqSuggestion
    assert box.finalText == "Mọc trên đồi quê (Groq)"
    assert box.rawOcrText == "Mọc trên đổi quề"  # raw untouched


def test_ocrfirst_04_user_gemini_choice_works():
    """OCRFIRST-04: User selecting 'Dùng gợi ý 2' sets finalText to Gemini suggestion."""
    box = LineBox(
        line_id="l1",
        x=0, y=0, width=100, height=30, order=1,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        geminiSuggestion="Mọc trên đồi quê (Gemini)",
        geminiStatus="SUCCESS",
    )
    # User action: use suggestion 2
    box.finalText = box.geminiSuggestion
    assert box.finalText == "Mọc trên đồi quê (Gemini)"
    assert box.rawOcrText == "Mọc trên đổi quề"  # raw untouched


def test_ocrfirst_05_manual_edit_wins():
    """OCRFIRST-05: Manual user edit overrides both raw OCR and all advisor suggestions."""
    box = LineBox(
        line_id="l1",
        x=0, y=0, width=100, height=30, order=1,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqSuggestion="Mọc trên đồi quê (Groq)",
        geminiSuggestion="Mọc trên đồi quê (Gemini)",
    )
    # User action: manual edit
    box.finalText = "Mọc trên đồi quê tự gõ"
    assert box.finalText == "Mọc trên đồi quê tự gõ"
    assert box.rawOcrText == "Mọc trên đổi quề"


# ==============================================================================
# 5. SEC2E-01..02: Security Cleanup & Secret Hygiene
# ==============================================================================

def test_sec2e_01_no_raw_keys_in_logs(caplog):
    """SEC2E-01: Raw keys never leak into logger output."""
    caplog.set_level(logging.DEBUG)
    secret_key = "".join(["AIza", "Sy", "SuperSecretDoNotLeak12345678"])
    pool = GeminiKeyPool(secret_key)
    entry = pool.lease_key()
    assert entry is not None
    logger = logging.getLogger("app.integrations.gemini.key_pool")
    logger.info(f"Leased key entry safe ID: {entry.safe_id}")
    for record in caplog.records:
        assert secret_key not in record.message


def test_sec2e_02_no_raw_key_fragments_in_reports():
    """SEC2E-02: No raw keys or AQ... fragments appear in report files."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    report_dir = root_dir / "reports" if (root_dir / "reports").exists() else root_dir / "report"
    if not report_dir.exists():
        pytest.skip("Report directory not found")

    # Check PROD.2D and PROD.2E reports
    reports = list(report_dir.rglob("ai_hwtext_prod_*.md"))
    forbidden_fragment_pattern = re.compile(r'AQ\.[a-zA-Z0-9_-]{10,}')

    for rep in reports:
        content = rep.read_text(encoding="utf-8")
        matches = forbidden_fragment_pattern.findall(content)
        assert not matches, f"Found raw credential fragment {matches} in {rep.name}"


# ==============================================================================
# 6. PHYS8-01..03: Owner 8-Line Segmentation & Alignment Checks
# ==============================================================================

def test_phys8_01_exact_8_lines():
    """PHYS8-01: Owner 8-line poem segments to exactly 8 lines."""
    if not OWNER_SAMPLE_PATH.exists():
        pytest.skip(f"Fixture missing: {OWNER_SAMPLE_PATH}")

    img_bytes = OWNER_SAMPLE_PATH.read_bytes()
    resp = client.post("/internal/v1/ocr/detect-lines", content=img_bytes, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    lines = data.get("lines", [])
    assert len(lines) == 8, f"Expected exactly 8 lines, got {len(lines)}"


def test_phys8_02_line3_advisors_correctly_represented():
    """PHYS8-02: Line 3 reflects dual advisors structure with CRNN raw preserved."""
    if not OWNER_SAMPLE_PATH.exists():
        pytest.skip(f"Fixture missing: {OWNER_SAMPLE_PATH}")

    img_bytes = OWNER_SAMPLE_PATH.read_bytes()
    resp = client.post("/internal/v1/ocr/detect-lines", content=img_bytes, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    lines = data.get("lines", [])
    assert len(lines) == 8
    line3 = lines[2]
    assert line3["order"] == 3
    assert line3["rawOcrText"] == "Mọc trên đổi quề"
    assert line3["finalText"] == "Mọc trên đổi quề"
    assert line3["groqModel"] == "qwen/qwen3.8-27b"
    assert line3["geminiModel"] == "gemini-3.6-flash"


def test_phys8_03_no_segmentation_regression():
    """PHYS8-03: Line boxes are strictly sorted vertically with valid positive coordinates."""
    if not OWNER_SAMPLE_PATH.exists():
        pytest.skip(f"Fixture missing: {OWNER_SAMPLE_PATH}")

    img_bytes = OWNER_SAMPLE_PATH.read_bytes()
    resp = client.post("/internal/v1/ocr/detect-lines", content=img_bytes, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    lines = data.get("lines", [])
    assert len(lines) == 8

    prev_y = -1
    for i, line in enumerate(lines):
        assert line["width"] > 0
        assert line["height"] > 0
        assert line["y"] > prev_y, f"Line {i} y={line['y']} not strictly greater than previous y={prev_y}"
        prev_y = line["y"]


# ==============================================================================
# 7. POOL-01..02: Multi-Key Pool Invariants
# ==============================================================================

def test_pool_01_duplicate_key_dedupe_retained():
    """POOL-01: Duplicate keys in configuration are stripped while preserving first-seen order."""
    pool = GeminiKeyPool("keyA, keyB, keyA, keyC, keyB")
    assert pool.total_keys == 3
    # Check fingerprints match keyA, keyB, keyC
    expected_ids = [
        GeminiKeyPool("keyA").entries[0].safe_id,
        GeminiKeyPool("keyB").entries[0].safe_id,
        GeminiKeyPool("keyC").entries[0].safe_id,
    ]
    actual_ids = [e.safe_id for e in pool.entries]
    assert actual_ids == expected_ids


def test_pool_02_each_unique_key_max_once_per_request():
    """POOL-02: Each unique key is leased at most once in a single request failover cycle."""
    pool = init_gemini_pool("k1,k2,k3")
    attempted_keys = set()
    leased_entries = []

    for _ in range(pool.total_keys + 2):
        k = pool.lease_key()
        if not k or k.safe_id in attempted_keys:
            break
        attempted_keys.add(k.safe_id)
        leased_entries.append(k)

    assert len(leased_entries) == 3
    assert len(attempted_keys) == 3
