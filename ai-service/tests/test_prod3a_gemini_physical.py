"""
PROD.3A Targeted Test Suite: GEMPHYS-01 to GEMPHYS-16
Gemini Physical Root-Cause Audit + End-to-End Recovery Verification.
"""

import asyncio
import hashlib
import json
import logging
import os
from unittest.mock import AsyncMock, patch

import numpy as np
import pytest

from app.config import settings
from app.integrations.gemini.client import (
    GeminiError,
    call_gemini_correction,
)
from app.integrations.gemini.corrector import (
    clear_gemini_cache,
    evaluate_gemini_safety,
    request_gemini_correction,
)
from app.integrations.gemini.key_pool import (
    GeminiKeyEntry,
    GeminiKeyPool,
    GeminiKeyState,
    init_gemini_pool,
)
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
from app.schemas.ocr_pilot import LineBox


def _make_crop() -> np.ndarray:
    return np.zeros((10, 40, 3), dtype=np.uint8)


def _safe_id(key: str) -> str:
    return f"sha256:{hashlib.sha256(key.encode()).hexdigest()[:16]}"


# ===========================================================================
# GEMPHYS-01: Current model config matches runtime executed model
# ===========================================================================
def test_gemphys_01_current_model_config_matches_runtime():
    assert settings.gemini_model == "gemini-3.6-flash"
    assert getattr(settings, "gemini_fallback_enabled", False) is False


# ===========================================================================
# GEMPHYS-02: Multi-key duplicate removal
# ===========================================================================
def test_gemphys_02_multikey_duplicate_removal():
    k1 = "AIzaTestDuplicateKey111111111111111"
    k2 = "AIzaTestDuplicateKey222222222222222"
    raw_str = f" {k1} , {k2} , {k1} ,  {k2} , {k1} "
    pool = GeminiKeyPool(raw_keys_str=raw_str)
    assert pool.configured_entries_count == 5
    assert pool.total_keys == 2
    assert pool.duplicates_removed == 3
    assert [e.raw_key for e in pool.entries] == [k1, k2]


# ===========================================================================
# GEMPHYS-03: AUTH_ERROR -> next key
# ===========================================================================
@pytest.mark.asyncio
async def test_gemphys_03_auth_error_failover_to_next_key():
    clear_gemini_cache()
    k1 = "AIzaAuthFailKey1"
    k2 = "AIzaAuthSuccessKey2"
    pool = init_gemini_pool(f"{k1},{k2}", cooldown_seconds=60)

    success_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="Em yeu mua he",
        suggested_text="Em yêu mùa hè",
        correction_needed=True,
        confidence=0.95,
        visual_support="STRONG",
        changes=[],
        uncertain=False,
    )

    async def mock_call(key_entry, **kwargs):
        if key_entry.raw_key == k1:
            raise GeminiError("AUTH_ERROR", "API key not valid", status_code=403)
        return success_resp

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_make_crop(), raw_text="Em yeu mua he")

    assert res is not None
    resp_obj, decision, _, _ = res
    assert resp_obj.suggested_text == "Em yêu mùa hè"
    assert pool.entries[0].state == GeminiKeyState.DISABLED_AUTH
    assert pool.entries[1].state == GeminiKeyState.HEALTHY


# ===========================================================================
# GEMPHYS-04: 429 -> next key
# ===========================================================================
@pytest.mark.asyncio
async def test_gemphys_04_rate_limit_429_failover_to_next_key():
    clear_gemini_cache()
    k1 = "AIza429Key1"
    k2 = "AIza429Key2"
    pool = init_gemini_pool(f"{k1},{k2}", cooldown_seconds=60)

    success_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="Em yeu mua he",
        suggested_text="Em yêu mùa hè",
        correction_needed=True,
        confidence=0.95,
        visual_support="STRONG",
        changes=[],
        uncertain=False,
    )

    async def mock_call(key_entry, **kwargs):
        if key_entry.raw_key == k1:
            raise GeminiError("RATE_LIMIT_429", "Quota exceeded", status_code=429)
        return success_resp

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_make_crop(), raw_text="Em yeu mua he")

    assert res is not None
    assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN
    assert pool.entries[1].state == GeminiKeyState.HEALTHY


# ===========================================================================
# GEMPHYS-05: 5xx/timeout -> next key
# ===========================================================================
@pytest.mark.asyncio
async def test_gemphys_05_5xx_timeout_failover_to_next_key():
    clear_gemini_cache()
    k1 = "AIza5xxKey1"
    k2 = "AIza5xxKey2"
    pool = init_gemini_pool(f"{k1},{k2}", cooldown_seconds=60)

    success_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="Em yeu mua he",
        suggested_text="Em yêu mùa hè",
        correction_needed=True,
        confidence=0.95,
        visual_support="STRONG",
        changes=[],
        uncertain=False,
    )

    async def mock_call(key_entry, **kwargs):
        if key_entry.raw_key == k1:
            raise GeminiError("SERVER_ERROR_5XX", "Service Unavailable", status_code=503)
        return success_resp

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_make_crop(), raw_text="Em yeu mua he")

    assert res is not None
    assert pool.entries[0].state == GeminiKeyState.COOLING_DOWN
    assert pool.entries[1].state == GeminiKeyState.HEALTHY


