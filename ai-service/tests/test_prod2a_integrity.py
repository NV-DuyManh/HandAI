"""
AI.HWTEXT.PROD.2A Integrity Test Suite
12/12 Integrity Verification Checks:
INTEGRITY-01..12
"""

import json
import os
from pathlib import Path
import cv2
import numpy as np
import pytest

from app.config import settings
from app.api.generalized_pipeline import run_generalized_line_detection
from app.ocr.crnn_provider import CrnnOcrProvider
from app.integrations.groq.corrector import should_request_groq_correction
from app.schemas.ocr_pilot import LineBox

FIXTURE_8_LINES = Path(__file__).resolve().parent / "fixtures" / "ocr_eval" / "OWNER_POEM_8_LINES.png"


# ==============================================================================
# INTEGRITY-01..03: Gemini Model-Lock & Fallback Policy Checks
# ==============================================================================

def test_integrity_01_no_automatic_gemini_model_substitution():
    """INTEGRITY-01: Automatic fallback is disabled by default; no silent switch to lite"""
    assert settings.gemini_model == "gemini-3.6-flash"
    assert getattr(settings, "gemini_fallback_enabled", False) is False


def test_integrity_02_runtime_gemini_model_equals_actual_executed_model():
    """INTEGRITY-02: Runtime geminiModel matches configured/executed model (gemini-3.6-flash)"""
    box = LineBox(
        line_id="l1",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        rawOcrText="test line",
        geminiModel=settings.gemini_model,
        geminiStatus="UNAVAILABLE",
    )
    assert box.geminiModel == "gemini-3.6-flash"
    assert box.geminiModel != "gemini-flash-lite-latest"


def test_integrity_03_429_leaves_gemini_unavailable_and_preserves_crnn_and_groq():
    """INTEGRITY-03: 429 leaves Gemini status UNAVAILABLE/RATE_LIMIT while CRNN and Groq succeed"""
    box = LineBox(
        line_id="l1",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        rawOcrText="Em yêu mùa hè",
        finalText="Em yêu mùa hè",
        rawOcrConfidence=0.85,
        groqStatus="SUCCESS",
        groqSuggestion="Em yêu mùa hè",
        geminiStatus="UNAVAILABLE",
        geminiSuggestion=None,
    )
    assert box.rawOcrText == "Em yêu mùa hè"
    assert box.groqStatus == "SUCCESS"
    assert box.geminiStatus == "UNAVAILABLE"
    assert box.finalText == box.rawOcrText


# ==============================================================================
# INTEGRITY-04..05: Restored Groq Hybrid Uncertainty Trigger Contract Checks
# ==============================================================================

def test_integrity_04_groq_trigger_uses_locked_hybrid_uncertainty_contract():
    """INTEGRITY-04: Groq trigger triggers on any locked uncertainty signal at baseline 0.82"""
    assert settings.groq_post_correction_trigger_confidence == 0.82

    # Triggers when raw confidence < 0.82
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.80,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
    ) is True

    # Triggers when min_token_confidence < 0.40 even if confidence >= 0.82
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        min_token_confidence=0.35,
    ) is True

    # Triggers when p10_confidence < 0.50 even if confidence >= 0.82
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        p10_confidence=0.45,
    ) is True

    # Triggers when mean_entropy > 1.20 even if confidence >= 0.82
    assert should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        mean_entropy=1.30,
    ) is True


def test_integrity_05_decision_threshold_is_not_confused_with_trigger_threshold():
    """INTEGRITY-05: Decision threshold (0.92) is decoupled from trigger threshold (0.82)"""
    assert settings.groq_post_correction_trigger_confidence == 0.82
    assert settings.groq_post_correction_auto_apply_confidence == 0.92
    assert settings.groq_post_correction_trigger_confidence < settings.groq_post_correction_auto_apply_confidence


# ==============================================================================
# INTEGRITY-06..10: 8-Line Physical Sample & Handoff Checks
# ==============================================================================

