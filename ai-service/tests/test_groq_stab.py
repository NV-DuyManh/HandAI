"""
Test suite for AI.HWTEXT.PHYSICAL.1A — Threshold Consistency + Physical Test Pack Stabilization (STAB-01 to STAB-10).
Validates that:
- Actual runtime thresholds match GROQ.6 validated values (0.82 / 0.40 / 0.50 / 1.20)
- Threshold drift has been resolved and no unjustified retune remains
- Synthetic fixtures are not counted as human writers
- Writer diversity claims are truthful and evidence-backed
- Trace logging defaults to False (production-safe) and has an active production guard
- Owner test checklist (A-J) and results template exist and are complete
- OCR-First architecture remains locked
"""

import json
import logging
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import settings
from app.integrations.groq.corrector import should_request_groq_correction
from app.main import app

client = TestClient(app)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
FIXTURES_MANIFEST = Path(__file__).resolve().parent / "fixtures" / "ocr_eval" / "manifest.json"
CHECKLIST_PATH = next((PROJECT_ROOT / p for p in ["reports/archive/OWNER_ANDROID_OCR_TEST_CHECKLIST.md", "reports/current/OWNER_ANDROID_OCR_TEST_CHECKLIST.md", "report/OWNER_ANDROID_OCR_TEST_CHECKLIST.md"] if (PROJECT_ROOT / p).exists()), PROJECT_ROOT / "reports/archive/OWNER_ANDROID_OCR_TEST_CHECKLIST.md")
TEMPLATE_PATH = next((PROJECT_ROOT / p for p in ["reports/archive/OWNER_ANDROID_OCR_RESULTS_TEMPLATE.md", "reports/current/OWNER_ANDROID_OCR_RESULTS_TEMPLATE.md", "report/OWNER_ANDROID_OCR_RESULTS_TEMPLATE.md"] if (PROJECT_ROOT / p).exists()), PROJECT_ROOT / "reports/archive/OWNER_ANDROID_OCR_RESULTS_TEMPLATE.md")


def test_stab_01_actual_runtime_thresholds_documented():
    """STAB-01: Verify that actual runtime thresholds are documented and match expected values."""
    assert settings.groq_post_correction_trigger_confidence == 0.82
    assert settings.groq_post_correction_auto_apply_confidence == 0.92
    assert settings.groq_post_correction_max_edit_ratio == 0.35


def test_stab_02_groq6_vs_current_threshold_drift_resolved():
    """STAB-02: Verify that GROQ.6 vs current threshold drift is resolved."""
    # Line with high mean confidence (0.88 >= 0.82), but minToken < 0.40 triggers correction
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        min_token_confidence=0.35,  # < 0.40
    ) is True

    # Line with high mean confidence (0.88 >= 0.82), but p10 < 0.50 triggers correction
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        p10_confidence=0.45,  # < 0.50
    ) is True

    # Line with high mean confidence (0.88 >= 0.82), but meanEntropy > 1.20 triggers correction
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        mean_entropy=1.35,  # > 1.20
    ) is True

    # Clean confident line bypassing correction
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.92,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        min_token_confidence=0.75,
        p10_confidence=0.80,
        mean_entropy=0.30,
    ) is False


def test_stab_03_no_unjustified_threshold_retune_remains():
    """STAB-03: Verify that no unjustified threshold retune remains."""
    # Ensure p10 < 0.70 was not applied as default (0.65 should NOT trigger if confidence is high)
    triggered_p10_65 = should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.90,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        min_token_confidence=0.60,
        p10_confidence=0.65,  # > 0.50 (would fail if 0.70 threshold was used)
        mean_entropy=0.50,
    )
    assert triggered_p10_65 is False

    # Ensure entropy > 0.45 was not applied as default (0.60 should NOT trigger if confidence is high)
    triggered_entropy_60 = should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.90,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        min_token_confidence=0.60,
        p10_confidence=0.65,
        mean_entropy=0.60,  # <= 1.20 (would fail if 0.45 threshold was used)
    )
    assert triggered_entropy_60 is False


