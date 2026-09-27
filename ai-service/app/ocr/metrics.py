"""
Canonical OCR Evaluation Metrics (CER and WER) for MathVision Kids.

Preserves Unicode NFC normalization, Vietnamese diacritics, and punctuation.
Documents whitespace and punctuation policies explicitly.
"""

from typing import List, Dict, Any, Tuple
import unicodedata

def normalize_for_eval(text: str) -> str:
    """
    Normalizes text for evaluation:
    - Unicode NFC canonical composition (combining diacritics merged into single characters)
    - Strips leading and trailing whitespace
    - Preserves internal whitespace, punctuation, and case
    """
    if text is None:
        return ""
    return unicodedata.normalize("NFC", str(text).strip())

def levenshtein_distance(s1: str, s2: str) -> int:
    """Standard Levenshtein edit distance at character level."""
    if s1 == s2:
        return 0
    if len(s1) == 0:
        return len(s2)
    if len(s2) == 0:
        return len(s1)
    
    v0 = list(range(len(s2) + 1))
    v1 = [0] * (len(s2) + 1)
    
    for i in range(len(s1)):
        v1[0] = i + 1
        for j in range(len(s2)):
            cost = 0 if s1[i] == s2[j] else 1
            v1[j + 1] = min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
        v0 = list(v1)
        
    return v0[len(s2)]

def word_levenshtein_distance(words1: List[str], words2: List[str]) -> int:
    """Standard Levenshtein edit distance at word token level."""
    if words1 == words2:
        return 0
    if len(words1) == 0:
        return len(words2)
    if len(words2) == 0:
        return len(words1)

    v0 = list(range(len(words2) + 1))
    v1 = [0] * (len(words2) + 1)

    for i in range(len(words1)):
        v1[0] = i + 1
        for j in range(len(words2)):
            cost = 0 if words1[i] == words2[j] else 1
            v1[j + 1] = min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
        v0 = list(v1)

    return v0[len(words2)]

def compute_line_cer(pred: str, target: str) -> Tuple[int, int, float]:
    """
    Computes (edit_distance, target_length, cer).
    CER = edit_distance / max(1, target_length)
    """
    norm_p = normalize_for_eval(pred)
    norm_t = normalize_for_eval(target)
    dist = levenshtein_distance(norm_p, norm_t)
    tgt_len = len(norm_t)
    cer = (dist / tgt_len) if tgt_len > 0 else (0.0 if dist == 0 else 1.0)
    return dist, tgt_len, cer

def compute_line_wer(pred: str, target: str) -> Tuple[int, int, float]:
    """
    Computes (word_distance, target_word_count, wer).
    WER = (S + D + I) / max(1, N_words)
    """
    norm_p = normalize_for_eval(pred)
    norm_t = normalize_for_eval(target)
    w_p = norm_p.split()
    w_t = norm_t.split()
    dist = word_levenshtein_distance(w_p, w_t)
    tgt_len = len(w_t)
    wer = (dist / tgt_len) if tgt_len > 0 else (0.0 if dist == 0 else 1.0)
    return dist, tgt_len, wer

