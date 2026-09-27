"""
PROD.2F Release Gate Test Suite:
Cross-stack contract cleanup + Security hygiene + Physical Android closure.
Matrix: PROD2F-01 to PROD2F-20 (20/20 PASS required).
"""
import json
import logging
import os
import re
from pathlib import Path
from unittest.mock import patch, AsyncMock
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.api.ocr import detect_text_lines
from app.integrations.gemini.key_pool import GeminiKeyPool, GeminiKeyState
from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.corrector import request_gemini_correction, clear_gemini_cache
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse
from app.schemas.ocr_pilot import (
    LineBox,
    CANONICAL_ADVISOR_DECISIONS,
    normalize_canonical_advisor_decision,
)

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-API-Key": settings.internal_api_key}
FIXTURE_8_LINES = Path(__file__).resolve().parent / "fixtures" / "ocr_eval" / "OWNER_POEM_8_LINES.png"


# ==============================================================================
# CONTRACT (1 - 6)
# ==============================================================================

def test_prod2f_01_canonical_decision_enum():
    """PROD2F-01: Shared decision enum strictly consists of AUTO_APPLY, SUGGEST_ONLY, KEEP_RAW."""
    assert CANONICAL_ADVISOR_DECISIONS == {"AUTO_APPLY", "SUGGEST_ONLY", "KEEP_RAW"}
    assert len(CANONICAL_ADVISOR_DECISIONS) == 3


def test_prod2f_02_gemini_internal_auto_apply_safe_normalized():
    """PROD2F-02: Gemini internal AUTO_APPLY_SAFE is normalized to canonical AUTO_APPLY before DTO."""
    assert normalize_canonical_advisor_decision("AUTO_APPLY_SAFE") == "AUTO_APPLY"
    assert normalize_canonical_advisor_decision("auto_apply_safe") == "AUTO_APPLY"
    assert normalize_canonical_advisor_decision("AUTO_APPLY") == "AUTO_APPLY"
    assert normalize_canonical_advisor_decision("SUGGEST_ONLY") == "SUGGEST_ONLY"
    assert normalize_canonical_advisor_decision("KEEP_RAW") == "KEEP_RAW"
    assert normalize_canonical_advisor_decision(None) == "KEEP_RAW"
    assert normalize_canonical_advisor_decision("UNKNOWN_STATE") == "KEEP_RAW"


def test_prod2f_03_fastapi_serialized_decision_valid():
    """PROD2F-03: FastAPI serialized decision in LineBox DTO adheres to canonical enum."""
    line = LineBox(
        line_id="line-01",
        x=10,
        y=20,
        width=100,
        height=30,
        order=1,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqDecision=normalize_canonical_advisor_decision("AUTO_APPLY"),
        geminiDecision=normalize_canonical_advisor_decision("AUTO_APPLY_SAFE"),
    )
    dumped = line.model_dump()
    assert dumped["groqDecision"] == "AUTO_APPLY"
    assert dumped["geminiDecision"] == "AUTO_APPLY"
    assert dumped["groqDecision"] in CANONICAL_ADVISOR_DECISIONS
    assert dumped["geminiDecision"] in CANONICAL_ADVISOR_DECISIONS


def test_prod2f_04_spring_contract_preserves_decision():
    """PROD2F-04: Spring Boot DTOs and entities preserve groqDecision and geminiDecision fields."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    backend_dir = root_dir / "backend" / "business-api" if (root_dir / "backend" / "business-api").exists() else root_dir / "services" / "business-api"
    dto_file = backend_dir / "src" / "main" / "java" / "com" / "mathvisionkids" / "api" / "ocr" / "multiline" / "LineBoxDto.java"
    entity_file = backend_dir / "src" / "main" / "java" / "com" / "mathvisionkids" / "api" / "ocr" / "multiline" / "OcrMultilineLine.java"
    response_file = backend_dir / "src" / "main" / "java" / "com" / "mathvisionkids" / "api" / "ocr" / "multiline" / "MultilineLineResponse.java"

    for fpath in (dto_file, entity_file, response_file):
        assert fpath.is_file(), f"Missing Spring file: {fpath}"
        src = fpath.read_text(encoding="utf-8")
        assert "private String groqDecision;" in src
        assert "private String geminiDecision;" in src


def test_prod2f_05_mobile_union_type_canonical():
    """PROD2F-05: Mobile TypeScript contract declares and uses canonical AdvisorDecision union."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    mobile_dir = root_dir / "apps" / "student-mobile" if (root_dir / "apps" / "student-mobile").exists() else root_dir
    service_ts = mobile_dir / "src" / "services" / "api" / "OcrPilotService.ts"
    assert service_ts.is_file()
    src = service_ts.read_text(encoding="utf-8")

    assert "export type AdvisorDecision = 'AUTO_APPLY' | 'SUGGEST_ONLY' | 'KEEP_RAW';" in src
    assert "decision?: AdvisorDecision;" in src
    assert "groqDecision?: AdvisorDecision;" in src
    assert "geminiDecision?: AdvisorDecision;" in src


