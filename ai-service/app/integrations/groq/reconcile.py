"""
Reconcile Groq line analysis with local CV candidate boxes.

For each Groq line:
  - If candidate_ids given: union those local candidate boxes
  - If no candidate_ids: map from normalized bbox to pixel search window

Final output: sorted LineBox list, one per physical row.
"""

import logging
from typing import List, Optional, Tuple

import cv2
import numpy as np

from app.schemas.ocr_pilot import LineBox

logger = logging.getLogger(__name__)

# Padding constants
PAD_X_RATIO = 0.02
PAD_X_MIN = 5
PAD_Y_RATIO = 0.08
PAD_Y_MIN = 4


def _union_boxes(boxes: List[Tuple[int, int, int, int]]) -> Tuple[int, int, int, int]:
    """Union a list of (x, y, w, h) into one bounding box."""
    x1 = min(b[0] for b in boxes)
    y1 = min(b[1] for b in boxes)
    x2 = max(b[0] + b[2] for b in boxes)
    y2 = max(b[1] + b[3] for b in boxes)
    return x1, y1, x2 - x1, y2 - y1


def _pad_box(
    x: int, y: int, w: int, h: int, img_w: int, img_h: int
) -> Tuple[int, int, int, int]:
    pad_x = max(PAD_X_MIN, int(w * PAD_X_RATIO))
    pad_y = max(PAD_Y_MIN, int(h * PAD_Y_RATIO))
    xp = max(0, x - pad_x)
    yp = max(0, y - pad_y)
    wp = min(img_w - xp, w + 2 * pad_x)
    hp = min(img_h - yp, h + 2 * pad_y)
    return xp, yp, wp, hp


def _norm_to_pixel(v: int, dim: int) -> int:
    return int(v * dim / 1000)


def should_use_groq_line_analyzer(
    local_boxes: List[LineBox],
    strong_band_count: int,
    assist_mode: str,
) -> bool:
    """
    Decide whether to invoke Groq vision line assist for this image.
    General heuristic — NOT tied to a specific known row count.
    Only triggers on suspicious segmentation when mode is 'suspicious_only' or 'handwriting'.
    """
    if assist_mode == "off":
        return False
    if assist_mode == "always":
        return True

    # 'suspicious_only' / 'handwriting' mode: examine structural suspiciousness
    n = len(local_boxes)
    if n == 0:
        return True  # 0 boxes despite visible ink / detection call = suspicious
    if strong_band_count > 0 and n > strong_band_count * 1.5:
        return True  # over-segmentation: many more candidate boxes than strong body bands

    heights = [b.height for b in local_boxes]
    # Check for tiny accent-only strips
    if any(h < 8 for h in heights):
        return True

    # High height variance suggests fragmentation / graph paper noise
    if len(heights) > 2:
        median_h = sorted(heights)[len(heights) // 2]
        tiny = sum(1 for h in heights if h < median_h * 0.4)
        if tiny >= 2:
            return True

    # Check for excessive horizontal overlaps on the same baseline
    for i in range(len(local_boxes)):
        for j in range(i + 1, len(local_boxes)):
            b1, b2 = local_boxes[i], local_boxes[j]
            v_overlap = max(0, min(b1.y + b1.height, b2.y + b2.height) - max(b1.y, b2.y))
            if v_overlap > 0.5 * min(b1.height, b2.height):
                h_overlap = max(0, min(b1.x + b1.width, b2.x + b2.width) - max(b1.x, b2.x))
                if h_overlap > 0.3 * min(b1.width, b2.width):
                    return True

    return False


def reconcile_groq_lines(
    groq_analysis,  # GroqLineAnalysis
    local_boxes: List[LineBox],
    img_w: int,
    img_h: int,
    accept_threshold: float = 0.80,
) -> Optional[List[LineBox]]:
    """
    Merge Groq grouping with local candidate pixel boxes.
    Returns final LineBox list with layout geometry ONLY.
    IMPORTANT (GROQ.5): Groq line assist does NOT transcribe final text.
    LineBox.text remains None; CRNN is the primary recognition engine.
    """
    from app.integrations.groq.schemas import GroqLineAnalysis
    analysis: GroqLineAnalysis = groq_analysis

    if analysis.overall_confidence < accept_threshold:
        logger.info(
            f"[Reconcile] Groq confidence {analysis.overall_confidence:.2f} < threshold {accept_threshold}. Using local fallback."
        )
        return None

    if len(analysis.lines) == 0 and len(local_boxes) > 0:
        logger.info(
            f"[Reconcile] Groq returned 0 lines while local detected {len(local_boxes)} boxes. Using local fallback."
        )
        return None

    # Build candidate lookup (1-indexed id → box tuple)
    candidate_map = {i + 1: (b.x, b.y, b.width, b.height) for i, b in enumerate(local_boxes)}
    drop_ids = set(analysis.drop_candidate_ids)

    final_boxes: List[Tuple[int, int, int, int]] = []

    for line in sorted(analysis.lines, key=lambda l: l.order):
        valid_ids = [cid for cid in line.candidate_ids if cid in candidate_map and cid not in drop_ids]

        if valid_ids:
            selected = [candidate_map[cid] for cid in valid_ids]
            x, y, w, h = _union_boxes(selected)
        else:
            # Derive from normalized bbox
            bn = line.bbox_norm
            x = _norm_to_pixel(bn.x1, img_w)
            y = _norm_to_pixel(bn.y1, img_h)
            w = _norm_to_pixel(bn.x2 - bn.x1, img_w)
            h = _norm_to_pixel(bn.y2 - bn.y1, img_h)

        if w < 5 or h < 3:
            logger.debug(f"[Reconcile] Skipping degenerate box line order={line.order} w={w} h={h}")
            continue

        xp, yp, wp, hp = _pad_box(x, y, w, h, img_w, img_h)
        final_boxes.append((xp, yp, wp, hp))

    # Sort top-to-bottom
    final_boxes.sort(key=lambda b: b[1] + b[3] / 2)

    # Remove near-duplicate rows (center within 10px of each other)
    deduped = []
    for b in final_boxes:
        cy = b[1] + b[3] / 2
        if not any(abs(cy - (prev[1] + prev[3] / 2)) < 10 for prev in deduped):
            deduped.append(b)

    # GROQ.5: text is explicitly None — line assist provides layout only!
    result = [
        LineBox(
            line_id=f"line_{i + 1}",
            x=int(b[0]), y=int(b[1]),
            width=int(b[2]), height=int(b[3]),
            order=i + 1,
            text=None,
        )
        for i, b in enumerate(deduped)
    ]

    logger.info(f"[Reconcile] {len(local_boxes)} local -> Groq groups -> {len(result)} final rows (layout only)")
    return result

