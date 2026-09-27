"""
AI.HWTEXT.PROD.3F: Comprehensive Integration & Acceptance Tests.
Covers Scopes A through F:
- Scope A & B: Direct Home CTAs (Camera & Gallery without intermediate chooser)
- Scope C: Privacy Multi-Mask Layer Persistence (movingMaskId, no disappearing masks)
- Scope D: Always-Useful AI Review Policy (typos, near-words, multi-candidates, math safety)
- Scope E: Provider Abstraction & Hidden Names
- Scope F: Result Screen Visual Cleanliness & AI Confirmed State
"""
import subprocess
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
MOBILE_ROOT = REPO_ROOT / "apps" / "student-mobile"
HOME_PATH = MOBILE_ROOT / "src" / "app" / "(tabs)" / "index.tsx"
PRIVACY_PATH = MOBILE_ROOT / "src" / "app" / "privacy.tsx"
RESULT_PATH = MOBILE_ROOT / "src" / "app" / "ocr-pilot" / "multiline-result.tsx"
DEDUPE_PATH = MOBILE_ROOT / "src" / "utils" / "suggestionDedupe.ts"
NODE_TEST_PATH = MOBILE_ROOT / "src" / "utils" / "__tests__" / "suggestionDedupe.test.mjs"


def _read_file(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def test_prod3f_01_home_direct_cta_no_redundant_modal():
    """PROD3F-01: Home has direct camera & gallery CTAs and no redundant ImageSourceModal."""
    src = _read_file(HOME_PATH)
    # Direct camera call
    assert "navigateToCamera('HANDWRITING_TEXT')" in src
    # Direct gallery call on the secondary CTA
    assert "onPress={handlePickImage}" in src
    # No intermediate ImageSourceModal on Home
    assert "<ImageSourceModal" not in src
    assert "showSourceModal" not in src


def test_prod3f_02_privacy_multi_mask_persists():
    """PROD3F-02: Privacy mask uses movingMaskId, completely eliminating the disappearing mask bug."""
    src = _read_file(PRIVACY_PATH)
    # Must NOT contain the old bug: opacity: isSelected ? 0 : 1
    assert "opacity: isSelected ? 0 : 1" not in src
    # Must contain movingMaskId state and check
    assert "const [movingMaskId, setMovingMaskId] = useState" in src
    assert "opacity: isMoving ? 0 : 1" in src


def test_prod3f_03_all_node_matrix_cases_pass():
    """PROD3F-03: All 16 PROD.3B & PROD.3F dedupe matrix cases pass in Node."""
    assert NODE_TEST_PATH.exists()
    cmd = ["node", "--experimental-strip-types", str(NODE_TEST_PATH)]
    res = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True, encoding="utf-8")
    assert res.returncode == 0, f"Node test failed:\n{res.stderr}\n{res.stdout}"
    assert "CASES PASSED SUCCESSFULLY" in res.stdout


def test_prod3f_04_no_old_negative_copy():
    """PROD3F-04: The old copy 'AI chưa có đề xuất khác cho dòng này.' is completely removed."""
    res_src = _read_file(RESULT_PATH)
    assert "AI chưa có đề xuất khác cho dòng này." not in res_src
    assert "AI xác nhận nội dung chính xác ✓" in res_src
    assert "Chưa thể kiểm tra thêm lúc này." in res_src


def test_prod3f_05_math_protection_preserved():
    """PROD3F-05: evaluate_correction_safety strictly protects student arithmetic mistakes."""
    from app.integrations.groq.corrector import evaluate_correction_safety

    # Student wrote 38 (arithmetic error for 12 + 25)
    raw = "12 + 25 = 38"
    # AI attempts to 'fix' the math to 37
    ai_fixed = "12 + 25 = 37"

    decision, edit_ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=ai_fixed,
        groq_confidence=0.99,
        domain="ARITHMETIC",
    )
    # Must reject math modification
    assert decision == "KEEP_RAW"
    assert "math" in reason


def test_prod3f_06_vietnamese_typo_correction_accepted():
    """PROD3F-06: evaluate_correction_safety accepts Vietnamese diacritic / typo correction."""
    from app.integrations.groq.corrector import evaluate_correction_safety

    raw = "Trời, sao ngọt thề!"
    corrected = "Trời, sao ngọt thế!"

    decision, edit_ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=corrected,
        groq_confidence=0.95,
        visual_support="STRONG",
        domain="HANDWRITING_TEXT",
    )
    # Small edit on diacritic is accepted
    assert decision in ("AUTO_APPLY", "SUGGEST_ONLY")


def test_prod3f_07_near_word_confusion_accepted():
    """PROD3F-07: evaluate_correction_safety accepts Vietnamese near-word confusion correction."""
    from app.integrations.groq.corrector import evaluate_correction_safety

    raw = "Rung ring bướm lượn."
    corrected = "Rung rinh bướm lượn."

    decision, edit_ratio, reason = evaluate_correction_safety(
        raw_text=raw,
        suggested_text=corrected,
        groq_confidence=0.92,
        visual_support="STRONG",
        domain="HANDWRITING_TEXT",
    )
    assert decision in ("AUTO_APPLY", "SUGGEST_ONLY")


def test_prod3f_08_provider_names_strictly_hidden_from_cards():
    """PROD3F-08: Student UI card rendering never exposes provider names Groq, Gemini, CRNN."""
    res_src = _read_file(RESULT_PATH)
    assert "<Text style={styles.providerChipGroqText}>Groq</Text>" not in res_src
    assert "<Text style={styles.providerChipGeminiText}>Gemini</Text>" not in res_src
    assert "<Text style={styles.providerChipCrnnText}>CRNN</Text>" not in res_src
    assert 'badgeText = "Groq"' not in res_src
    assert 'badgeText = "Gemini"' not in res_src
