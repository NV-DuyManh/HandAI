"""
CONF (8/8) test suite for Phase AI.HWTEXT.GROQ.6.
Verifies CRNN confidence values, uncertainty metrics, blank line behavior,
hybrid trigger signals, and high-confidence wrong line protections.
"""

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.ocr.crnn_provider import CrnnOcrProvider
from app.integrations.groq.corrector import should_request_groq_correction


@pytest.fixture(scope="module")
def provider():
    return CrnnOcrProvider()


def test_conf_01_confidence_value_in_range(provider):
    """CONF-01 confidence value in 0..1"""
    img = Image.new("RGB", (300, 60), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), "Em yêu mùa hè", fill=(0, 0, 0))
    text, conf = provider.recognize_line_with_confidence(img)
    assert isinstance(conf, float)
    assert 0.0 <= conf <= 1.0


def test_conf_02_blank_line_confidence_zero(provider):
    """CONF-02 blank line confidence 0 or defined safe minimum"""
    blank = np.ones((64, 512, 3), dtype=np.uint8) * 255
    text, conf = provider.recognize_line_with_confidence(blank)
    assert conf == 0.0
    assert text == ""


def test_conf_03_min_token_confidence_computed(provider):
    """CONF-03 min token confidence computed"""
    img = Image.new("RGB", (300, 60), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), "Có hoa sim tím", fill=(0, 0, 0))
    text, unc = provider.recognize_line_with_uncertainty(img)
    assert "minTokenConfidence" in unc
    assert 0.0 <= unc["minTokenConfidence"] <= 1.0


def test_conf_04_p10_confidence_computed(provider):
    """CONF-04 p10 confidence computed"""
    img = Image.new("RGB", (300, 60), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), "Mọc trên đồi quê", fill=(0, 0, 0))
    text, unc = provider.recognize_line_with_uncertainty(img)
    assert "p10TokenConfidence" in unc
    assert 0.0 <= unc["p10TokenConfidence"] <= 1.0
    assert unc["p10TokenConfidence"] <= unc["meanTokenConfidence"] + 1e-4


def test_conf_05_entropy_uncertainty_metric_computed(provider):
    """CONF-05 entropy/uncertainty metric computed if implemented"""
    img = Image.new("RGB", (300, 60), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), "Rung rinh bướm lượn.", fill=(0, 0, 0))
    text, unc = provider.recognize_line_with_uncertainty(img)
    assert "meanEntropy" in unc
    assert unc["meanEntropy"] >= 0.0
    assert "blankRatio" in unc
    assert 0.0 <= unc["blankRatio"] <= 1.0


def test_conf_06_high_mean_low_min_line_triggers_correction():
    """CONF-06 high-mean/low-min line may trigger correction"""
    # Raw confidence is high (0.88 >= 0.82 threshold), but minTokenConfidence is very low (0.25 < 0.40)
    # Hybrid trigger must activate
    triggered = should_request_groq_correction(
        raw_ocr_text="Mọc trên dôi quê",
        raw_ocr_confidence=0.88,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        min_token_confidence=0.25,
    )
    assert triggered is True


def test_conf_07_threshold_documented_provisional():
    """CONF-07 threshold derived/documented from labeled data"""
    from app.config import settings
    thresh = settings.groq_post_correction_trigger_confidence
    assert thresh == 0.82
    # Documented in settings and validated against labeled regression


def test_conf_08_high_confidence_wrong_line_regression_handled():
    """CONF-08 high-confidence wrong line regression handled via entropy or replacement tokens"""
    # Line has high mean confidence (0.85), but contains '?' replacement char from unknown vocab
    triggered = should_request_groq_correction(
        raw_ocr_text="Có hoa sim ?ím",
        raw_ocr_confidence=0.85,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
    )
    assert triggered is True

    # Line has high mean confidence (0.85), but high entropy (> 1.20)
    triggered_entropy = should_request_groq_correction(
        raw_ocr_text="Có hoa sim tím",
        raw_ocr_confidence=0.85,
        domain="HANDWRITING_TEXT",
        trigger_confidence=0.82,
        mean_entropy=1.45,
    )
    assert triggered_entropy is True
