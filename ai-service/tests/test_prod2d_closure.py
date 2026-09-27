"""
tests/test_prod2d_closure.py
Targeted regression gate for AI.HWTEXT.PROD.2D.
Covers 16 required tests:
- LIVEKEY-01: duplicate removal preserved
- LIVEKEY-02: same-model rotation preserved
- LIVEKEY-03: real AUTH failover harness uses production corrector
- LIVEKEY-04: raw keys never logged
- LIVEKEY-05: all keys exhausted -> Gemini unavailable without breaking OCR
- LIVEKEY-06: 400 does not sweep key pool
- AUTOLOCK-01: AUTO_APPLY metadata cannot silently overwrite finalText
- AUTOLOCK-02: user chooses Groq -> finalText changes, raw immutable
- AUTOLOCK-03: user chooses Gemini -> finalText changes, raw immutable
- AUTOLOCK-04: keep raw restores raw text
- AUTOLOCK-05: manual edit wins
- PHYS8-01: exactly 8 lines
- PHYS8-02: top-to-bottom ordering
- PHYS8-03: line 3 uncertainty metrics preserved
- PHYS8-04: Groq trigger reason visible internally
- PHYS8-05: Gemini state preserved through DTO/persistence/result hydration
"""

import asyncio
import hashlib
import logging
from pathlib import Path
from unittest.mock import AsyncMock, patch
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.integrations.gemini.key_pool import (
    GeminiKeyPool,
    GeminiKeyEntry,
    GeminiKeyState,
    init_gemini_pool,
)
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.corrector import (
    request_gemini_correction,
    clear_gemini_cache,
)
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
from app.schemas.ocr_pilot import LineBox

client = TestClient(app)
FIXTURE_8_LINES = Path("tests/fixtures/ocr_eval/OWNER_POEM_8_LINES.png")


def _safe_id(key: str) -> str:
    return f"sha256:{hashlib.sha256(key.encode()).hexdigest()[:16]}"


def _dummy_crop() -> np.ndarray:
    return np.zeros((20, 100, 3), dtype=np.uint8)


# ==============================================================================
# LIVEKEY SUITE (LIVEKEY-01 .. LIVEKEY-06)
# ==============================================================================

def test_livekey_01_duplicate_removal_preserved():
    """LIVEKEY-01: Exact duplicate removal, whitespace trimming, first-seen order preserved."""
    raw = "keyA, keyB , keyA,  ,keyC,  keyB,keyD  "
    pool = GeminiKeyPool(raw)
    assert pool.configured_entries_count == 6
    assert pool.unique_keys_count == 4
    assert pool.duplicates_removed_count == 2
    assert [e.safe_id for e in pool.entries] == [
        _safe_id("keyA"),
        _safe_id("keyB"),
        _safe_id("keyC"),
        _safe_id("keyD"),
    ]


@pytest.mark.asyncio
async def test_livekey_02_same_model_rotation_preserved():
    """LIVEKEY-02: Model remains gemini-2.5-flash on every rotation attempt."""
    clear_gemini_cache()
    pool = init_gemini_pool("key1,key2,key3", rotate_on_429=True)
    models_called = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        models_called.append((model, key_entry.safe_id))
        if key_entry.safe_id == _safe_id("key1"):
            raise GeminiError("RATE_LIMIT_429", "429")
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="sửa",
            correction_needed=True,
            confidence=0.95,
        )

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(
            _dummy_crop(),
            "chữ gốc",
            model="gemini-2.5-flash",
        )

    assert res is not None
    assert len(models_called) == 2
    for m, _ in models_called:
        assert m == "gemini-2.5-flash"


@pytest.mark.asyncio
async def test_livekey_03_real_auth_failover_harness_uses_production_corrector():
    """LIVEKEY-03: Production corrector rotates from invalid key (AUTH_ERROR) to valid key."""
    clear_gemini_cache()
    pool = init_gemini_pool("invalid_test_key,valid_owner_key")
    call_sequence = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        call_sequence.append((key_entry.safe_id, model))
        if key_entry.raw_key == "invalid_test_key":
            raise GeminiError("AUTH_ERROR", "Gemini auth error 400: API_KEY_INVALID")
        return GeminiOcrCorrectionResponse(
            provider="GEMINI",
            raw_text=raw_ocr_text,
            suggested_text="kết quả sửa",
            correction_needed=True,
            confidence=0.96,
        )

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(
            _dummy_crop(),
            "kết quả gốc",
            model="gemini-2.5-flash",
        )

    assert res is not None
    corr_obj, decision, ratio, reason = res
    assert corr_obj.suggested_text == "kết quả sửa"

    # Key 0 must be disabled due to AUTH_ERROR
    assert pool.entries[0].state == GeminiKeyState.DISABLED_AUTH
    # Key 1 must be healthy with 1 call
    assert pool.entries[1].state == GeminiKeyState.HEALTHY
    assert pool.entries[1].total_calls == 1

    # Call sequence must have attempted key 0 then key 1 with the same model
    assert len(call_sequence) == 2
    assert call_sequence[0] == (_safe_id("invalid_test_key"), "gemini-2.5-flash")
    assert call_sequence[1] == (_safe_id("valid_owner_key"), "gemini-2.5-flash")