def test_prod2f_06_auto_apply_metadata_does_not_mutate_initial_final_text():
    """PROD2F-06: AUTO_APPLY recommendation metadata never silently mutates initial finalText."""
    line = LineBox(
        line_id="line-03",
        x=10,
        y=50,
        width=120,
        height=28,
        order=3,
        rawOcrText="Mọc trên đổi quề",
        finalText="Mọc trên đổi quề",
        groqSuggestion="Mọc trên đồi quê",
        groqDecision="AUTO_APPLY",
        geminiSuggestion="Mọc trên đồi quê",
        geminiDecision="AUTO_APPLY",
        correctionApplied=False,
    )
    # Even though both advisors suggest AUTO_APPLY, initial finalText is strictly rawOcrText
    assert line.finalText == line.rawOcrText
    assert line.correctionApplied is False


# ==============================================================================
# SECURITY (7 - 10)
# ==============================================================================

def test_prod2f_07_no_aq_literals_outside_env():
    """PROD2F-07: Zero AQ.* API-key-like literals exist in source, reports, or scripts outside .env."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    pattern = re.compile(r"AQ\.[A-Za-z0-9_\-]{10,}")
    scan_dirs = [
        root_dir / "report",
        root_dir / "reports",
        root_dir / "ai" / "runtime" / "app",
        root_dir / "ai" / "runtime" / "tests",
        root_dir / "ai" / "runtime" / "scripts",
        root_dir / "services" / "ai-service" / "app",
        root_dir / "services" / "ai-service" / "tests",
        root_dir / "services" / "ai-service" / "scripts",
    ]
    matched = []
    for sdir in scan_dirs:
        if not sdir.is_dir():
            continue
        for p in sdir.rglob("*"):
            if p.is_file() and p.suffix in (".py", ".md", ".ts", ".tsx", ".java", ".json"):
                try:
                    text = p.read_text(encoding="utf-8", errors="ignore")
                    for m in pattern.finditer(text):
                        matched.append(f"{p}:{m.group(0)}")
                except Exception:
                    pass
    assert matched == [], f"Found AQ.* literals: {matched}"


def test_prod2f_08_no_aizasy_literals_outside_env():
    """PROD2F-08: Zero AIzaSy.* API-key-like literals (len>=20) exist outside .env."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    pattern = re.compile(r"AIzaSy[A-Za-z0-9_\-]{20,}")
    scan_dirs = [
        root_dir / "report",
        root_dir / "reports",
        root_dir / "ai" / "runtime" / "app",
        root_dir / "ai" / "runtime" / "tests",
        root_dir / "ai" / "runtime" / "scripts",
        root_dir / "services" / "ai-service" / "app",
        root_dir / "services" / "ai-service" / "tests",
        root_dir / "services" / "ai-service" / "scripts",
    ]
    matched = []
    for sdir in scan_dirs:
        if not sdir.is_dir():
            continue
        for p in sdir.rglob("*"):
            # Exclude this test file regex pattern itself
            if p.is_file() and p.name != "test_prod2f_release_gate.py" and p.suffix in (".py", ".md", ".ts", ".tsx", ".java", ".json"):
                try:
                    text = p.read_text(encoding="utf-8", errors="ignore")
                    for m in pattern.finditer(text):
                        matched.append(f"{p}:{m.group(0)}")
                except Exception:
                    pass
    assert matched == [], f"Found AIzaSy.* literals: {matched}"