# ===========================================================================
# GEMPHYS-06: Same key not retried in same request
# ===========================================================================
@pytest.mark.asyncio
async def test_gemphys_06_same_key_not_retried_in_same_request():
    clear_gemini_cache()
    k1 = "AIzaSingleKeyRetryTest"
    pool = init_gemini_pool(k1, cooldown_seconds=60)

    attempted_keys = []

    async def mock_call(key_entry, **kwargs):
        attempted_keys.append(key_entry.safe_id)
        raise GeminiError("RATE_LIMIT_429", "Quota exceeded", status_code=429)

    with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
        res = await request_gemini_correction(_make_crop(), raw_text="Em yeu mua he")

    assert res is None
    # Key k1 must have been attempted exactly once
    assert len(attempted_keys) == 1


# ===========================================================================
# GEMPHYS-07: Raw key never logged
# ===========================================================================
def test_gemphys_07_raw_key_never_logged(caplog):
    caplog.set_level(logging.DEBUG)
    raw_secret_key = "".join(["AIza", "Sy", "MockSecretTestKey12345"])
    pool = GeminiKeyPool(raw_keys_str=raw_secret_key)
    entry = pool.entries[0]
    pool.mark_failure(entry, "RATE_LIMIT_429")

    # Inspect all logs
    for record in caplog.records:
        assert raw_secret_key not in record.message
        assert raw_secret_key not in str(record)

    # Inspect string representation of entry
    assert raw_secret_key not in str(entry.safe_id)
    assert entry.safe_id.startswith("sha256:")


# ===========================================================================
# GEMPHYS-08: Provider SUCCESS parses suggestion correctly (with fence stripping)
# ===========================================================================
@pytest.mark.asyncio
async def test_gemphys_08_provider_success_parses_json_fences():
    mock_resp = AsyncMock()
    mock_resp.is_success = True
    mock_resp.status_code = 200
    from unittest.mock import MagicMock
    mock_resp.json = MagicMock(return_value={
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": "```json\n{\n  \"suggested_text\": \"Mọc trên đồi quê\",\n  \"confidence\": 0.96,\n  \"correction_needed\": true,\n  \"visual_support\": \"STRONG\"\n}\n```"
                        }
                    ]
                }
            }
        ]
    })

    key_entry = GeminiKeyEntry("AIzaDummyTestKey", index=0)
    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        res = await call_gemini_correction(
            model="gemini-3.6-flash",
            system_prompt="system",
            raw_ocr_text="Moc tren doi que",
            image_b64="AAAA",
            key_entry=key_entry,
        )

    assert res.suggested_text == "Mọc trên đồi quê"
    assert res.confidence == 0.96
    assert res.visual_support == "STRONG"


# ===========================================================================
# GEMPHYS-09: FastAPI DTO preserves Gemini fields
# ===========================================================================
def test_gemphys_09_fastapi_dto_preserves_gemini_fields():
    box = LineBox(
        line_id="line-prod3a",
        x=10, y=20, width=200, height=40, order=1,
        rawOcrText="Mọc trên đổi quề",
        rawOcrConfidence=0.88,
        geminiSuggestion="Mọc trên đồi quê",
        geminiStatus="SUCCESS",
        geminiModel="gemini-3.6-flash",
        geminiConfidence=0.96,
        geminiDecision="AUTO_APPLY",
    )
    dumped = box.model_dump()
    assert dumped["geminiSuggestion"] == "Mọc trên đồi quê"
    assert dumped["geminiStatus"] == "SUCCESS"
    assert dumped["geminiModel"] == "gemini-3.6-flash"
    assert dumped["geminiConfidence"] == 0.96
    assert dumped["geminiDecision"] == "AUTO_APPLY"


# ===========================================================================
# GEMPHYS-10: Spring DTO/persistence/hydration preserves Gemini fields
# ===========================================================================
def test_gemphys_10_spring_dto_preserves_gemini_fields():
    base_dir = os.path.dirname(__file__)
    dto_file = os.path.abspath(
        os.path.join(base_dir, "../../../backend/business-api/src/main/java/com/mathvisionkids/api/ocr/multiline/LineBoxDto.java")
    )
    resp_file = os.path.abspath(
        os.path.join(base_dir, "../../../backend/business-api/src/main/java/com/mathvisionkids/api/ocr/multiline/MultilineLineResponse.java")
    )
    svc_file = os.path.abspath(
        os.path.join(base_dir, "../../../backend/business-api/src/main/java/com/mathvisionkids/api/ocr/multiline/OcrMultilineService.java")
    )

    with open(dto_file, "r", encoding="utf-8") as f:
        dto_src = f.read()
    assert "private String geminiSuggestion;" in dto_src
    assert "private String geminiDecision;" in dto_src
    assert "private String geminiStatus;" in dto_src

    with open(resp_file, "r", encoding="utf-8") as f:
        resp_src = f.read()
    assert "private String geminiSuggestion;" in resp_src
    assert "private String geminiDecision;" in resp_src

    with open(svc_file, "r", encoding="utf-8") as f:
        svc_src = f.read()
    assert "lineEntity.setGeminiSuggestion(box.getGeminiSuggestion());" in svc_src
    assert "lineEntity.setGeminiDecision(box.getGeminiDecision());" in svc_src


