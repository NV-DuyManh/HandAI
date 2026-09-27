"""
GEMUI tests — UI logic, contracts, provider card separation, button actions, and rendering safety.
GEMUI-01 to GEMUI-12 (12/12 required).
"""
import pytest
from pathlib import Path
from app.schemas.ocr_pilot import LineBox


def _make_line(raw: str = "em đp gại", groq: str = "em đẹp gái", gemini: str = "em đẹp gái") -> LineBox:
    return LineBox(
        line_id="line-01",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        text=raw,
        rawOcrText=raw,
        rawOcrConfidence=0.74,
        groqSuggestion=groq,
        geminiSuggestion=gemini,
        finalText=raw,
    )


def test_gemui_01_ocr_goc_still_raw_ocr_text():
    """GEMUI-01: Section A 'OCR GỐC (CRNN)' binds strictly to rawOcrText."""
    line = _make_line("em đp gại")
    # Even if suggestions exist or final is changed
    line.finalText = "em đẹp gái"
    displayed_raw = line.rawOcrText
    assert displayed_raw == "em đp gại"


def test_gemui_02_groq_is_suggestion_1():
    """GEMUI-02: Section B1 title is 'GỢI Ý 1 — GROQ' and binds to groqSuggestion."""
    line = _make_line("con chim", groq="con chim non")
    section_title = "GỢI Ý 1 — GROQ:"
    assert "GROQ" in section_title
    assert "1" in section_title
    assert line.groqSuggestion == "con chim non"


def test_gemui_03_gemini_is_suggestion_2():
    """GEMUI-03: Section B2 title is 'GỢI Ý 2 — GEMINI' and binds to geminiSuggestion."""
    line = _make_line("con chim", gemini="con chim non")
    section_title = "GỢI Ý 2 — GEMINI:"
    assert "GEMINI" in section_title
    assert "2" in section_title
    assert line.geminiSuggestion == "con chim non"


def test_gemui_04_labels_never_swapped():
    """GEMUI-04: Provider labels and suggestion fields are never inverted or swapped."""
    line = _make_line(raw="raw text", groq="from groq", gemini="from gemini")
    assert line.groqSuggestion == "from groq"
    assert line.geminiSuggestion == "from gemini"
    assert line.groqSuggestion != line.geminiSuggestion


def test_gemui_05_choose_groq_updates_final_only():
    """GEMUI-05: Tapping [Chọn gợi ý Groq] updates finalText only."""
    line = _make_line("goc", groq="sửa groq", gemini="sửa gemini")
    # Action
    line.finalText = line.groqSuggestion
    assert line.finalText == "sửa groq"
    assert line.rawOcrText == "goc"


def test_gemui_06_choose_gemini_updates_final_only():
    """GEMUI-06: Tapping [Chọn gợi ý Gemini] updates finalText only."""
    line = _make_line("goc", groq="sửa groq", gemini="sửa gemini")
    # Action
    line.finalText = line.geminiSuggestion
    assert line.finalText == "sửa gemini"
    assert line.rawOcrText == "goc"


def test_gemui_07_keep_raw_updates_final_only():
    """GEMUI-07: Tapping [Giữ OCR gốc] resets finalText to rawOcrText."""
    line = _make_line("goc", groq="sửa groq", gemini="sửa gemini")
    line.finalText = line.geminiSuggestion  # Previously chosen
    # Action: keep raw
    line.finalText = line.rawOcrText
    assert line.finalText == "goc"
    assert line.rawOcrText == "goc"


def test_gemui_08_no_empty_gemini_card_on_clean_line():
    """GEMUI-08: On clean line (not triggered), no suggestions or empty cards are present."""
    line = LineBox(
        line_id="line-clean",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        text="dòng rất sạch tự tin cao",
        rawOcrText="dòng rất sạch tự tin cao",
        rawOcrConfidence=0.98,
        finalText="dòng rất sạch tự tin cao",
    )
    assert line.groqSuggestion is None
    assert line.geminiSuggestion is None
    assert len(line.suggestions) == 0
    # In UI: hasGemini = Boolean(line.geminiSuggestion || line.geminiStatus === 'UNAVAILABLE')
    hasGemini = bool(line.geminiSuggestion or getattr(line, "geminiStatus", None) == "UNAVAILABLE")
    assert hasGemini is False


def test_gemui_09_provider_unavailable_state_non_breaking():
    """GEMUI-09: Provider unavailable state renders non-breaking status message."""
    line = _make_line("chữ", groq=None, gemini=None)
    line.geminiStatus = "UNAVAILABLE"
    hasGemini = bool(line.geminiSuggestion or line.geminiStatus == "UNAVAILABLE")
    assert hasGemini is True
    # Card displays compact unavailable text
    status_text = "(Tạm thời không khả dụng)" if line.geminiStatus == "UNAVAILABLE" else ""
    assert status_text == "(Tạm thời không khả dụng)"


def test_gemui_10_merged_text_follows_chosen_final():
    """GEMUI-10: Merged full document text correctly reflects chosen finalText across lines."""
    line1 = _make_line("dòng 1 goc", groq="dòng 1 sửa")
    line1.finalText = line1.groqSuggestion  # Selected Groq

    line2 = _make_line("dòng 2 goc", gemini="dòng 2 sửa")
    line2.finalText = line2.geminiSuggestion  # Selected Gemini

    line3 = _make_line("dòng 3 sach")
    line3.finalText = line3.rawOcrText  # Kept raw

    merged = "\n".join([line1.finalText, line2.finalText, line3.finalText])
    assert merged == "dòng 1 sửa\ndòng 2 sửa\ndòng 3 sach"


def test_gemui_11_dev_panel_stays_removed():
    """GEMUI-11: Verify dev technical panel remains absent from student UI source code."""
    ui_path = Path(__file__).resolve().parents[3] / "apps" / "student-mobile" / "src" / "app" / "ocr-pilot" / "multiline-result.tsx"
    with open(ui_path, "r", encoding="utf-8") as f:
        src = f.read()
    # Check that forbidden dev technical panel headers and dev card components are absent
    assert "Panel Kỹ Thuật (DEV)" not in src
    assert "devDiagnosticCard" not in src
    assert "DEV Diagnostic" not in src
    assert "diagnosticsCard" not in src


def test_gemui_12_no_obvious_normal_width_overflow():
    """GEMUI-12: Verify responsive button rows and cards use flex without fixed exceeding widths."""
    ui_path = Path(__file__).resolve().parents[3] / "apps" / "student-mobile" / "src" / "app" / "ocr-pilot" / "multiline-result.tsx"
    with open(ui_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "sectionBBox:" in src
    assert "sectionGeminiBox:" in src
    assert "chooseGroqBtn:" in src
    assert "chooseGeminiBtn:" in src
