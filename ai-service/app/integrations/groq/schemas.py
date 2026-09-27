"""
Pydantic response schemas for Groq Vision line analysis.
All coordinates in 0..1000 normalized space.
"""

from pydantic import BaseModel, field_validator, model_validator
from typing import List, Optional


class BboxNorm(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int

    @model_validator(mode="before")
    @classmethod
    def convert_coords(cls, data):
        if isinstance(data, dict):
            converted = dict(data)
            for k in ["x1", "y1", "x2", "y2"]:
                if k in converted:
                    val = converted[k]
                    if isinstance(val, float) and 0.0 <= val <= 1.0:
                        converted[k] = int(round(val * 1000))
                    elif isinstance(val, (int, float)):
                        converted[k] = int(round(val))
            return converted
        return data

    @model_validator(mode="after")
    def validate_bbox(self):
        for v in [self.x1, self.y1, self.x2, self.y2]:
            if not (0 <= v <= 1000):
                raise ValueError(f"bbox coordinate {v} outside 0..1000")
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError(f"bbox has zero/negative size: {self}")
        return self


class GroqLine(BaseModel):
    order: int
    text: str
    confidence: float
    candidate_ids: List[int] = []
    bbox_norm: BboxNorm
    is_short_legitimate_line: bool = False

    @field_validator("confidence")
    @classmethod
    def confidence_valid(cls, v):
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"confidence {v} not in [0, 1]")
        return v

    @field_validator("order")
    @classmethod
    def order_positive(cls, v):
        if v < 1:
            raise ValueError(f"order must be >= 1, got {v}")
        return v


class GroqLineAnalysis(BaseModel):
    analysis_version: str
    document_type: str  # "handwriting|printed|mixed|blank|unknown"
    physical_line_count: int
    lines: List[GroqLine]
    drop_candidate_ids: List[int] = []
    overall_confidence: float
    needs_second_pass: bool = False
    warnings: List[str] = []
    vision_model: Optional[str] = None
    fallback_used: bool = False
    latency_ms: int = 0
    request_id: Optional[str] = None

    @field_validator("overall_confidence")
    @classmethod
    def overall_confidence_valid(cls, v):
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"overall_confidence {v} not in [0, 1]")
        return v

    @model_validator(mode="after")
    def semantic_validate(self):
        # physical_line_count must match actual lines
        if self.physical_line_count != len(self.lines):
            raise ValueError(
                f"physical_line_count={self.physical_line_count} != len(lines)={len(self.lines)}"
            )

        # No duplicate order values
        orders = [l.order for l in self.lines]
        if len(orders) != len(set(orders)):
            raise ValueError(f"duplicate order values in lines: {orders}")

        # No duplicate candidate_id assignment across lines
        assigned: set = set()
        for line in self.lines:
            for cid in line.candidate_ids:
                if cid in assigned:
                    raise ValueError(f"candidate_id {cid} assigned to multiple lines")
                assigned.add(cid)

        return self