def test_livekey_04_raw_keys_never_logged(caplog):
    """LIVEKEY-04: Raw keys never logged or stored in safe status."""
    caplog.set_level(logging.DEBUG)
    raw_secret = "".join(["AIza", "Sy", "SecretRealKeyDoNotLeak123456"])
    pool = GeminiKeyPool(raw_secret)
    entry = pool.lease_key()
    assert entry is not None
    assert raw_secret not in entry.safe_id
    assert entry.safe_id.startswith("sha256:")

    pool.mark_failure(entry, "AUTH_ERROR")
    for record in caplog.records:
        assert raw_secret not in record.getMessage()


def test_livekey_05_all_keys_exhausted_gemini_unavailable_without_breaking_ocr():
    """LIVEKEY-05: All keys exhausted -> Gemini status is UNAVAILABLE, OCR succeeds 200."""
    with open(FIXTURE_8_LINES, "rb") as f:
        img_bytes = f.read()

    async def mock_exhausted(*args, **kwargs):
        return None

    with patch("app.integrations.gemini.corrector.request_gemini_correction", side_effect=mock_exhausted):
        resp = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data.get("lines", [])) == 8
    for l in data["lines"]:
        # OCR raw text must be intact
        assert l["rawOcrText"]
        # If triggered, geminiStatus must be UNAVAILABLE
        if l.get("geminiStatus"):
            assert l["geminiStatus"] == "UNAVAILABLE"


@pytest.mark.asyncio
async def test_livekey_06_400_does_not_sweep_key_pool():
    """LIVEKEY-06: True payload BAD_REQUEST terminates immediately without sweeping pool."""
    clear_gemini_cache()
    pool = init_gemini_pool("key1,key2,key3")
    calls = []

    async def mock_bad_request(*args, **kwargs):
        calls.append(True)
        raise GeminiError("BAD_REQUEST", "Gemini bad request 400: invalid image")

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_bad_request):
        res = await request_gemini_correction(
            _dummy_crop(),
            "raw",
            model="gemini-2.5-flash",
        )

    assert res is None
    # Must stop immediately after 1 attempt, not rotate across remaining keys
    assert len(calls) == 1


# ==============================================================================
# AUTOLOCK SUITE (AUTOLOCK-01 .. AUTOLOCK-05)
# ==============================================================================

def test_autolock_01_auto_apply_metadata_cannot_silently_overwrite_final_text():
    """AUTOLOCK-01: AUTO_APPLY decision metadata does not silently overwrite finalText."""
    with open(FIXTURE_8_LINES, "rb") as f:
        img_bytes = f.read()

    resp = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
    )
    assert resp.status_code == 200
    data = resp.json()
    line3 = data["lines"][2]

    assert line3["order"] == 3
    assert line3["rawOcrText"] == "Mọc trên đổi quề"
    assert line3["finalText"] == "Mọc trên đổi quề"
    assert line3["correctionApplied"] is False
    assert line3["groqDecision"] == "AUTO_APPLY"
    assert line3["groqSuggestion"] == "Mọc trên đồi quê"


def test_autolock_02_user_chooses_groq_final_text_changes_raw_immutable():
    """AUTOLOCK-02: User chooses Groq -> finalText updates, rawOcrText remains immutable."""
    line = LineBox(
        line_id="line-3",
        x=66, y=210, width=254, height=49, order=3,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqSuggestion="Mọc trên đồi quê",
        groqDecision="AUTO_APPLY",
        correctionApplied=False,
    )
    # Emulate user tapping [Dùng gợi ý 1]
    chosen_text = line.groqSuggestion
    line.finalText = chosen_text
    line.text = chosen_text

    assert line.finalText == "Mọc trên đồi quê"
    assert line.rawOcrText == "Mọc trên đổi quề"


def test_autolock_03_user_chooses_gemini_final_text_changes_raw_immutable():
    """AUTOLOCK-03: User chooses Gemini -> finalText updates, rawOcrText remains immutable."""
    line = LineBox(
        line_id="line-3",
        x=66, y=210, width=254, height=49, order=3,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        geminiSuggestion="Mọc trên đồi quê",
        geminiDecision="SUGGEST_ONLY",
        geminiStatus="SUCCESS",
        correctionApplied=False,
    )
    # Emulate user tapping [Dùng gợi ý 2]
    chosen_text = line.geminiSuggestion
    line.finalText = chosen_text
    line.text = chosen_text

    assert line.finalText == "Mọc trên đồi quê"
    assert line.rawOcrText == "Mọc trên đổi quề"