# ===========================================================================
# GEMPHYS-11: Mobile API mapping preserves Gemini fields
# ===========================================================================
def test_gemphys_11_mobile_api_mapping_preserves_gemini():
    ts_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/services/api/OcrPilotService.ts")
    )
    with open(ts_file, "r", encoding="utf-8") as f:
        ts_src = f.read()

    assert "geminiSuggestion?: string;" in ts_src
    assert "geminiDecision?: AdvisorDecision;" in ts_src
    assert "geminiStatus?: string;" in ts_src
    assert "geminiModel?: string;" in ts_src

    # In minimizeLineForTransport:
    assert "geminiSuggestion: line.geminiSuggestion" in ts_src
    assert "geminiDecision: line.geminiDecision" in ts_src


# ===========================================================================
# GEMPHYS-12: Frontend does not hide a valid distinct Gemini suggestion
# ===========================================================================
def test_gemphys_12_frontend_does_not_hide_valid_distinct_gemini():
    ui_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(ui_file, "r", encoding="utf-8") as f:
        ui_src = f.read()

    assert "geminiView.status === 'SUCCESS'" in ui_src
    assert "Gợi ý 2" in ui_src
    assert "Chọn gợi ý 2" in ui_src


# ===========================================================================
# GEMPHYS-13: Provider-specific unavailable text is NOT rendered
# ===========================================================================
def test_gemphys_13_provider_specific_unavailable_text_not_rendered():
    ui_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(ui_file, "r", encoding="utf-8") as f:
        ui_src = f.read()

    assert "Gemini tạm thời chưa khả dụng." not in ui_src
    assert "Groq tạm thời chưa khả dụng." not in ui_src


# ===========================================================================
# GEMPHYS-14: rawOcrText immutable
# ===========================================================================
def test_gemphys_14_raw_ocr_text_immutable():
    ui_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../apps/student-mobile/src/app/ocr-pilot/multiline-result.tsx")
    )
    with open(ui_file, "r", encoding="utf-8") as f:
        ui_src = f.read()

    assert "rawOcrText: targetText" not in ui_src
    assert "finalText: targetText" in ui_src


# ===========================================================================
# GEMPHYS-15: finalText defaults to rawOcrText
# ===========================================================================
def test_gemphys_15_final_text_defaults_to_raw():
    box = LineBox(
        line_id="line-def",
        x=0, y=0, width=50, height=20, order=1,
        rawOcrText="Dong goc nguyen ban",
        rawOcrConfidence=0.90,
    )
    assert box.finalText is None or box.finalText == "Dong goc nguyen ban"


# ===========================================================================
# GEMPHYS-16: 8-line segmentation unchanged
# ===========================================================================
def test_gemphys_16_8line_segmentation_unchanged():
    from app.api.ocr import run_grid_handwriting_detection
    import cv2

    img_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures/ocr_eval/OWNER_POEM_8_LINES.png")
    )
    assert os.path.exists(img_path), f"Fixture not found at {img_path}"
    bgr = cv2.imread(img_path)
    assert bgr is not None

    boxes, diag = run_grid_handwriting_detection(bgr)
    assert len(boxes) == 8, f"Expected 8 line boxes, got {len(boxes)}"


# ===========================================================================
# GEMPHYS-17: Truthful diagnostics semantics fields present
# ===========================================================================
def test_gemphys_17_truthful_diagnostics_semantics_present():
    """Verify ocr.py defines geminiAttempted, geminiSucceeded, geminiAttemptCount, geminiSuccessCount."""
    ocr_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../app/api/ocr.py")
    )
    with open(ocr_file, "r", encoding="utf-8") as f:
        src = f.read()

    assert 'diagnostics["geminiAttempted"]' in src
    assert 'diagnostics["geminiSucceeded"]' in src
    assert 'diagnostics["geminiAttemptCount"]' in src
    assert 'diagnostics["geminiSuccessCount"]' in src


# ===========================================================================
# GEMPHYS-18: geminiSucceeded is only True when geminiStatus == SUCCESS
# ===========================================================================
def test_gemphys_18_gemini_succeeded_only_when_success():
    """Verify geminiSucceeded logic checks geminiStatus == SUCCESS."""
    ocr_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../app/api/ocr.py")
    )
    with open(ocr_file, "r", encoding="utf-8") as f:
        src = f.read()

    assert 'gemini_success_count = sum(1 for l in lines if getattr(l, "geminiStatus", None) == "SUCCESS")' in src
    assert 'diagnostics["geminiSucceeded"] = (gemini_success_count > 0)' in src
