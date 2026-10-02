"""
Pydantic schemas for Gemini OCR post-correction structured output and advisor contracts.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class GeminiSpanChange(BaseModel):
    raw_span: str
    suggested_span: str
    reason: str
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, allow_inf_nan=False)


class GeminiOcrCorrectionResponse(BaseModel):
    provider: str = "GEMINI"
    raw_text: str
    suggested_text: str
    correction_needed: bool = True
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, allow_inf_nan=False)
    visual_support: str = "STRONG"  # "STRONG" | "MODERATE" | "WEAK"
    changes: List[GeminiSpanChange] = []
    alternative_suggestions: List[str] = Field(default_factory=list, description="Optional secondary candidates")
    uncertain: bool = False

    @field_validator("visual_support", mode="before")
    @classmethod
    def validate_visual_support(cls, v) -> str:
        if isinstance(v, bool):
            return "STRONG" if v else "WEAK"
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if v_upper in ("STRONG", "MODERATE", "WEAK"):
                return v_upper
            return "STRONG"
        return "STRONG"


class AdvisorSuggestion(BaseModel):
    provider: str  # "GROQ" | "GEMINI"
    text: str
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, allow_inf_nan=False)
    confidenceSource: Optional[str] = None
    visualSupport: str = "STRONG"
    decision: str = "SUGGEST_ONLY"  # "AUTO_APPLY" | "SUGGEST_ONLY" | "KEEP_RAW"
    status: str = "SUCCESS"  # "SUCCESS" | "UNAVAILABLE" | "SKIPPED"