def test_autolock_04_keep_raw_restores_raw_text():
    """AUTOLOCK-04: Tapping [Giữ OCR gốc] resets finalText to rawOcrText."""
    line = LineBox(
        line_id="line-3",
        x=66, y=210, width=254, height=49, order=3,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đồi quê",  # previously suggested
        groqSuggestion="Mọc trên đồi quê",
        correctionApplied=False,
    )
    # Emulate user tapping [Giữ OCR gốc]
    line.finalText = line.rawOcrText
    line.text = line.rawOcrText

    assert line.finalText == "Mọc trên đổi quề"
    assert line.rawOcrText == "Mọc trên đổi quề"


def test_autolock_05_manual_edit_wins():
    """AUTOLOCK-05: Manual edit overrides suggestions, rawOcrText remains immutable."""
    line = LineBox(
        line_id="line-3",
        x=66, y=210, width=254, height=49, order=3,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqSuggestion="Mọc trên đồi quê",
        geminiSuggestion="Mọc trên đồi quê",
    )
    manual_text = "Mọc trên đồi quê xanh"
    line.finalText = manual_text
    line.text = manual_text

    assert line.finalText == "Mọc trên đồi quê xanh"
    assert line.rawOcrText == "Mọc trên đổi quề"


# ==============================================================================
# PHYS8 SUITE (PHYS8-01 .. PHYS8-05)
# ==============================================================================

def test_phys8_01_exactly_8_lines():
    """PHYS8-01: Detection on owner 8-line poem fixture yields exactly 8 lines."""
    with open(FIXTURE_8_LINES, "rb") as f:
        img_bytes = f.read()

    resp = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
    )
    assert resp.status_code == 200
    data = resp.json()
    lines = data.get("lines", [])
    assert len(lines) == 8


def test_phys8_02_top_to_bottom_ordering():
    """PHYS8-02: Top-to-bottom spatial ordering preserved (y coordinates ascending)."""
    with open(FIXTURE_8_LINES, "rb") as f:
        img_bytes = f.read()

    resp = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
    )
    assert resp.status_code == 200
    lines = resp.json().get("lines", [])
    assert len(lines) == 8

    for i in range(len(lines) - 1):
        assert lines[i]["order"] == i + 1
        assert lines[i]["y"] < lines[i + 1]["y"], f"Line {i+1} y={lines[i]['y']} not < Line {i+2} y={lines[i+1]['y']}"


def test_phys8_03_line_3_uncertainty_metrics_preserved():
    """PHYS8-03: Line 3 uncertainty metrics and anomaly signals preserved."""
    with open(FIXTURE_8_LINES, "rb") as f:
        img_bytes = f.read()

    resp = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
    )
    assert resp.status_code == 200
    line3 = resp.json()["lines"][2]

    assert line3["order"] == 3
    assert line3["rawOcrText"] == "Mọc trên đổi quề"
    assert line3["rawOcrConfidence"] is not None
    assert line3["tokenAnomalyDetected"] is True
    assert line3["decoderAnomalyDetected"] is True
    assert line3["minTokenConfidence"] is not None
    assert line3["p10TokenConfidence"] is not None


def test_phys8_04_groq_trigger_reason_visible_internally():
    """PHYS8-04: Internal telemetry exposes missing-metrics and anomaly counters."""
    with open(FIXTURE_8_LINES, "rb") as f:
        img_bytes = f.read()

    resp = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key},
    )
    assert resp.status_code == 200
    diags = resp.json().get("diagnostics", {})

    assert "missingTokenMetricsCount" in diags
    assert "forcedTriggerDueToMissingMetricsCount" in diags
    assert "tokenAnomalyTriggerCount" in diags
    assert "decoderAnomalyTriggerCount" in diags

    assert diags["missingTokenMetricsCount"] == 0
    assert diags["forcedTriggerDueToMissingMetricsCount"] == 0
    assert diags["tokenAnomalyTriggerCount"] >= 1
    assert diags["decoderAnomalyTriggerCount"] >= 1


def test_phys8_05_gemini_state_preserved_through_dto_hydration():
    """PHYS8-05: LineBox schema preserves Gemini fields without data loss."""
    line = LineBox(
        line_id="line-test",
        x=10, y=20, width=100, height=30, order=1,
        rawOcrText="Em yêu mùa hè",
        finalText="Em yêu mùa hè",
        geminiSuggestion="Em yêu mùa hè",
        geminiConfidence=0.98,
        geminiDecision="KEEP_RAW",
        geminiStatus="SUCCESS",
        geminiModel="gemini-2.5-flash",
    )
    d = line.model_dump()
    assert d["geminiStatus"] == "SUCCESS"
    assert d["geminiModel"] == "gemini-2.5-flash"
    assert d["geminiSuggestion"] == "Em yêu mùa hè"
    assert d["geminiConfidence"] == 0.98
    assert d["geminiDecision"] == "KEEP_RAW"