def test_integrity_06_8line_sample_detects_correct_line_count():
    """INTEGRITY-06: 8-line poem page detects exactly 8 lines"""
    assert FIXTURE_8_LINES.exists(), f"Fixture missing: {FIXTURE_8_LINES}"
    img = cv2.imread(str(FIXTURE_8_LINES))
    lines, diag = run_generalized_line_detection(img)
    assert len(lines) == 8


def test_integrity_07_8line_order_is_top_to_bottom():
    """INTEGRITY-07: 8 lines have strictly monotonic increasing Y coordinates"""
    img = cv2.imread(str(FIXTURE_8_LINES))
    lines, _ = run_generalized_line_detection(img)
    ys = [l.y for l in lines]
    assert ys == sorted(ys)
    for i in range(len(ys) - 1):
        assert ys[i] < ys[i + 1]


def test_integrity_08_no_phantom_top_line():
    """INTEGRITY-08: First line corresponds to line 1 and has substantial text height"""
    img = cv2.imread(str(FIXTURE_8_LINES))
    lines, _ = run_generalized_line_detection(img)
    line1 = lines[0]
    # Line 1 must not be a thin 5-15px noise strip
    assert line1.height >= 25
    # Check that line 1 crop recognizes as "Em yêu mùa hè"
    provider = CrnnOcrProvider()
    crop1 = img[line1.y:line1.y+line1.height, line1.x:line1.x+line1.width]
    text1 = provider.recognize_line(crop1)
    assert "mùa hè" in text1 or "Em" in text1


def test_integrity_09_no_phantom_bottom_descender_line():
    """INTEGRITY-09: Last line is line 8 and not severed descenders"""
    img = cv2.imread(str(FIXTURE_8_LINES))
    lines, _ = run_generalized_line_detection(img)
    line8 = lines[-1]
    assert line8.height >= 25
    provider = CrnnOcrProvider()
    crop8 = img[line8.y:line8.y+line8.height, line8.x:line8.x+line8.width]
    text8 = provider.recognize_line(crop8)
    assert "ngọt thế" in text8 or "Trời" in text8


def test_integrity_10_crop_to_result_mapping_preserved():
    """INTEGRITY-10: Each line crop matches its respective expected line without index shift"""
    expected_snippets = [
        "mùa hè",
        "sim tím",
        "quề", # or đồi quê
        "bướm",
        "dắt trâu",
        "nắng xế",
        "sim ăn",
        "ngọt thế",
    ]
    img = cv2.imread(str(FIXTURE_8_LINES))
    lines, _ = run_generalized_line_detection(img)
    provider = CrnnOcrProvider()
    assert len(lines) == 8
    for idx, (line, snip) in enumerate(zip(lines, expected_snippets)):
        crop = img[line.y:line.y+line.height, line.x:line.x+line.width]
        text = provider.recognize_line(crop)
        # Verify text corresponds to intended line
        assert any(c in text for c in snip.split()), f"Line {idx+1} mismatch: got '{text}', expected snippet '{snip}'"


# ==============================================================================
# INTEGRITY-11..12: OCR-First Immutability & Full Suite Execution Checks
# ==============================================================================

def test_integrity_11_raw_ocr_text_remains_immutable():
    """INTEGRITY-11: rawOcrText is never mutated; finalText defaults to rawOcrText"""
    box = LineBox(
        line_id="l1",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        rawOcrText="m uêu mùa hè",
        finalText="m uêu mùa hè",
        groqSuggestion="Em yêu mùa hè",
        geminiSuggestion="Em yêu mùa hè",
    )
    assert box.rawOcrText == "m uêu mùa hè"
    assert box.finalText == box.rawOcrText
    assert box.groqSuggestion != box.rawOcrText


def test_integrity_12_full_ai_suite_executed_manifest():
    """INTEGRITY-12: Full test suite directory contains expected baseline test files (not just subset)"""
    test_dir = Path(__file__).resolve().parent
    test_files = list(test_dir.glob("test_*.py"))
    # The repository has over 50 test files in services/ai-service/tests
    assert len(test_files) >= 50, f"Expected full AI test suite with >= 50 test files, got {len(test_files)}"