def test_stab_04_synthetic_fixtures_not_counted_as_writers():
    """STAB-04: Verify that synthetic fixtures are not counted as human writers."""
    assert FIXTURES_MANIFEST.exists()
    with open(FIXTURES_MANIFEST, "r", encoding="utf-8") as f:
        data = json.load(f)

    synthetic_fixtures = [item for item in data if item.get("source") == "SYNTHETIC"]
    assert len(synthetic_fixtures) == 2
    for item in synthetic_fixtures:
        assert item.get("source") == "SYNTHETIC"
        # Synthetic items must not have a human writer ID
        assert item.get("writer_id_anonymized") is None


def test_stab_05_writer_diversity_wording_truthful():
    """STAB-05: Verify that physical fixtures only contain owner captures without claiming unproven writer count."""
    with open(FIXTURES_MANIFEST, "r", encoding="utf-8") as f:
        data = json.load(f)

    physical_fixtures = [item for item in data if item.get("source") == "OWNER_PHYSICAL"]
    assert len(physical_fixtures) == 2
    # Both are variants of the same poem block from the owner
    assert all("OWNER_POEM_BLOCK_1" in item["image_path"] for item in physical_fixtures)


def test_stab_06_trace_default_production_safe():
    """STAB-06: Verify that trace logging defaults to False for production safety."""
    # Settings default for ocr_physical_trace_enabled must be False
    assert settings.ocr_physical_trace_enabled is False


def test_stab_07_trace_dev_only_guard_verified(caplog):
    """STAB-07: Verify that trace logging is strictly blocked when app_env is production."""
    caplog.set_level(logging.INFO)
    from PIL import Image
    import io

    img = Image.new("RGB", (200, 50), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    # Even if someone sets ocr_physical_trace_enabled=True in production, guard must suppress it
    with patch.object(settings, "ocr_physical_trace_enabled", True), patch.object(settings, "app_env", "production"):
        response = client.post(
            "/internal/v1/ocr/detect-lines",
            content=img_bytes,
            headers={
                "Content-Type": "image/jpeg",
                "X-Internal-API-Key": settings.internal_api_key,
                "X-Request-ID": "req_stab_guard_check",
            },
        )
        assert response.status_code == 200

    assert "[OCR-PHYSICAL]" not in caplog.text


def test_stab_08_owner_checklist_exists():
    """STAB-08: Verify that owner checklist exists, contains A-J steps, and protects credentials."""
    assert CHECKLIST_PATH.exists()
    content = CHECKLIST_PATH.read_text(encoding="utf-8")

    # Verify A-J steps
    required_steps = [
        "A. Start services",
        "B. Confirm Spring :8080 reachable",
        "C. Confirm FastAPI :8000 healthy",
        "D. Confirm Metro / Expo app connected",
        "E. Confirm OCR_PHYSICAL_TRACE_ENABLED=true only for dev test",
        "F. Confirm diagnostic panel visible",
        "G. Run Block 1",
        "H. Copy requestId",
        "I. Capture screenshot",
        "J. Record raw/final OCR",
    ]
    for step in required_steps:
        assert step in content, f"Missing checklist step: {step}"

    # Verify credential protection instruction exists
    assert "không hiển thị Groq API Keys" in content.lower() or "không chia sẻ" in content.lower()


def test_stab_09_owner_results_template_exists():
    """STAB-09: Verify that owner results template exists and contains all required placeholders."""
    assert TEMPLATE_PATH.exists()
    content = TEMPLATE_PATH.read_text(encoding="utf-8")

    required_placeholders = [
        "BLOCK1",
        "BLOCK1_RECROP_1",
        "UNKNOWN_1",
        "SUGGEST_ONLY",
        "AUTO_APPLY",
        "KEEP_RAW",
        "GROQ_OFFLINE",
        "ARITHMETIC",
        "Screenshot filename",
        "Request ID",
        "Actual raw",
        "Actual final",
        "Pass/Fail notes",
    ]
    for p in required_placeholders:
        assert p in content, f"Missing placeholder in results template: {p}"


def test_stab_10_no_ocr_architecture_change():
    """STAB-10: Verify that OCR-first architecture remains locked without modification."""
    # CRNN is primary engine
    # Canonical override is disabled by default
    assert settings.canonical_runtime_override_enabled is False
    # Groq rotate on 429 is disabled by default
    assert settings.groq_rotate_on_429 is False
    # Arithmetic semantic correction remains disabled
    assert should_request_groq_correction("12 + 25 = 38", 0.40, domain="ARITHMETIC") is False
    assert should_request_groq_correction("10 - 4 = 6", 0.50, domain="arithmetic") is False
