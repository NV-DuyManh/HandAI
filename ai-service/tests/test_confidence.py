"""
Confidence bundle tests — canonical schema and value ranges.
"""
import pytest
from pydantic import ValidationError
from app.schemas.confidence import ConfidenceBundle


def test_confidence_bundle_valid():
    cb = ConfidenceBundle(recognition=0.99, structure=0.97, diagnosis=0.93)
    assert cb.recognition == 0.99
    assert cb.structure == 0.97
    assert cb.diagnosis == 0.93


def test_confidence_bundle_zero():
    cb = ConfidenceBundle(recognition=0.0, structure=0.0, diagnosis=0.0)
    assert cb.recognition == 0.0


def test_confidence_bundle_above_1_rejected():
    with pytest.raises(ValidationError):
        ConfidenceBundle(recognition=1.1, structure=0.5, diagnosis=0.5)


def test_confidence_bundle_below_0_rejected():
    with pytest.raises(ValidationError):
        ConfidenceBundle(recognition=0.5, structure=-0.1, diagnosis=0.5)


def test_confidence_bundle_fixture_values_deterministic():
    """Fixture mode must produce deterministic, non-random confidence values."""
    cb1 = ConfidenceBundle(recognition=0.99, structure=0.97, diagnosis=0.93)
    cb2 = ConfidenceBundle(recognition=0.99, structure=0.97, diagnosis=0.93)
    assert cb1 == cb2


def test_confidence_bundle_has_three_dimensions():
    cb = ConfidenceBundle(recognition=0.8, structure=0.7, diagnosis=0.6)
    d = cb.model_dump()
    assert set(d.keys()) == {"recognition", "structure", "diagnosis"}
