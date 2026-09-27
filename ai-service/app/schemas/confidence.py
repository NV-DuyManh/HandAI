"""Canonical confidence bundle: recognition / structure / diagnosis."""
from pydantic import BaseModel, Field


class ConfidenceBundle(BaseModel):
    """
    Canonical system-certainty values, NOT student performance scores.

    - recognition:  confidence in the OCR/layout recognition layer output.
    - structure:    confidence that the parsed exercise has a valid structure.
    - diagnosis:    confidence in the deterministic validation/diagnosis result.

    All values are in [0.0, 1.0].
    """
    recognition: float = Field(..., ge=0.0, le=1.0)
    structure: float = Field(..., ge=0.0, le=1.0)
    diagnosis: float = Field(..., ge=0.0, le=1.0)