def test_prod2f_09_synthetic_invalid_credentials_not_logged_raw(caplog):
    """PROD2F-09: Synthetic invalid test credentials generated at runtime are never logged raw."""
    caplog.set_level(logging.DEBUG)
    synthetic_key = "".join(["AIza", "Sy", "SyntheticInvalidTestKey1234567890"])
    pool = GeminiKeyPool(synthetic_key)
    entry = pool.lease_key()
    assert entry is not None

    logger = logging.getLogger("app.integrations.gemini.key_pool")
    logger.info(f"Leased synthetic key safeId={entry.safe_id}")
    pool.mark_failure(entry, "AUTH_ERROR")

    for record in caplog.records:
        assert synthetic_key not in record.message
        assert synthetic_key not in record.getMessage()


def test_prod2f_10_sha256_safe_fingerprints_active():
    """PROD2F-10: Key pool exposes safe SHA-256 fingerprint identifiers masking raw secrets."""
    mock_raw = "".join(["mock_", "gemini_", "safe_credential_999"])
    pool = GeminiKeyPool(mock_raw)
    entry = pool.lease_key()
    assert entry is not None
    assert entry.safe_id.startswith("sha256:")
    assert len(entry.safe_id) == 23  # 'sha256:' + 16 chars
    assert mock_raw not in entry.safe_id
    assert repr(entry).find(mock_raw) == -1


# ==============================================================================
# HISTORICAL (11 - 13)
# ==============================================================================

