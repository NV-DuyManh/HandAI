"""
AI.HWTEXT.PROD.3B: Suggestion Rendering, Deduplication & Student-Facing Cleanup.
Tests PROD3B-01 through PROD3B-15 covering the full 10-case matrix and UX rules.
"""
import os
import subprocess
import pytest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MOBILE_ROOT = REPO_ROOT / "apps" / "student-mobile"
RESULT_PATH = MOBILE_ROOT / "src" / "app" / "ocr-pilot" / "multiline-result.tsx"
DEDUPE_PATH = MOBILE_ROOT / "src" / "utils" / "suggestionDedupe.ts"
NODE_TEST_PATH = MOBILE_ROOT / "src" / "utils" / "__tests__" / "suggestionDedupe.test.mjs"


def _read_result_file() -> str:
    with open(RESULT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _read_dedupe_file() -> str:
    with open(DEDUPE_PATH, "r", encoding="utf-8") as f:
        return f.read()


def test_prod3b_01_all_10_matrix_cases_pass_in_node():
    """PROD3B-01: Run node test suite covering all mandatory matrix cases."""
    assert NODE_TEST_PATH.exists(), f"Node test file not found at {NODE_TEST_PATH}"
    cmd = ["node", "--experimental-strip-types", str(NODE_TEST_PATH)]
    res = subprocess.run(cmd, cwd=str(MOBILE_ROOT), capture_output=True, text=True, encoding="utf-8")
    assert res.returncode == 0, f"Node test failed with code {res.returncode}:\n{res.stderr}\n{res.stdout}"
    assert "CASES PASSED SUCCESSFULLY" in res.stdout


def test_prod3b_02_helper_exports_present():
    """PROD3B-02: normalizeForComparison and buildVisibleSuggestions exported in both files."""
    res_src = _read_result_file()
    dedupe_src = _read_dedupe_file()

    assert "export function normalizeForComparison" in dedupe_src
    assert "export function buildVisibleSuggestions" in dedupe_src
    assert "buildVisibleSuggestions" in res_src
    assert "normalizeForComparison" in res_src


def test_prod3b_03_no_visible_provider_names_in_cards():
    """PROD3B-03: Provider names Groq/Gemini NOT shown in suggestion card text or chips."""
    res_src = _read_result_file()
    # Provider badges must not be rendered as student-facing text in cards
    assert "<Text style={styles.providerChipGroqText}>Groq</Text>" not in res_src
    assert "<Text style={styles.providerChipGeminiText}>Gemini</Text>" not in res_src
    assert "<Text style={styles.providerChipCrnnText}>CRNN</Text>" not in res_src


def test_prod3b_04_no_ugly_failure_copy():
    """PROD3B-04: No ugly technical or rate-limit failure copy in student UI."""
    res_src = _read_result_file()
    assert "Gemini tạm thời chưa khả dụng" not in res_src
    assert "Groq tạm thời chưa khả dụng" not in res_src
    assert "Rate limit" not in res_src
    assert "Provider unavailable" not in res_src
    assert "HTTP 429" not in res_src
    assert "HTTP 503" not in res_src


def test_prod3b_05_compact_neutral_empty_state_present():
    """PROD3B-05 / PROD3F-05: Old negative copy eliminated; AI confirmed / outage row present."""
    res_src = _read_result_file()
    # PROD.3F requirement: Eliminate old copy "AI chưa có đề xuất khác cho dòng này."
    assert "AI chưa có đề xuất khác cho dòng này." not in res_src
    assert "AI xác nhận nội dung chính xác ✓" in res_src
    assert "aiConfirmedRow" in res_src


def test_prod3b_06_student_labels_only_goi_y_1_and_2():
    """PROD3B-06: Student labels are strictly 'Gợi ý 1' and 'Gợi ý 2'."""
    res_src = _read_result_file()
    assert "Gợi ý 1" in res_src
    assert "Gợi ý 2" in res_src
    assert "Dùng gợi ý 1" in res_src
    assert "Dùng gợi ý 2" in res_src


def test_prod3b_07_accessibility_labels_present():
    """PROD3B-07: Accessibility labels match 'Chọn gợi ý 1' and 'Chọn gợi ý 2'."""
    res_src = _read_result_file()
    assert 'accessibilityLabel="Chọn gợi ý 1"' in res_src
    assert 'accessibilityLabel="Chọn gợi ý 2"' in res_src


def test_prod3b_08_revert_action_present():
    """PROD3B-08: Clean revert action 'Quay về OCR gốc' and 'Giữ OCR gốc' available."""
    res_src = _read_result_file()
    assert "Quay về OCR gốc" in res_src
    assert "Giữ OCR gốc" in res_src
    assert 'accessibilityLabel="Quay về OCR gốc"' in res_src
    assert 'accessibilityLabel="Giữ OCR gốc"' in res_src


def test_prod3b_09_manual_edit_highest_priority():
    """PROD3B-09: 'Tự sửa' opens inline editing form and user edit overrides all."""
    res_src = _read_result_file()
    assert "Tự sửa" in res_src
    assert "Lưu & Xác nhận" in res_src
    assert "Hủy" in res_src


def test_prod3b_10_raw_ocr_text_immutable():
    """PROD3B-10: rawOcrText is immutable and never modified by suggestions or feedback."""
    res_src = _read_result_file()
    assert "rawOcrText: targetText" not in res_src
    assert "finalText: targetText" in res_src


def test_prod3b_11_case_1_dedupe_logic():
    """Case 1 / PROD.3F.1 Case C: RAW == AI_A -> distinct=0, PROD.3F.1 confirmed card labeled 'Gợi ý 1'."""
    # Test via node invocation
    script = (
        "import { buildVisibleSuggestions } from './src/utils/suggestionDedupe.ts';"
        "const distinct = buildVisibleSuggestions({ rawOcrText: 'Em yêu mùa hè', groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS' }, { includeConfirmedCard: false });"
        "const confirmed = buildVisibleSuggestions({ rawOcrText: 'Em yêu mùa hè', groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS' });"
        "process.exit(distinct.length === 0 && confirmed.length === 1 && confirmed[0].label === 'Gợi ý 1' && confirmed[0].isAiConfirmed === true ? 0 : 1);"
    )
    cmd = ["node", "--experimental-strip-types", "-e", script]
    assert subprocess.run(cmd, cwd=str(MOBILE_ROOT)).returncode == 0


def test_prod3b_12_case_3_dedupe_logic():
    """Case 3: RAW != AI_A, AI_A == AI_B -> Exactly 1 suggestion."""
    script = (
        "import { buildVisibleSuggestions } from './src/utils/suggestionDedupe.ts';"
        "const res = buildVisibleSuggestions({ rawOcrText: 'm yêu mùa hè', groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS', geminiSuggestion: 'Em yêu mùa hè', geminiStatus: 'SUCCESS' });"
        "process.exit(res.length === 1 && res[0].label === 'Gợi ý 1' ? 0 : 1);"
    )
    cmd = ["node", "--experimental-strip-types", "-e", script]
    assert subprocess.run(cmd, cwd=str(MOBILE_ROOT)).returncode == 0


def test_prod3b_13_case_5_dedupe_logic():
    """Case 5: Distinct suggestions -> Exactly 2 suggestions labeled Gợi ý 1 and Gợi ý 2."""
    script = (
        "import { buildVisibleSuggestions } from './src/utils/suggestionDedupe.ts';"
        "const res = buildVisibleSuggestions({ rawOcrText: 'Mọc trên đổi quề', groqSuggestion: 'Mọc trên đồi quê', groqStatus: 'SUCCESS', geminiSuggestion: 'Mọc trên đồi quê.', geminiStatus: 'SUCCESS' });"
        "process.exit(res.length === 2 && res[0].label === 'Gợi ý 1' && res[1].label === 'Gợi ý 2' ? 0 : 1);"
    )
    cmd = ["node", "--experimental-strip-types", "-e", script]
    assert subprocess.run(cmd, cwd=str(MOBILE_ROOT)).returncode == 0


def test_prod3b_14_case_8_failover_no_numbering_gap():
    """Case 8: Advisor A failed 429, Advisor B succeeded -> Labeled Gợi ý 1 without numbering gap."""
    script = (
        "import { buildVisibleSuggestions } from './src/utils/suggestionDedupe.ts';"
        "const res = buildVisibleSuggestions({ rawOcrText: 'Trời, sao ngọt the', groqStatus: 'UNAVAILABLE', geminiSuggestion: 'Trời, sao ngọt thế!', geminiStatus: 'SUCCESS' });"
        "process.exit(res.length === 1 && res[0].label === 'Gợi ý 1' && res[0].buttonLabel === 'Dùng gợi ý 1' ? 0 : 1);"
    )
    cmd = ["node", "--experimental-strip-types", "-e", script]
    assert subprocess.run(cmd, cwd=str(MOBILE_ROOT)).returncode == 0


def test_prod3b_15_case_9_unicode_nfc_nfd_dedupe():
    """Case 9: Unicode NFC/NFD variation dedupes correctly and preserves original string."""
    script = (
        "import { buildVisibleSuggestions } from './src/utils/suggestionDedupe.ts';"
        "const nfc = 'Tiếng chim reo';"
        "const nfd = nfc.normalize('NFD');"
        "const res = buildVisibleSuggestions({ rawOcrText: 'Tieng chim reo', groqSuggestion: '  Tiếng   chim  reo  ', groqStatus: 'SUCCESS', geminiSuggestion: nfd, geminiStatus: 'SUCCESS' });"
        "process.exit(res.length === 1 && res[0].text === '  Tiếng   chim  reo  ' ? 0 : 1);"
    )
    cmd = ["node", "--experimental-strip-types", "-e", script]
    assert subprocess.run(cmd, cwd=str(MOBILE_ROOT)).returncode == 0
