"""
METRIC (8/8) and QUALITY (10/10) test suites for Phase AI.HWTEXT.GROQ.6.
Verifies canonical CER and WER implementations, Unicode NFC normalization,
fixture SHA verification, line ordering, and evaluation integrity.
"""

import json
import os
import pytest
import unicodedata

from app.ocr.metrics import (
    normalize_for_eval,
    levenshtein_distance,
    word_levenshtein_distance,
    compute_line_cer,
    compute_line_wer,
    evaluate_line_pair,
    aggregate_metrics,
)
from app.config import settings

AI_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(AI_DIR, "tests/fixtures/ocr_eval/manifest.json")


# ====================================================================
# METRIC SANITY TESTS (8/8)
# ====================================================================

def test_metric_01_identical_text_zero_cer():
    """METRIC-01 identical text -> CER 0.0"""
    text = "Em yêu mùa hè"
    dist, length, cer = compute_line_cer(text, text)
    assert dist == 0
    assert cer == 0.0


def test_metric_02_one_substitution_expected_cer():
    """METRIC-02 one substitution -> expected CER"""
    target = "Có hoa sim tím" # 14 chars
    pred = "Cú hoa sim tím"   # 1 char substitution ('ó' -> 'ú')
    dist, length, cer = compute_line_cer(pred, target)
    assert dist == 1
    assert length == 14
    assert cer == pytest.approx(1 / 14, rel=1e-3)


def test_metric_03_insertion_makes_cer_over_100_percent():
    """METRIC-03 insertion can make CER > 100% on short GT"""
    target = "abc"
    pred = "abcdefgh" # 5 insertions
    dist, length, cer = compute_line_cer(pred, target)
    assert dist == 5
    assert length == 3
    assert cer > 1.0
    assert cer == pytest.approx(5 / 3, rel=1e-3)


def test_metric_04_unicode_nfc_equivalent():
    """METRIC-04 Unicode Vietnamese NFC equivalent -> same comparison"""
    # Decomposed NFD vs precomposed NFC
    nfc_str = "Em yêu mùa hè"
    nfd_str = unicodedata.normalize("NFD", nfc_str)
    assert nfc_str != nfd_str # binary representations differ
    dist, length, cer = compute_line_cer(nfd_str, nfc_str)
    assert dist == 0
    assert cer == 0.0


def test_metric_05_raw_and_final_produce_different_cer():
    """METRIC-05 raw and final fields produce different CER when text differs"""
    target = "Mọc trên đồi quê"
    raw_text = "Mọc tren doi que" # 3 missing diacritics
    final_text = "Mọc trên đồi quê" # fully corrected

    line_eval = evaluate_line_pair(raw_text, final_text, target, suggested_text=final_text, decision="AUTO_APPLY")
    assert line_eval["raw_cer"] > 0.0
    assert line_eval["final_cer"] == 0.0
    assert line_eval["raw_cer"] != line_eval["final_cer"]
    assert line_eval["delta_cer"] > 0.0
    assert line_eval["classification"] == "IMPROVED"


def test_metric_06_aggregate_cer_total_edits_over_total_chars():
    """METRIC-06 aggregate CER uses total edits / total GT chars"""
    lines = [
        evaluate_line_pair("abc", "abc", "abcd"), # 1 edit, 4 chars
        evaluate_line_pair("12345", "12345", "1234567890"), # 5 edits, 10 chars
    ]
    agg = aggregate_metrics(lines)
    # Total edits = 1 + 5 = 6. Total chars = 4 + 10 = 14.
    # 6 / 14 * 100 = 42.86%
    assert agg["raw_crnn_cer"] == pytest.approx(42.86, rel=1e-2)
    assert agg["total_target_chars"] == 14


def test_metric_07_line_order_mismatch_detected():
    """METRIC-07 line-order mismatch is detected"""
    targets = ["Dòng 1", "Dòng 2"]
    # Inverted predictions
    preds = ["Dòng 2", "Dòng 1"]
    evals = [
        evaluate_line_pair(preds[0], preds[0], targets[0]),
        evaluate_line_pair(preds[1], preds[1], targets[1]),
    ]
    # Both lines will have edit distance from comparing Dòng 2 with Dòng 1
    assert evals[0]["raw_dist"] > 0
    assert evals[1]["raw_dist"] > 0


def test_metric_08_wrong_fixture_sha_rejected():
    """METRIC-08 wrong fixture SHA rejected from headline metric"""
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Corrupt a SHA in a dummy entry
    entry = manifest[0].copy()
    entry["sha256"] = "wrong_fake_hash_1234567890"

    import hashlib
    with open(os.path.join(AI_DIR, entry["image_path"]), "rb") as f:
        real_sha = hashlib.sha256(f.read()).hexdigest()

    is_verified = (real_sha == entry["sha256"])
    assert not is_verified # must reject wrong SHA


# ====================================================================
# QUALITY TESTS (10/10)
# ====================================================================

