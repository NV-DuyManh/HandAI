"""
SCHEMA tests — Pydantic GroqLineAnalysis validation.
8/8 required.
"""
import pytest
from app.integrations.groq.schemas import GroqLineAnalysis, GroqLine, BboxNorm


def valid_analysis(**overrides):
    base = {
        "analysis_version": "groq-line-v2",
        "document_type": "handwriting",
        "physical_line_count": 2,
        "lines": [
            {"order": 1, "text": "Line one", "confidence": 0.9,
             "candidate_ids": [1], "bbox_norm": {"x1": 0, "y1": 0, "x2": 500, "y2": 250},
             "is_short_legitimate_line": False},
            {"order": 2, "text": "Line two", "confidence": 0.85,
             "candidate_ids": [2], "bbox_norm": {"x1": 0, "y1": 260, "x2": 500, "y2": 500},
             "is_short_legitimate_line": False},
        ],
        "drop_candidate_ids": [],
        "overall_confidence": 0.88,
        "needs_second_pass": False,
        "warnings": [],
    }
    base.update(overrides)
    return base


def test_schema_01_valid_response():
    """SCHEMA-01: valid analysis parses correctly"""
    a = GroqLineAnalysis.model_validate(valid_analysis())
    assert a.physical_line_count == 2
    assert len(a.lines) == 2


def test_schema_02_bad_bbox_rejected():
    """SCHEMA-02: bbox outside 0..1000 is rejected"""
    data = valid_analysis()
    data["lines"][0]["bbox_norm"]["x2"] = 1500  # out of range
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate(data)


def test_schema_03_bad_confidence_rejected():
    """SCHEMA-03: confidence > 1.0 is rejected"""
    data = valid_analysis()
    data["overall_confidence"] = 1.5
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate(data)


def test_schema_04_duplicate_order_rejected():
    """SCHEMA-04: duplicate order values rejected"""
    data = valid_analysis()
    data["lines"][1]["order"] = 1  # duplicate
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate(data)


def test_schema_05_duplicate_candidate_assignment_rejected():
    """SCHEMA-05: same candidate ID in two lines rejected"""
    data = valid_analysis()
    data["lines"][0]["candidate_ids"] = [1, 2]
    data["lines"][1]["candidate_ids"] = [2, 3]  # 2 appears twice
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate(data)


def test_schema_06_invalid_candidate_id_type():
    """SCHEMA-06: non-integer candidate_id causes validation error"""
    data = valid_analysis()
    data["lines"][0]["candidate_ids"] = ["not_an_int"]
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate(data)


def test_schema_07_malformed_json_fallback():
    """SCHEMA-07: malformed JSON dict raises validation error (client catches it)"""
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate({"garbage": True})


def test_schema_08_zero_bbox_dimension_rejected():
    """SCHEMA-08: bbox with x2 <= x1 is rejected"""
    data = valid_analysis()
    data["lines"][0]["bbox_norm"] = {"x1": 500, "y1": 0, "x2": 100, "y2": 250}
    with pytest.raises(Exception):
        GroqLineAnalysis.model_validate(data)