def evaluate_line_pair(raw_text: str, final_text: str, target: str, suggested_text: str = None, decision: str = "KEEP_RAW") -> Dict[str, Any]:
    """
    Evaluates a single line comparison:
    - computes raw CER and final CER
    - computes delta_cer = raw_cer - final_cer
    - classifies outcome: IMPROVED, UNCHANGED, WORSENED, UNSUPPORTED
    """
    raw_dist, target_chars, raw_cer = compute_line_cer(raw_text, target)
    final_dist, _, final_cer = compute_line_cer(final_text, target)
    raw_w_dist, target_words, raw_wer = compute_line_wer(raw_text, target)
    final_w_dist, _, final_wer = compute_line_wer(final_text, target)

    delta_cer = raw_cer - final_cer

    # Outcome classification
    norm_target = normalize_for_eval(target)
    norm_sug = normalize_for_eval(suggested_text) if suggested_text else ""
    norm_raw = normalize_for_eval(raw_text)
    norm_final = normalize_for_eval(final_text)

    # Check for unsupported words if suggested text was proposed
    unsupported = False
    if suggested_text and decision in ("AUTO_APPLY", "SUGGEST_ONLY"):
        target_token_set = set(norm_target.lower().split())
        sug_token_set = set(norm_sug.lower().split())
        # Hallucinated extra words not present in ground truth
        extra_words = sug_token_set - target_token_set
        if len(extra_words) > 1 and len(sug_token_set) > len(target_token_set):
            unsupported = True

    if delta_cer > 0.0001:
        classification = "IMPROVED"
    elif delta_cer < -0.0001:
        classification = "WORSENED"
    elif unsupported:
        classification = "UNSUPPORTED"
    else:
        classification = "UNCHANGED"

    return {
        "raw_text": norm_raw,
        "final_text": norm_final,
        "target": norm_target,
        "suggested_text": norm_sug if suggested_text else None,
        "decision": decision,
        "raw_dist": raw_dist,
        "final_dist": final_dist,
        "target_chars": target_chars,
        "raw_cer": raw_cer,
        "final_cer": final_cer,
        "delta_cer": delta_cer,
        "raw_w_dist": raw_w_dist,
        "final_w_dist": final_w_dist,
        "target_words": target_words,
        "raw_wer": raw_wer,
        "final_wer": final_wer,
        "classification": classification,
        "is_unsupported": unsupported,
    }

def aggregate_metrics(line_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes aggregate CER and WER across all evaluated lines:
    Aggregate CER = sum(edit_distances) / sum(target_characters)
    Aggregate WER = sum(word_distances) / sum(target_words)
    """
    total_target_chars = sum(r["target_chars"] for r in line_results)
    total_raw_char_dist = sum(r["raw_dist"] for r in line_results)
    total_final_char_dist = sum(r["final_dist"] for r in line_results)

    total_target_words = sum(r["target_words"] for r in line_results)
    total_raw_word_dist = sum(r["raw_w_dist"] for r in line_results)
    total_final_word_dist = sum(r["final_w_dist"] for r in line_results)

    raw_crnn_cer = (total_raw_char_dist / total_target_chars * 100.0) if total_target_chars > 0 else 0.0
    final_cer = (total_final_char_dist / total_target_chars * 100.0) if total_target_chars > 0 else 0.0

    raw_wer = (total_raw_word_dist / total_target_words * 100.0) if total_target_words > 0 else 0.0
    final_wer = (total_final_word_dist / total_target_words * 100.0) if total_target_words > 0 else 0.0

    total_lines = len(line_results)
    improved_count = sum(1 for r in line_results if r["classification"] == "IMPROVED")
    worsened_count = sum(1 for r in line_results if r["classification"] == "WORSENED")
    unsupported_count = sum(1 for r in line_results if r.get("is_unsupported", False))

    auto_applied = [r for r in line_results if r.get("decision") == "AUTO_APPLY"]
    auto_apply_worsened = sum(1 for r in auto_applied if r["delta_cer"] < -0.0001)

    return {
        "line_count": total_lines,
        "total_target_chars": total_target_chars,
        "raw_crnn_cer": round(raw_crnn_cer, 2),
        "final_cer": round(final_cer, 2),
        "raw_wer": round(raw_wer, 2),
        "final_wer": round(final_wer, 2),
        "improved_count": improved_count,
        "worsened_count": worsened_count,
        "unsupported_count": unsupported_count,
        "correction_improvement_rate": round((improved_count / max(1, total_lines)) * 100.0, 2),
        "correction_worsening_rate": round((worsened_count / max(1, total_lines)) * 100.0, 2),
        "unsupported_correction_rate": round((unsupported_count / max(1, total_lines)) * 100.0, 2),
        "auto_apply_error_rate": round((auto_apply_worsened / max(1, len(auto_applied))) * 100.0, 2) if auto_applied else 0.0,
    }