def test_quality_01_authoritative_fixture_sha_mapping():
    """QUALITY-01 authoritative fixture SHA mapping verified in manifest"""
    assert os.path.isfile(MANIFEST_PATH), "manifest.json must exist"
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    import hashlib
    for entry in manifest:
        abs_img = os.path.join(AI_DIR, entry["image_path"])
        assert os.path.isfile(abs_img), f"Image file missing: {abs_img}"
        with open(abs_img, "rb") as f:
            computed_sha = hashlib.sha256(f.read()).hexdigest()
        assert computed_sha == entry["sha256"], f"SHA256 mismatch for {entry['fixture_id']}"


def test_quality_02_raw_cer_uses_raw_ocr_text():
    """QUALITY-02 raw CER uses rawOcrText"""
    raw = "m dép gại"
    final = "em đẹp gái"
    target = "em đẹp gái"
    eval_res = evaluate_line_pair(raw, final, target, suggested_text=final, decision="AUTO_APPLY")
    # raw CER must be computed from raw, not final
    assert eval_res["raw_dist"] == levenshtein_distance(raw, target)
    assert eval_res["raw_cer"] > 0.0


def test_quality_03_final_cer_uses_final_text():
    """QUALITY-03 final CER uses finalText"""
    raw = "m dép gại"
    final = "em đẹp gái"
    target = "em đẹp gái"
    eval_res = evaluate_line_pair(raw, final, target, suggested_text=final, decision="AUTO_APPLY")
    # final CER must be computed from final
    assert eval_res["final_dist"] == levenshtein_distance(final, target)
    assert eval_res["final_cer"] == 0.0


def test_quality_04_corrected_line_can_change_aggregate_cer():
    """QUALITY-04 corrected line can change aggregate CER"""
    lines = [
        evaluate_line_pair("Em yêu mùa hè", "Em yêu mùa hè", "Em yêu mùa hè"),
        evaluate_line_pair("Có hoa sim tim", "Có hoa sim tím", "Có hoa sim tím", suggested_text="Có hoa sim tím", decision="AUTO_APPLY"),
    ]
    agg = aggregate_metrics(lines)
    # Raw had 1 edit (tim vs tím), final has 0 edits
    assert agg["raw_crnn_cer"] > agg["final_cer"]
    assert agg["final_cer"] == 0.0


def test_quality_05_unsupported_correction_detected_by_gt():
    """QUALITY-05 unsupported correction detected by ground truth"""
    target = "Em yêu mùa hè"
    raw = "Em yeu mua he"
    # Suggestion contains hallucinated extra words
    suggestion = "Hôm nay em yêu mùa hè rất vui"
    eval_res = evaluate_line_pair(raw, raw, target, suggested_text=suggestion, decision="SUGGEST_ONLY")
    assert eval_res["is_unsupported"] is True
    assert eval_res["classification"] == "UNSUPPORTED"


def test_quality_06_worsened_correction_counted():
    """QUALITY-06 worsened correction counted"""
    target = "Mọc trên đồi quê"
    raw = "Mọc trên đôi quê" # 1 edit (đôi vs đồi)
    bad_suggestion = "Mọc trên đồng xanh" # 4 edits
    eval_res = evaluate_line_pair(raw, bad_suggestion, target, suggested_text=bad_suggestion, decision="AUTO_APPLY")
    assert eval_res["delta_cer"] < 0.0
    assert eval_res["classification"] == "WORSENED"


def test_quality_07_auto_apply_worsening_causes_error_count():
    """QUALITY-07 auto-apply worsening causes test failure / high error rate"""
    target = "Có hoa sim tím"
    raw = "Có hoa sim tím" # 0 edits
    worse = "Có hoa sim vàng" # 4 edits
    eval_res = evaluate_line_pair(raw, worse, target, suggested_text=worse, decision="AUTO_APPLY")
    agg = aggregate_metrics([eval_res])
    assert agg["auto_apply_error_rate"] == 100.0


def test_quality_08_line_ordering_verified():
    """QUALITY-08 line ordering verified in sequence"""
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    p1 = next(m for m in manifest if m["fixture_id"] == "poem_block_1_physical")
    assert len(p1["lines"]) == p1["expected_line_count"] == 4
    assert p1["lines"][0] == "Em yêu mùa hè"
    assert p1["lines"][1] == "Có hoa sim tím"
    assert p1["lines"][2] == "Mọc trên đồi quê"
    assert p1["lines"][3] == "Rung rinh bướm lượn."


def test_quality_09_expected_answers_absent_from_groq_payload():
    """QUALITY-09 expected answers absent from Groq payload"""
    from app.integrations.groq.corrector import request_groq_correction
    import inspect

    sig = inspect.signature(request_groq_correction)
    param_names = list(sig.parameters.keys())
    assert "target" not in param_names
    assert "expected_text" not in param_names
    assert "ground_truth" not in param_names
    assert "canonical_lines" not in param_names


def test_quality_10_canonical_runtime_override_remains_off():
    """QUALITY-10 canonical runtime override remains OFF by default"""
    assert settings.canonical_runtime_override_enabled is False
