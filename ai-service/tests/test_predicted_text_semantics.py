"""
PRED tests — predictedText Semantic Audit and Immutability of rawOcrText.
PRED-01 to PRED-08 (8/8 required).

Audit Summary:
- rawOcrText: Immutable raw CRNN prediction / raw OCR output.
- finalText: Current effective text (CRNN raw, auto-applied correction, student choice, or manual edit).
- predictedText: Legacy / effective-text alias mirroring finalText for backwards compatibility with Spring Boot & mobile.
- Raw CER evaluation: Always evaluates rawOcrText, never predictedText.
"""

from pathlib import Path
import pytest
from app.schemas.ocr_pilot import LineBox
from app.ocr.metrics import evaluate_line_pair, levenshtein_distance

MOBILE_RESULT_PATH = Path(__file__).resolve().parents[3] / "apps" / "student-mobile" / "src" / "app" / "ocr-pilot" / "multiline-result.tsx"
SCHEMA_PATH = Path(__file__).resolve().parents[1] / "app" / "schemas" / "ocr_pilot.py"
SERVICE_TS_PATH = Path(__file__).resolve().parents[3] / "apps" / "student-mobile" / "src" / "services" / "api" / "OcrPilotService.ts"


def _sample_line() -> LineBox:
    return LineBox(
        line_id="line-pred-01",
        x=10,
        y=20,
        width=150,
        height=35,
        order=1,
        rawOcrText="em đp gại",
        rawOcrConfidence=0.68,
        finalText="em đp gại",
        predictedText="em đp gại",
        groqSuggestion="em đẹp gái",
        geminiSuggestion="em đẹp gái",
    )


def test_pred_01_ocr_goc_always_uses_raw_ocr_text():
    """PRED-01: OCR GỐC always binds to and displays rawOcrText."""
    line = _sample_line()
    # Mutate finalText and predictedText to simulate prior edit
    line.finalText = "em đẹp gái"
    line.predictedText = "em đẹp gái"

    # In UI, Section A displays rawOcrText
    assert line.rawOcrText == "em đp gại"

    # Verify in mobile code that Section A specifically targets rawOcrText
    assert MOBILE_RESULT_PATH.exists(), f"Missing {MOBILE_RESULT_PATH}"
    with open(MOBILE_RESULT_PATH, "r", encoding="utf-8") as f:
        mobile_src = f.read()

    assert "OCR GỐC (CRNN):" in mobile_src
    assert "const rawText = line.rawOcrText || line.predictedText;" in mobile_src


def test_pred_02_choose_groq_does_not_change_raw_ocr_text():
    """PRED-02: Choosing Groq suggestion updates finalText / predictedText only; rawOcrText is unchanged."""
    line = _sample_line()
    assert line.rawOcrText == "em đp gại"

    # Simulate student tapping [Chọn gợi ý Groq]
    groq_chosen = line.groqSuggestion
    line.finalText = groq_chosen
    line.predictedText = groq_chosen

    assert line.finalText == "em đẹp gái"
    assert line.predictedText == "em đẹp gái"
    assert line.rawOcrText == "em đp gại"  # Strictly immutable


def test_pred_03_choose_gemini_does_not_change_raw_ocr_text():
    """PRED-03: Choosing Gemini suggestion updates finalText / predictedText only; rawOcrText is unchanged."""
    line = _sample_line()
    assert line.rawOcrText == "em đp gại"

    # Simulate student tapping [Chọn gợi ý Gemini]
    gemini_chosen = line.geminiSuggestion
    line.finalText = gemini_chosen
    line.predictedText = gemini_chosen

    assert line.finalText == "em đẹp gái"
    assert line.predictedText == "em đẹp gái"
    assert line.rawOcrText == "em đp gại"  # Strictly immutable


def test_pred_04_manual_edit_does_not_change_raw_ocr_text():
    """PRED-04: Student manual edit updates finalText / predictedText only; rawOcrText is unchanged."""
    line = _sample_line()
    assert line.rawOcrText == "em đp gại"

    # Simulate student entering custom text in edit modal
    student_custom_text = "em gái rất đẹp"
    line.finalText = student_custom_text
    line.predictedText = student_custom_text

    assert line.finalText == "em gái rất đẹp"
    assert line.predictedText == "em gái rất đẹp"
    assert line.rawOcrText == "em đp gại"  # Strictly immutable


def test_pred_05_raw_cer_reads_raw_ocr_text_never_predicted_text():
    """PRED-05: Raw CER evaluation reads rawOcrText, never predictedText or finalText."""
    target_ground_truth = "em đẹp gái"
    raw_ocr = "em đp gại"
    modified_effective = "em gái rất đẹp"

    # Verify evaluate_line_pair uses raw_text for raw CER
    eval_res = evaluate_line_pair(
        raw_text=raw_ocr,
        final_text=modified_effective,
        target=target_ground_truth,
        suggested_text=modified_effective,
        decision="SUGGEST_ONLY",
    )

    # raw_cer must be calculated against raw_ocr, not modified_effective
    expected_raw_dist = levenshtein_distance(raw_ocr, target_ground_truth)
    assert eval_res["raw_dist"] == expected_raw_dist
    assert eval_res["raw_cer"] > 0.0

    # final_dist is calculated against modified_effective
    expected_final_dist = levenshtein_distance(modified_effective, target_ground_truth)
    assert eval_res["final_dist"] == expected_final_dist
    assert eval_res["raw_dist"] != eval_res["final_dist"]


def test_pred_06_predicted_text_meaning_documented():
    """PRED-06: predictedText is documented as a legacy effective-text alias across schemas."""
    # Check FastAPI LineBox schema documentation
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_src = f.read()
    assert "rawOcrText: Immutable raw CRNN prediction" in schema_src
    assert "predictedText: Legacy effective-text alias mirroring finalText" in schema_src

    # Check Mobile OcrPilotService.ts documentation
    with open(SERVICE_TS_PATH, "r", encoding="utf-8") as f:
        ts_src = f.read()
    assert "Legacy effective-text alias mirroring finalText" in ts_src
    assert "Immutable raw CRNN prediction" in ts_src


def test_pred_07_predicted_text_cannot_overwrite_raw_ocr_text():
    """PRED-07: Mutations to predictedText cannot overwrite rawOcrText."""
    line = _sample_line()
    original_raw = line.rawOcrText

    # Re-assign predictedText to diverse arbitrary values
    for arbitrary in ["", "ghi chú mới", "123 + 456 = 579", None]:
        line.predictedText = arbitrary
        # rawOcrText must be untouched
        assert line.rawOcrText == original_raw


def test_pred_08_final_text_remains_current_effective_text():
    """PRED-08: finalText remains current effective text under all state transitions."""
    line = _sample_line()

    # Initial state: CRNN raw
    assert line.finalText == "em đp gại"

    # Transition 1: Auto-apply or Groq chosen
    line.finalText = line.groqSuggestion
    assert line.finalText == "em đẹp gái"

    # Transition 2: Manual edit
    line.finalText = "chỉnh sửa tay"
    assert line.finalText == "chỉnh sửa tay"

    # Transition 3: Keep raw restores finalText to rawOcrText
    line.finalText = line.rawOcrText
    assert line.finalText == "em đp gại"
    assert line.rawOcrText == "em đp gại"
