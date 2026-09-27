from app.validation.addition import VerticalAdditionValidator
from app.validation.subtraction import VerticalSubtractionValidator
from app.schemas.core import ParsedExercise, Token

def test_addition_valid():
    validator = VerticalAdditionValidator()
    parsed = ParsedExercise(
        operationType="VERTICAL_ADDITION",
        operands=["15", "27"],
        result="42",
        tokens=[],
        status="VALID_STRUCTURE"
    )
    res = validator.validate(parsed)
    assert res["is_valid"] is True
    assert len(res["evidence"]) == 0

def test_addition_invalid_carry():
    validator = VerticalAdditionValidator()
    parsed = ParsedExercise(
        operationType="VERTICAL_ADDITION",
        operands=["15", "27"],
        result="32", # student forgot to carry
        tokens=[],
        status="VALID_STRUCTURE"
    )
    res = validator.validate(parsed)
    assert res["is_valid"] is False
    assert len(res["evidence"]) == 1
    assert res["evidence"][0]["placeValue"] == "Hàng chục" # 1 + 2 + 1 (carry) != 3

def test_subtraction_valid():
    validator = VerticalSubtractionValidator()
    parsed = ParsedExercise(
        operationType="VERTICAL_SUBTRACTION",
        operands=["52", "18"],
        result="34",
        tokens=[],
        status="VALID_STRUCTURE"
    )
    res = validator.validate(parsed)
    assert res["is_valid"] is True

def test_subtraction_invalid_borrow():
    validator = VerticalSubtractionValidator()
    parsed = ParsedExercise(
        operationType="VERTICAL_SUBTRACTION",
        operands=["52", "18"],
        result="44", # student subtracted smaller from larger or forgot borrow effect
        tokens=[],
        status="VALID_STRUCTURE"
    )
    res = validator.validate(parsed)
    assert res["is_valid"] is False
    assert res["evidence"][0]["placeValue"] == "Hàng chục" # 5 - 1 - 1 (borrow) != 4