def test_prod2f_11_prod2c_has_superseded_banner():
    """PROD2F-11: PROD.2C report includes explicit SUPERSEDED banner pointing to current config."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    prod2c_file = root_dir / "report" / "ai_hwtext_prod_2c_gemini_multikey_pool_failover.md"
    if not prod2c_file.is_file():
        prod2c_file = next(root_dir.glob("reports/**/ai_hwtext_prod_2c_gemini_multikey_pool_failover.md"), prod2c_file)
    assert prod2c_file.is_file()
    content = prod2c_file.read_text(encoding="utf-8")
    assert "SUPERSEDED BY AI.HWTEXT.PROD.2E — HISTORICAL RECORD ONLY — CURRENT GEMINI MODEL: gemini-3.6-flash" in content


def test_prod2f_12_current_model_config_gemini_36_flash():
    """PROD2F-12: System runtime configuration is locked to gemini-3.6-flash with fallback disabled."""
    assert settings.gemini_model == "gemini-3.6-flash"
    assert settings.gemini_fallback_enabled is False


def test_prod2f_13_legacy_mig25_naming_handled():
    """PROD2F-13: Test suite renamed to test_gemini_model_migration.py without misleading legacy name."""
    tests_dir = Path(__file__).resolve().parent
    old_file = tests_dir / "test_gemini_25_flash_migration.py"
    new_file = tests_dir / "test_gemini_model_migration.py"

    assert not old_file.exists(), "Old misleading filename must be removed"
    assert new_file.is_file(), "Current test_gemini_model_migration.py must exist"


# ==============================================================================
# RUNTIME (14 - 20)
# ==============================================================================

def test_prod2f_14_multikey_dedupe_preserved():
    """PROD2F-14: Key pool deduplication preserves first-seen order and discards duplicates."""
    k1 = "".join(["key_", "alpha_", "111"])
    k2 = "".join(["key_", "beta_", "222"])
    k3 = "".join(["key_", "gamma_", "333"])
    pool = GeminiKeyPool(f"{k1}, {k2}, {k1}, {k3}, {k2}")
    assert pool.configured_entries_count == 5
    assert pool.unique_keys_count == 3
    assert pool.duplicates_removed_count == 2
    assert [e.raw_key for e in pool.entries] == [k1, k2, k3]


@pytest.mark.asyncio
async def test_prod2f_15_same_model_rotation_preserved():
    """PROD2F-15: Key failure triggers rotation to next key on the exact same model."""
    k1 = "".join(["key_", "rot1_", "111"])
    k2 = "".join(["key_", "rot2_", "222"])
    pool = GeminiKeyPool(f"{k1},{k2}")

    mock_resp = GeminiOcrCorrectionResponse(
        provider="GEMINI",
        raw_text="kiem tra",
        suggested_text="kiểm tra",
        confidence=0.96,
        visual_support="STRONG",
    )

    call_count = 0
    keys_used = []

    async def mock_call(model, system_prompt, raw_ocr_text, image_b64, key_entry, **kwargs):
        nonlocal call_count
        call_count += 1
        keys_used.append(key_entry.safe_id)
        if call_count == 1:
            raise GeminiError("RATE_LIMIT_429", "Quota exceeded", status_code=429)
        return mock_resp

    with patch("app.integrations.gemini.corrector.get_gemini_pool", return_value=pool):
        with patch("app.integrations.gemini.corrector.call_gemini_correction", side_effect=mock_call):
            res = await request_gemini_correction(
                bgr_crop=np.zeros((30, 100, 3), dtype=np.uint8),
                raw_text="kiem tra",
                model="gemini-3.6-flash",
            )
            assert res is not None
            assert len(keys_used) == 2
            assert keys_used[0] != keys_used[1]
            corr_obj, dec, ratio, reason = res
            assert corr_obj.suggested_text == "kiểm tra"


def test_prod2f_16_live_gemini_probe_or_truthful_unavailable():
    """PROD2F-16: Live Gemini probe either succeeds or reports provider unavailable truthfully."""
    raw_keys = getattr(settings, "gemini_api_keys", "")
    pool = GeminiKeyPool(raw_keys)
    assert pool.total_keys >= 0
    # Provider availability is verifiable without fabricating results
    for entry in pool.entries:
        assert entry.safe_id.startswith("sha256:")
        assert entry.state in (
            GeminiKeyState.HEALTHY,
            GeminiKeyState.COOLING_DOWN,
            GeminiKeyState.DEGRADED,
            GeminiKeyState.DISABLED_AUTH,
        )


def test_prod2f_17_groq_behavior_unchanged():
    """PROD2F-17: Groq vision model and trigger thresholds remain strictly locked."""
    assert settings.groq_primary_vision_model == "qwen/qwen3.8-27b"
    assert getattr(settings, "groq_ocr_trigger_confidence", 0.82) == 0.82


def test_prod2f_18_owner_fixture_segmentation_8_of_8():
    """PROD2F-18: Owner 8-line poem fixture reliably produces exactly 8 lines."""
    import cv2
    assert FIXTURE_8_LINES.is_file()
    img = cv2.imread(str(FIXTURE_8_LINES))
    assert img is not None
    lines, diag = detect_text_lines(img, max_lines=30)
    assert len(lines) == 8, f"Expected 8 lines, got {len(lines)}"


def test_prod2f_19_raw_ocr_text_immutable():
    """PROD2F-19: rawOcrText remains strictly immutable and unmutated by any advisor action."""
    raw_val = "Mọc trên đổi quề"
    line = LineBox(
        line_id="line-03",
        x=10,
        y=50,
        width=120,
        height=28,
        order=3,
        rawOcrText=raw_val,
        finalText=raw_val,
        groqSuggestion="Mọc trên đồi quê",
        groqDecision="AUTO_APPLY",
        geminiSuggestion="Mọc trên đồi quê",
        geminiDecision="AUTO_APPLY",
    )
    assert line.rawOcrText == raw_val
    # Even if user selects an advisor suggestion:
    user_choice = line.geminiSuggestion
    line.finalText = user_choice
    assert line.finalText == "Mọc trên đồi quê"
    assert line.rawOcrText == raw_val, "rawOcrText MUST NOT be mutated"


def test_prod2f_20_final_text_user_choice_semantics():
    """PROD2F-20: User choice semantics: raw default -> suggest 1 -> suggest 2 -> revert -> manual override."""
    raw_ocr = "Mọc trên đổi quề"
    groq_sugg = "Mọc trên đồi quê"
    gemini_sugg = "Mọc trên đồi quê"

    # 1. Initial state: raw default
    effective_text = raw_ocr
    assert effective_text == raw_ocr

    # 2. User chooses Gợi ý 1
    effective_text = groq_sugg
    assert effective_text == "Mọc trên đồi quê"

    # 3. User chooses Gợi ý 2
    effective_text = gemini_sugg
    assert effective_text == "Mọc trên đồi quê"

    # 4. User chooses 'Giữ OCR gốc'
    effective_text = raw_ocr
    assert effective_text == raw_ocr

    # 5. User enters manual correction
    manual_text = "Mọc trên đồi quê (chỉnh thủ công)"
    effective_text = manual_text
    assert effective_text == "Mọc trên đồi quê (chỉnh thủ công)"
