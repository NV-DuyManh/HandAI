"""
Earliest-error uncertainty safety tests.

Canonical rule:
  Earliest supported error is the first mathematically invalid column/transition
  encountered in solving order after reliable preceding evidence.
  For vertical addition/subtraction: solving order is right-to-left.

Safety invariant:
  If a CRITICAL token in an earlier column (higher place value / solved first,
  i.e., units column) is uncertain, the system MUST NOT confidently report the
  tens column as the "earliest student error" even if the tens column appears
  mathematically inconsistent.

  The system must escalate to UNCERTAIN_STRUCTURE / NEEDS_CONFIRMATION
  until the earlier critical evidence is resolved.
"""
import pytest
from app.parsing.parser import StructuredParser
from app.schemas.core import ImageRecognitionResult, Token


def _make_token(tid, value, tokenClass, row, col, confidence=0.99, ambiguity=False):
    return Token(
        tokenId=tid,
        value=value,
        tokenClass=tokenClass,
        boundingBox=[0.0, 0.0, 0.1, 0.1],
        row=row,
        column=col,
        confidence=confidence,
        ambiguity=ambiguity,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Safety test: units digit uncertain → tens must NOT be reported as earliest
# ─────────────────────────────────────────────────────────────────────────────

def test_uncertain_units_prevents_tens_earliest_error():
    """
    Scenario:
      15 + 27 = ? (student writes 32, skipping carry)
      The units digit in the result is ambiguous (confidence < 0.5).
      Even though the TENS column is mathematically inconsistent,
      the system MUST NOT conclude 'tens is earliest error' — it must
      flag UNCERTAIN_STRUCTURE because the units evidence is unresolved.
    """
    # units token in result row is uncertain
    tokens = [
        _make_token("t1", "1", "digit", row=0, col=1),   # op1 tens
        _make_token("t2", "5", "digit", row=0, col=0),   # op1 units
        _make_token("t3", "+", "operator", row=1, col=2),
        _make_token("t4", "2", "digit", row=1, col=1),   # op2 tens
        _make_token("t5", "7", "digit", row=1, col=0),   # op2 units
        _make_token("t6", "3", "digit", row=2, col=1),   # result tens
        # result units is UNCERTAIN (confidence 0.4, ambiguity=True)
        _make_token("t7", "?", "digit", row=2, col=0, confidence=0.4, ambiguity=True),
    ]
    recognition = ImageRecognitionResult(tokens=tokens, status="UNCERTAIN_RECOGNITION")
    parser = StructuredParser()
    parsed = parser.parse(recognition)

    # Must be UNCERTAIN_STRUCTURE — never proceed to validation
    assert parsed.status == "UNCERTAIN_STRUCTURE", (
        f"Expected UNCERTAIN_STRUCTURE but got {parsed.status}. "
        "System must not diagnose tens error when units evidence is unresolved."
    )


def test_clear_units_allows_tens_error_detection():
    """
    Contrast scenario: when units evidence IS clear, the validator
    CAN identify the tens column as erroneous.
    15 + 27 = 32 (student forgot carry from units — units OK, tens wrong)
    """
    from app.validation.addition import VerticalAdditionValidator
    from app.schemas.core import ParsedExercise

    parsed = ParsedExercise(
        operationType="VERTICAL_ADDITION",
        operands=["15", "27"],
        result="32",
        tokens=[],
        status="VALID_STRUCTURE"
    )
    validator = VerticalAdditionValidator()
    result = validator.validate(parsed)

    assert result["is_valid"] is False
    evidence = result.get("evidence", [])
    assert len(evidence) >= 1
    # The units column is 5+7=12, student wrote 2 (correct digit, carry=1)
    # Wait — 5+7=12, student wrote 2 which IS the correct units digit
    # The error is in tens: 1+2+1(carry)=4, student wrote 3
    assert any("chục" in ev.get("placeValue", "") for ev in evidence), (
        "Expected tens ('chục') to be identified as the earliest error "
        "when units evidence is clear."
    )


def test_out_of_scope_reference_never_produces_error():
    """OUT_OF_SCOPE → no error evidence produced."""
    recognition = ImageRecognitionResult(tokens=[], status="OUT_OF_SCOPE")
    parser = StructuredParser()
    parsed = parser.parse(recognition)
    assert parsed.status == "OUT_OF_SCOPE"


def test_invalid_layout_no_confident_error():
    """INVALID_LAYOUT → parser does not force a validation error."""
    tokens = [
        _make_token("t1", "1", "digit", row=0, col=0),
        # no operator, no result row → layout invalid
    ]
    recognition = ImageRecognitionResult(tokens=tokens, status="SUCCESS")
    parser = StructuredParser()
    parsed = parser.parse(recognition)
    assert parsed.status == "INVALID_LAYOUT"
