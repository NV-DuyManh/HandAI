"""Offline regressions: numeric confidence must have an actual model/provider source."""
import base64
import importlib
import io
from unittest.mock import AsyncMock

import numpy as np
import pytest
import torch
from PIL import Image
from pydantic import ValidationError

from app.api.ocr import advise_lines_endpoint
from app.config import settings
from app.integrations.gemini.corrector import evaluate_gemini_safety
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse, GeminiSpanChange
from app.integrations.groq.corrector import GroqOcrCorrectionResponse, SpanChange, evaluate_correction_safety
from app.ocr.crnn_provider import CrnnOcrProvider


def test_crnn_confidence_is_derived_from_real_logits():
    provider = object.__new__(CrnnOcrProvider)
    provider._inv_vocab = {1: "a", 2: "b"}
    probabilities = torch.tensor([[[0.1, 0.8, 0.1], [0.05, 0.9, 0.05],
                                   [0.8, 0.1, 0.1], [0.2, 0.2, 0.6]]])
    text, metrics = provider._decode_logits_with_uncertainty(probabilities.log())[0]
    assert text == "ab"
    assert metrics["rawCrnnConfidence"] == pytest.approx(0.75)
    assert metrics["minTokenConfidence"] == pytest.approx(0.6)
    assert metrics["p10TokenConfidence"] == pytest.approx(0.63)
    assert metrics["rawOcrConfidenceSource"] == "CRNN_CTC_SOFTMAX"
    assert [char["prob"] for char in metrics["charVisualEvidence"]] == [0.9, 0.6]
    weaker = probabilities.clone()
    weaker[0, 3] = torch.tensor([0.275, 0.275, 0.45])
    weaker_text, weaker_metrics = provider._decode_logits_with_uncertainty(weaker.log())[0]
    assert weaker_text == text
    assert weaker_metrics["rawCrnnConfidence"] < metrics["rawCrnnConfidence"]


@pytest.mark.parametrize("schema", [GroqOcrCorrectionResponse, GeminiOcrCorrectionResponse])
def test_missing_provider_confidence_remains_unknown(schema):
    response = schema(raw_text="Cm yêu mùa hè", suggested_text="Em yêu mùa hè")
    assert response.confidence is None
    assert schema(raw_text="x", suggested_text="x", confidence=0.0).confidence == 0.0


@pytest.mark.parametrize("schema", [SpanChange, GeminiSpanChange])
def test_missing_span_confidence_remains_unknown(schema):
    assert schema(raw_span="Cm", suggested_span="Em", reason="letter").confidence is None


@pytest.mark.parametrize("schema", [GroqOcrCorrectionResponse, GeminiOcrCorrectionResponse])
@pytest.mark.parametrize("value", [1.5, -0.1, float("nan"), float("inf"), "invalid"])
def test_invalid_provider_score_cannot_become_high_confidence(schema, value):
    with pytest.raises(ValidationError):
        schema(raw_text="a", suggested_text="b", confidence=value)


def test_missing_provider_score_cannot_auto_apply():
    assert evaluate_correction_safety("Cm", "Em", None)[0] == "KEEP_RAW"
    assert evaluate_gemini_safety("Cm", "Em", None)[0] == "KEEP_RAW"


class _Request:
    def __init__(self, body):
        self.body = body

    async def json(self):
        return self.body


def _line(**extra):
    return {"x": 0, "y": 0, "width": 50, "height": 30,
            "rawOcrText": "Cm yêu mùa hè", "rawOcrConfidence": 0.0,
            "rawOcrConfidenceSource": "CRNN_CTC_SOFTMAX", **extra}


def _image_base64():
    buffer = io.BytesIO()
    Image.new("RGB", (50, 30), color=(12, 34, 56)).save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


@pytest.mark.asyncio
@pytest.mark.parametrize("enabled", [True, False])
async def test_advisor_without_image_never_fakes_provider_success(monkeypatch, enabled):
    monkeypatch.setattr(settings, "groq_enabled", enabled)
    monkeypatch.setattr(settings, "gemini_enabled", enabled)
    for provider in ("groq", "gemini"):
        module = importlib.import_module(f"app.integrations.{provider}.document_corrector")
        mock = AsyncMock()
        monkeypatch.setattr(module, f"request_{provider}_document_correction", mock)
    result = await advise_lines_endpoint(_Request({"lines": [_line()]}))
    line = result["lines"][0]
    for provider in ("groq", "gemini"):
        assert line[f"{provider}Status"] == ("UNAVAILABLE" if enabled else "DISABLED")
        assert line[f"{provider}Confidence"] is None
        assert line[f"{provider}ConfidenceSource"] is None
        assert line[f"{provider}Suggestion"] is None
        module = importlib.import_module(f"app.integrations.{provider}.document_corrector")
        getattr(module, f"request_{provider}_document_correction").assert_not_called()
    assert line["finalText"] == "Cm yêu mùa hè"
    assert line["correctionApplied"] is False


@pytest.mark.asyncio
async def test_actual_advisor_image_and_score_are_preserved_without_fallback(monkeypatch):
    monkeypatch.setattr(settings, "groq_enabled", True)
    monkeypatch.setattr(settings, "gemini_enabled", True)
    groq_module = importlib.import_module("app.integrations.groq.document_corrector")
    gemini_module = importlib.import_module("app.integrations.gemini.document_corrector")
    groq = AsyncMock(return_value=[{"corrected_text": "Em yêu mùa hè", "confidence": 0.0,
                                   "decision": "SUGGEST_ONLY", "status": "SUCCESS", "model": "actual"}])
    gemini = AsyncMock(side_effect=RuntimeError("offline provider failure"))
    monkeypatch.setattr(groq_module, "request_groq_document_correction", groq)
    monkeypatch.setattr(gemini_module, "request_gemini_document_correction", gemini)
    result = await advise_lines_endpoint(_Request({"lines": [_line()], "imageBase64": _image_base64()}))
    image = groq.call_args.args[1]
    assert image.shape == (30, 50, 3)
    assert image[0, 0].tolist() == [56, 34, 12]
    line = result["lines"][0]
    assert line["rawOcrConfidence"] == 0.0
    assert line["groqConfidence"] == 0.0
    assert line["groqConfidenceSource"] == "AI_SELF_REPORTED"
    assert line["suggestions"][0]["confidenceSource"] == "AI_SELF_REPORTED"
    assert line["geminiStatus"] == "UNAVAILABLE"
    assert line["geminiConfidence"] is None
    assert line["geminiSuggestion"] is None
    assert line["finalText"] == "Cm yêu mùa hè"


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["groq", "gemini"])
async def test_document_advisor_needs_real_image_and_never_borrows_ocr_score(monkeypatch, provider):
    module = importlib.import_module(f"app.integrations.{provider}.document_corrector")
    request = getattr(module, f"request_{provider}_document_correction")
    transport = AsyncMock(return_value=None)
    monkeypatch.setattr(module, f"request_document_{provider}_correction", transport)
    lines = [_line(), _line(rawOcrConfidence=None)]
    result = await request(lines)
    transport.assert_not_called()
    assert all(line["confidence"] is None and line["status"] == "UNAVAILABLE" for line in result)
    await request(lines, np.zeros((30, 50, 3), dtype=np.uint8))
    triggered = transport.call_args.args[1]
    assert triggered["0"]["confidence"] == 0.0
    assert triggered["1"]["confidence"] is None
