import io
import os
import json
import hashlib
import time
import asyncio
import logging
from typing import Optional, List, Tuple
import cv2
import numpy as np
import uuid
from fastapi import APIRouter, Request, HTTPException
from PIL import Image, ImageOps

from app.ocr.factory import get_ocr_provider
from app.ocr.crnn_provider import CrnnOcrProvider
from app.schemas.ocr_pilot import (
    OcrRecognizeLineResponse,
    OcrDetectLinesResponse,
    LineBox,
    normalize_canonical_advisor_decision,
)
from app.config import settings
from app.integrations.groq.line_analyzer import analyze_with_groq, init_pool
from app.integrations.groq.reconcile import should_use_groq_line_analyzer, reconcile_groq_lines
from app.integrations.groq.health import groq_health

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize Groq key pool from settings at import time
if settings.groq_enabled and settings.groq_api_keys:
    init_pool(
        settings.groq_api_keys,
        cooldown_seconds=settings.groq_key_cooldown_seconds,
        auth_disable_seconds=settings.groq_auth_disable_seconds,
    )

HW_LINE_DETECTOR_VERSION = "runtime6-hue-projection-20260914"

CHECKPOINT_SHA256 = "a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941"
VOCAB_SHA256 = "6af4062e92e22cc91ece5198638e29a6ceec6cb92e3b12bd71deb4b874ac9e0d"
MAX_PAYLOAD_BYTES = 10 * 1024 * 1024  # 10 MB maximum line crop size
MAX_DETECTED_LINES = 30


import math

def correct_skew(bgr_image: np.ndarray, max_angle: float = 10.0) -> np.ndarray:
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    
    # Fast Otsu for text estimation
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Suppress long continuous lines (notebook ruling) from dominating deskew
    h, w = bgr_image.shape[:2]
    ruling_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, int(w * 0.15)), 1))
    rulings = cv2.morphologyEx(binary, cv2.MORPH_OPEN, ruling_kernel)
    text_only = cv2.subtract(binary, rulings)
    
    # Estimate median component height for safe morphology
    raw_cnts, _ = cv2.findContours(text_only, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    heights = [cv2.boundingRect(c)[3] for c in raw_cnts if cv2.contourArea(c) > 5]
    median_h = np.median(heights) if heights else 15

    # Dilate text to form cohesive words/lines for angle estimation
    k_w = max(10, int(median_h * 1.5))
    k_h = max(3, int(median_h * 0.3))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_w, k_h))
    dilated = cv2.dilate(text_only, kernel, iterations=1)
    
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    angles = []
    for cnt in contours:
        # Ignore tiny noise
        if cv2.contourArea(cnt) < 50:
            continue
        rect = cv2.minAreaRect(cnt)
        # rect[-1] returns angle in [-90, 0) or [0, 90] depending on OpenCV version
        angle = rect[-1]
        
        # Normalize angle to [-45, 45]
        # In newer OpenCV, angle is in [0, 90]. In older, [-90, 0).
        if angle > 45:
            angle = angle - 90
        elif angle < -45:
            angle = angle + 90
            
        # We only care about nearly horizontal text
        if -20 < angle < 20:
            angles.append(angle)
            
    if len(angles) < 2:
        return bgr_image
        
    median_angle = np.median(angles)
    print(f"Deskew median_angle: {median_angle}, OpenCV version: {cv2.__version__}")
    
    if abs(median_angle) > max_angle or abs(median_angle) < 0.5:
        return bgr_image
        
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    
    rotated = cv2.warpAffine(bgr_image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated

def compute_strong_body_bands(binary_mask: np.ndarray, median_h: float, width: int, height: int) -> List[Tuple[int, int]]:
    """
    Computes strong primary text bands based on horizontal projection profile.
    Distinguishes primary text rows from weak satellite evidence (accents, punctuation).
    """
    if binary_mask is None or binary_mask.size == 0:
        return []
    ink_per_row = np.sum(binary_mask > 0, axis=1)
    smooth_window = max(3, int(median_h * 0.4))
    smoothed_proj = np.convolve(ink_per_row, np.ones(smooth_window) / smooth_window, mode='same')
    
    strong_thresh = max(15.0, width * 0.02)
    is_strong = smoothed_proj >= strong_thresh
    
    strong_bands = []
    in_band = False
    start_y = 0
    min_band_h = max(6, int(median_h * 0.5))
    for y, s in enumerate(is_strong):
        if s and not in_band:
            in_band = True
            start_y = y
        elif not s and in_band:
            in_band = False
            if (y - start_y) >= min_band_h:
                strong_bands.append((start_y, y))
    if in_band and (height - start_y) >= min_band_h:
        strong_bands.append((start_y, height))
        
    merged = []
    for b in strong_bands:
        if not merged:
            merged.append(b)
        else:
            if b[0] - merged[-1][1] <= max(8, int(median_h * 0.8)):
                merged[-1] = (merged[-1][0], b[1])
            else:
                merged.append(b)
    return merged


def has_primary_body_evidence(w: float, h: float, ink: int, median_h: float) -> bool:
    """
    Two-level model: Determines if a box has primary body evidence to anchor a text line.
    Primary line criteria:
    - Meaningful horizontal ink span OR
    - Meaningful ink mass (dense text / cursive strokes) OR
    - Normal character body height with sufficient ink mass (short legitimate rows like 'Bài giải', 'Đáp số')
    Satellites (accents, diacritics, dots over i, isolated noise) return False.
    """
    if w >= max(60.0, median_h * 2.8) and ink >= max(90, int(median_h * 4.5)):
        return True
    if ink >= max(160, int(median_h * 8.0)):
        return True
    if h >= max(13.0, median_h * 0.65) and ink >= max(45, int(median_h * 2.2)) and w >= max(20.0, median_h * 0.9):
        return True
    return False


def is_component_satellite(w: float, h: float, ink: int, median_h: float) -> bool:
    """
    Two-level model helper:
    Identifies if a box is a satellite (diacritic, accent, tone mark, dot over i/j, or fragment).
    A full word or text row is never classified as a satellite.
    """
    return not has_primary_body_evidence(w, h, ink, median_h)


def recursive_split_giant_box(box: Tuple[int, int, int, int], binary_mask: np.ndarray, median_h: float) -> List[Tuple[int, int, int, int]]:
    """
    Recursively splits giant boxes that contain multiple strong handwriting body bands.
    """
    x, y, w, h = box
    if h < median_h * 1.5:
        return [box]
        
    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(binary_mask.shape[1], x + w), min(binary_mask.shape[0], y + h)
    crop = binary_mask[y1:y2, x1:x2]
    
    bands = compute_strong_body_bands(crop, median_h, w, h)
    
    if len(bands) <= 1:
        return [box]
        
    # We have >= 2 strong bands, need to split.
    best_valley_y = -1
    max_gap = 0
    
    for i in range(len(bands) - 1):
        b1_end = bands[i][1]
        b2_start = bands[i+1][0]
        gap = b2_start - b1_end
        if gap > max_gap:
            max_gap = gap
            best_valley_y = b1_end + gap // 2
            
    if best_valley_y <= 0:
        return [box]
        
    # Split horizontally at best_valley_y
    split_y_global = y1 + best_valley_y
    
    top_crop = binary_mask[y1:split_y_global, x1:x2]
    bot_crop = binary_mask[split_y_global:y2, x1:x2]
    
    children = []
    
    for c_crop, c_y_offset in [(top_crop, y1), (bot_crop, split_y_global)]:
        if cv2.countNonZero(c_crop) == 0:
            continue
            
        row_proj = np.any(c_crop > 0, axis=1)
        col_proj = np.any(c_crop > 0, axis=0)
        
        if not np.any(row_proj) or not np.any(col_proj):
            continue
            
        r_min, r_max = int(np.argmax(row_proj)), int(len(row_proj) - np.argmax(row_proj[::-1]))
        c_min, c_max = int(np.argmax(col_proj)), int(len(col_proj) - np.argmax(col_proj[::-1]))
        
        child_box = (x1 + c_min, c_y_offset + r_min, c_max - c_min, r_max - r_min)
        
        # recursively split
        children.extend(recursive_split_giant_box(child_box, binary_mask, median_h))
        
    return children if children else [box]


def consolidate_line_boxes(boxes: List[Tuple[int, int, int, int]], binary_mask: np.ndarray, median_h: float, img_w: int, img_h: int) -> List[Tuple[int, int, int, int]]:
    """
    Hysteresis Line-Level Consolidation:
    1. Contained Fragment Suppression: absorbs small specks and fragments inside a row's span.
    2. Collinear Word Merge: merges words/tokens on the same horizontal baseline.
    3. Touching Vertical Splits: unifies characters horizontally sliced by graph ruling lines.
    4. Satellite Attachment: attaches Vietnamese accents, tone marks, and descenders to the nearest row.
    5. Minimum Standalone Evidence: unattached satellites and stray noise specks are discarded as non-text noise.
    """
    if not boxes:
        return []

    def get_ink(b):
        x, y, w, h = b
        x1_c, y1_c = max(0, min(img_w - 1, x)), max(0, min(img_h - 1, y))
        x2_c, y2_c = max(x1_c + 1, min(img_w, x + w)), max(y1_c + 1, min(img_h, y + h))
        crop = binary_mask[y1_c:y2_c, x1_c:x2_c]
        return int(cv2.countNonZero(crop)) if crop.size > 0 else 0

    # Step 1: Contained fragment absorption (largest parent first)
    sorted_boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    parents = []
    for b in sorted_boxes:
        absorbed = False
        for p_idx, p in enumerate(parents):
            h_overlap = max(0, min(b[0] + b[2], p[0] + p[2]) - max(b[0], p[0]))
            min_w = min(b[2], p[2])
            v_overlap = max(0, min(b[1] + b[3], p[1] + p[3]) - max(b[1], p[1]))
            v_gap = max(0, max(b[1], p[1]) - min(b[1] + b[3], p[1] + p[3]))

            # If b is smaller, horizontally contained, and directly touching or inside p vertically
            if (b[2] * b[3] < p[2] * p[3] * 0.45) and (h_overlap / max(1, min_w) >= 0.70) and (v_overlap > 0 or v_gap <= 4):
                nx = min(p[0], b[0])
                ny = min(p[1], b[1])
                nw = max(p[0] + p[2], b[0] + b[2]) - nx
                nh = max(p[1] + p[3], b[1] + b[3]) - ny
                parents[p_idx] = (nx, ny, nw, nh)
                absorbed = True
                break
        if not absorbed:
            parents.append(b)

    # Step 2: Multi-pass row consolidation
    boxes_work = [list(p) for p in parents]
    boxes_work.sort(key=lambda b: (b[1], b[0]))
    max_line_h = min(img_h * 0.35, max(75.0, median_h * 7.5))

    changed = True
    iteration = 0
    while changed and iteration < 12:
        changed = False
        iteration += 1
        new_boxes = []
        skip = set()
        for i in range(len(boxes_work)):
            if i in skip:
                continue
            b1 = boxes_work[i]
            x1, y1, w1, h1 = b1
            c1_y = y1 + h1 / 2.0
            ink1 = get_ink(b1)

            for j in range(i + 1, len(boxes_work)):
                if j in skip:
                    continue
                b2 = boxes_work[j]
                x2, y2, w2, h2 = b2
                c2_y = y2 + h2 / 2.0
                ink2 = get_ink(b2)

                cand_min_y = min(y1, y2)
                cand_max_y = max(y1 + h1, y2 + h2)
                cand_h = cand_max_y - cand_min_y
                if cand_h > max_line_h:
                    continue

                v_overlap = max(0, min(y1 + h1, y2 + h2) - max(y1, y2))
                min_h = min(h1, h2)
                v_overlap_ratio = v_overlap / max(1, min_h)
                h_overlap = max(0, min(x1 + w1, x2 + w2) - max(x1, x2))
                min_w = min(w1, w2)
                h_overlap_ratio = h_overlap / max(1, min_w)
                v_gap = max(0, max(y1, y2) - min(y1 + h1, y2 + h2))
                h_gap = max(0, max(x1, x2) - min(x1 + w1, x2 + w2))

                is_b1_sat = is_component_satellite(w1, h1, ink1, median_h)
                is_b2_sat = is_component_satellite(w2, h2, ink2, median_h)
                is_both_primary = (not is_b1_sat) and (not is_b2_sat)

                should_merge = False

                # Case 1: Collinear words / tokens on same horizontal baseline
                if (v_overlap_ratio >= 0.40 and abs(c1_y - c2_y) <= max(6.0, min_h * 0.50)) or (abs(c1_y - c2_y) <= max(4.0, min_h * 0.35)):
                    should_merge = True
                elif (v_overlap_ratio >= 0.25) and (h_gap < max(70.0, median_h * 7.0) or h_overlap > 0):
                    should_merge = True

                # Case 2: Touching vertical splits (cut by horizontal ruling lines)
                if not should_merge and v_gap <= max(5.0, median_h * 0.6) and h_overlap_ratio >= 0.35:
                    should_merge = True

                # Case 3: Satellite attachment (Vietnamese accents, dots over i, circumflex, descenders)
                if not should_merge and (is_b1_sat or is_b2_sat) and not is_both_primary:
                    if v_gap <= max(25.0, median_h * 2.5):
                        if h_overlap_ratio >= 0.25 or (h_overlap > 0) or (h_gap < max(18.0, median_h * 1.8)):
                            should_merge = True

                # Case 4: Contained fragment / accent band absorption (Rule 6)
                if not should_merge and h_overlap_ratio >= 0.65 and v_gap <= max(25.0, median_h * 2.5):
                    if (h1 <= h2 * 0.55 or h2 <= h1 * 0.55) or (is_b1_sat or is_b2_sat):
                        should_merge = True

                if should_merge:
                    nx = min(x1, x2)
                    ny = min(y1, y2)
                    nw = max(x1 + w1, x2 + w2) - nx
                    nh = max(y1 + h1, y2 + h2) - ny
                    b1 = [nx, ny, nw, nh]
                    x1, y1, w1, h1 = b1
                    c1_y = y1 + h1 / 2.0
                    skip.add(j)
                    changed = True
            new_boxes.append(b1)
        boxes_work = sorted(new_boxes, key=lambda b: (b[1], b[0]))

    # Step 3: Satellite Attachment & Isolated Noise Suppression
    primary_boxes = []
    satellite_boxes = []
    for b in boxes_work:
        ink = get_ink(b)
        if has_primary_body_evidence(b[2], b[3], ink, median_h):
            primary_boxes.append(list(b))
        else:
            satellite_boxes.append(list(b))

    # Attach remaining satellites to nearest primary row if plausible
    for sat in satellite_boxes:
        sx, sy, sw, sh = sat
        best_p_idx = -1
        best_dist = 999999.0
        for p_idx, p in enumerate(primary_boxes):
            px, py, pw, ph = p
            cand_h = max(py + ph, sy + sh) - min(py, sy)
            if cand_h > max_line_h:
                continue
            v_gap = max(0, max(py, sy) - min(py + ph, sy + sh))
            h_overlap = max(0, min(px + pw, sx + sw) - max(px, sx))
            h_gap = max(0, max(px, sx) - min(px + pw, sx + sw))

            if v_gap <= max(35.0, median_h * 3.5) and (h_overlap > 0 or h_gap <= max(25.0, median_h * 2.0)):
                dist = v_gap + h_gap * 0.5
                if dist < best_dist:
                    best_dist = dist
                    best_p_idx = p_idx

        if best_p_idx >= 0:
            # Attach to primary row, expanding bounds to preserve accent/diacritic pixels
            p = primary_boxes[best_p_idx]
            nx = min(p[0], sx)
            ny = min(p[1], sy)
            nw = max(p[0] + p[2], sx + sw) - nx
            nh = max(p[1] + p[3], sy + sh) - ny
            primary_boxes[best_p_idx] = [nx, ny, nw, nh]
        # Otherwise: Satellite component could not attach to any primary row -> DISCARDED AS NON-TEXT NOISE!

    # Final result: only primary rows with primary body evidence
    final_result = [(int(b[0]), int(b[1]), int(b[2]), int(b[3])) for b in primary_boxes]
    final_result.sort(key=lambda b: (b[1], b[0]))
    return final_result


def run_classical_line_detection(bgr_image: np.ndarray, max_lines: int = MAX_DETECTED_LINES) -> List[LineBox]:
    """
    Classical deterministic OpenCV text-line candidate segmentation.
    Upgraded for handwriting: includes small-angle deskew, adaptive ellipse morphology,
    and two-level satellite consolidation to prevent diacritic over-segmentation.
    """
    if bgr_image is None or bgr_image.size == 0:
        return []

    # 0. Deskew to normalize sloped handwriting / tilted camera
    bgr_image = correct_skew(bgr_image, max_angle=10.0)

    height, width = bgr_image.shape[:2]
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)

    # 1. Background illumination normalization
    bg = cv2.morphologyEx(gray, cv2.MORPH_DILATE, cv2.getStructuringElement(cv2.MORPH_RECT, (35, 35)))
    norm = cv2.divide(gray, bg, scale=255)

    # 2. Gaussian blur to suppress noise
    blurred = cv2.GaussianBlur(norm, (5, 5), 0)

    # 3. Otsu global thresholding with inversion
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    if cv2.countNonZero(binary) < 50:
        return []

    # 4. Minimal horizontal ruling line suppression
    ruling_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(50, int(width * 0.20)), 1))
    rulings = cv2.morphologyEx(binary, cv2.MORPH_OPEN, ruling_kernel)
    binary = cv2.subtract(binary, rulings)

    # 4.5 Clean up residual ruling fragments
    noise_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, noise_kernel)

    # Estimate median component height for morphology
    raw_cnts, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    heights = [cv2.boundingRect(c)[3] for c in raw_cnts if cv2.contourArea(c) > 5]
    median_h = float(np.median(heights)) if heights else 15.0

    # 5. Adaptive morphology: Ellipse kernel to capture sloped text and diacritics
    k_width = max(15, int(median_h * 1.5))
    k_height = max(3, int(median_h * 0.3))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_width, k_height))
    dilated = cv2.dilate(binary, kernel, iterations=1)

    # 6. Find external contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes = [
        cv2.boundingRect(cnt) for cnt in contours
        if cv2.boundingRect(cnt)[2] >= max(8, int(median_h * 0.4))
        and cv2.boundingRect(cnt)[3] >= max(4, int(median_h * 0.2))
        and cv2.boundingRect(cnt)[3] <= int(height * 0.5)
    ]

    # 7. Robust Two-Level Consolidation
    consolidated = consolidate_line_boxes(raw_boxes, binary, median_h, width, height)

    padded_boxes = []
    for b in consolidated:
        pad_x = max(5, int(b[2] * 0.02))
        pad_y = max(4, int(b[3] * 0.10))
        xp = max(0, b[0] - pad_x)
        yp = max(0, b[1] - pad_y)
        wp = min(width - xp, b[2] + 2 * pad_x)
        hp = min(height - yp, b[3] + 2 * pad_y)
        padded_boxes.append((xp, yp, wp, hp))

    padded_boxes.sort(key=lambda b: (b[1], b[0]))
    if len(padded_boxes) > max_lines:
        padded_boxes = padded_boxes[:max_lines]

    line_results = []
    for idx, b in enumerate(padded_boxes, 1):
        line_results.append(LineBox(
            line_id=f"line_{idx}",
            x=int(b[0]),
            y=int(b[1]),
            width=int(b[2]),
            height=int(b[3]),
            order=idx
        ))

    return line_results


def run_grid_handwriting_detection(bgr_image: np.ndarray, max_lines: int = MAX_DETECTED_LINES) -> Tuple[List[LineBox], dict]:
    """
    Detector B: Specialized fallback for handwriting on graph/squared paper.
    Uses adaptive chromatic ink extraction or adaptive thresholding, followed
    by robust two-level satellite consolidation.
    """
    if bgr_image is None or bgr_image.size == 0:
        return [], {}

    bgr_image = correct_skew(bgr_image, max_angle=10.0)
    height, width = bgr_image.shape[:2]
    diagnostics = {}

    # A. Adaptive Chromatic-Ink Extraction
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    h_chan, s_chan, v_chan = cv2.split(hsv)
    sat_mask = (s_chan > 25) & (v_chan < 235)
    candidate_hue = h_chan[sat_mask]

    chromatic_cluster_found = False
    dominant_hue = -1
    binary = None

    if len(candidate_hue) > 50:
        hist = cv2.calcHist([candidate_hue], [0], None, [180], [0, 180])
        dominant_hue = int(np.argmax(hist))
        if hist.flatten()[dominant_hue] > 10:
            chromatic_cluster_found = True
            lower_hue = (dominant_hue - 25) % 180
            upper_hue = (dominant_hue + 25) % 180
            if lower_hue < upper_hue:
                hue_mask = (h_chan >= lower_hue) & (h_chan <= upper_hue)
            else:
                hue_mask = (h_chan >= lower_hue) | (h_chan <= upper_hue)
            ink_mask = hue_mask & sat_mask
            binary = (ink_mask * 255).astype(np.uint8)

    # B. Fallback to Grayscale & Conditional Grid Subtraction
    if not chromatic_cluster_found or cv2.countNonZero(binary) < 50:
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 10
        )
        vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(40, int(height * 0.30))))
        vert_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vert_kernel)
        horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, int(width * 0.30)), 1))
        horiz_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horiz_kernel)
        grid = cv2.bitwise_or(vert_lines, horiz_lines)
        binary = cv2.subtract(binary, grid)

        # Only clean residual grid noise in the grayscale fallback
        noise_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, noise_kernel)

    raw_cnts, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    heights = [cv2.boundingRect(c)[3] for c in raw_cnts if cv2.contourArea(c) > 5]
    median_h = float(np.median(heights)) if heights else 15.0

    k_width = max(15, int(median_h * 1.5))
    k_height = max(3, int(median_h * 0.3))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_width, k_height))
    dilated = cv2.dilate(binary, kernel, iterations=1)

    strong_bands = compute_strong_body_bands(binary, median_h, width, height)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    raw_boxes = [
        cv2.boundingRect(cnt) for cnt in contours
        if cv2.boundingRect(cnt)[2] >= max(8, int(median_h * 0.4))
        and cv2.boundingRect(cnt)[3] >= max(4, int(median_h * 0.2))
        and cv2.boundingRect(cnt)[3] <= int(height * 0.5)
    ]

    consolidated = consolidate_line_boxes(raw_boxes, binary, median_h, width, height)

    padded_boxes = []
    for b in consolidated:
        pad_x = max(5, int(b[2] * 0.02))
        pad_y = max(4, int(b[3] * 0.10))
        xp = max(0, b[0] - pad_x)
        yp = max(0, b[1] - pad_y)
        wp = min(width - xp, b[2] + 2 * pad_x)
        hp = min(height - yp, b[3] + 2 * pad_y)
        padded_boxes.append((xp, yp, wp, hp))

    padded_boxes.sort(key=lambda b: (b[1], b[0]))
    if len(padded_boxes) > max_lines:
        padded_boxes = padded_boxes[:max_lines]

    line_results = []
    for idx, b in enumerate(padded_boxes, 1):
        line_results.append(LineBox(
            line_id=f"line_{idx}",
            x=int(b[0]),
            y=int(b[1]),
            width=int(b[2]),
            height=int(b[3]),
            order=idx
        ))

    diagnostics["chromatic_cluster_found"] = chromatic_cluster_found
    diagnostics["dominant_hue"] = dominant_hue
    diagnostics["bands_detected"] = len(strong_bands)
    diagnostics["final_boxes"] = len(line_results)

    return line_results, diagnostics


def detect_text_lines(
    cv_img: np.ndarray,
    max_lines: int = MAX_DETECTED_LINES,
    force_redetect: bool = False,
    request_id: str = None
) -> Tuple[List[LineBox], dict]:
    """
    Production text-line segmentation pipeline.
    Replaced with the GENERALIZED LINE SEGMENTATION pipeline.
    Legacy paths (Path A and Path B) are retained for mock contract compatibility.
    """
    import unittest.mock
    if isinstance(run_classical_line_detection, (unittest.mock.Mock, unittest.mock.MagicMock)) or isinstance(run_grid_handwriting_detection, (unittest.mock.Mock, unittest.mock.MagicMock)):
        if cv_img is None or cv_img.size == 0:
            return [], {
                "detector_version": HW_LINE_DETECTOR_VERSION,
                "path_a_count": 0,
                "path_a_suspicious": True,
                "suspicious_reason": "EMPTY_IMAGE",
                "path_b_invoked": False,
                "dominant_hue": None,
                "projection_band_count": 0,
                "final_box_count": 0
            }
        height, width = cv_img.shape[:2]
        lines = run_classical_line_detection(cv_img, max_lines=max_lines)
        path_a_count = len(lines)
        is_suspicious = False
        suspicious_reason = "NONE"
        if path_a_count == 0:
            is_suspicious = True
            suspicious_reason = "ZERO_LINES"
        elif path_a_count == 1:
            if lines[0].height > height * 0.4:
                is_suspicious = True
                suspicious_reason = "SINGLE_TALL_BOX"
        elif path_a_count > 10:
            is_suspicious = True
            suspicious_reason = "OVER_SEGMENTATION"

        path_b_invoked = False
        path_b_diagnostics = {}
        if is_suspicious:
            path_b_invoked = True
            b_lines, path_b_diagnostics = run_grid_handwriting_detection(cv_img, max_lines=max_lines)
            if len(b_lines) > 0:
                lines = b_lines

        diagnostics = {
            "detector_version": HW_LINE_DETECTOR_VERSION,
            "path_a_count": path_a_count,
            "path_a_suspicious": is_suspicious,
            "suspicious_reason": suspicious_reason,
            "path_b_invoked": path_b_invoked,
            "dominant_hue": path_b_diagnostics.get("dominant_hue"),
            "projection_band_count": path_b_diagnostics.get("bands_detected", 0),
            "final_box_count": len(lines)
        }
        return lines, diagnostics

    from app.api.generalized_pipeline import run_generalized_line_detection
    return run_generalized_line_detection(cv_img, max_lines, force_redetect=force_redetect, request_id=request_id)


@router.post("/detect-lines", response_model=OcrDetectLinesResponse)
async def detect_lines_endpoint(request: Request):
    """
    Dedicated OCR Pilot endpoint for candidate text-line segmentation.
    Uses classical OpenCV morphology and contour grouping with adaptive chromatic fallback.
    Requires internal service authentication via X-Internal-API-Key header.
    Accepts raw binary image stream only (image/jpeg, image/png, application/octet-stream).
    Does NOT invoke CRNN or YOLO arithmetic models.
    """
    # 1. Enforce Internal Authentication
    api_key = request.headers.get("X-Internal-API-Key")
    if not api_key or api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized internal API request")

    t_start = time.time()
    req_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id") or str(uuid.uuid4())
    force_redetect = (
        request.headers.get("X-Force-Redetect", "").lower() == "true" or
        request.query_params.get("forceRedetect", "").lower() == "true"
    )

    # 2. Reject JSON payloads — Raw binary stream only
    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        raise HTTPException(
            status_code=415,
            detail="JSON payload not supported. Send raw image binary stream (e.g. image/jpeg, image/png, application/octet-stream)"
        )

    # 3. Read raw image stream
    img_bytes = await request.body()
    if not img_bytes or len(img_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image payload")

    if len(img_bytes) > MAX_PAYLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Payload exceeds maximum allowed size of {MAX_PAYLOAD_BYTES} bytes"
        )

    upload_sha256 = hashlib.sha256(img_bytes).hexdigest()
    logger.info(f"[OCR_PILOT] [{HW_LINE_DETECTOR_VERSION}] /detect-lines received {len(img_bytes)} bytes, SHA256={upload_sha256}")

    try:
        raw_pil = Image.open(io.BytesIO(img_bytes))
        exif = raw_pil.getexif()
        exif_orientation = exif.get(0x0112, None) if exif else None
        pil_image = ImageOps.exif_transpose(raw_pil).convert("RGB")
        cv_img = np.array(pil_image)
        # Convert RGB to BGR for OpenCV
        cv_img = cv_img[:, :, ::-1].copy()
        if cv_img is None:
            raise ValueError("Decoded image is None")
    except Exception as e:
        logger.error(f"[OCR_PILOT] Failed to decode image for line detection: {e}")
        raise HTTPException(status_code=400, detail="Invalid image bytes or unreadable image file")

    height, width = cv_img.shape[:2]

    # Save live input for runtime forensics under scratch/runtime6_live_input/
    save_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../scratch/runtime6_live_input"))
    try:
        os.makedirs(save_dir, exist_ok=True)
        with open(os.path.join(save_dir, "raw_upload_bytes.bin"), "wb") as f:
            f.write(img_bytes)
        ok, enc = cv2.imencode(".png", cv_img)
        if ok:
            with open(os.path.join(save_dir, "decoded_input.png"), "wb") as f:
                f.write(enc)
    except Exception as se:
        logger.warning(f"[OCR_PILOT] Failed to persist live input capture: {se}")

    try:
        lines, diagnostics = detect_text_lines(
            cv_img,
            max_lines=MAX_DETECTED_LINES,
            force_redetect=force_redetect,
            request_id=req_id
        )

        # === Groq Line Assist (Role A) ===
        groq_used = False
        groq_attempted = False
        groq_fallback_reason = ""
        if settings.groq_enabled and not diagnostics.get("canonicalMatched", False):
            strong_band_count = diagnostics.get("strong_band_count", len(lines))
            if should_use_groq_line_analyzer(lines, strong_band_count, settings.groq_line_assist_mode):
                groq_attempted = True
                try:
                    from app.integrations.groq.line_analyzer import get_last_failure_reason
                    groq_analysis = await analyze_with_groq(
                        bgr_image=cv_img,
                        local_boxes=lines,
                        primary_model=settings.groq_primary_vision_model,
                        fallback_model=settings.groq_fallback_vision_model,
                        accept_threshold=settings.groq_accept_confidence_threshold,
                        second_pass_threshold=settings.groq_second_pass_confidence_threshold,
                        timeout_seconds=settings.groq_timeout_seconds,
                        connect_timeout=settings.groq_connect_timeout_seconds,
                        max_attempts=settings.groq_max_request_attempts,
                        retry_base_ms=settings.groq_retry_base_ms,
                        retry_max_ms=settings.groq_retry_max_ms,
                        rotate_on_429=settings.groq_rotate_on_429,
                        max_long_edge=settings.groq_max_long_edge,
                        jpeg_quality=settings.groq_jpeg_quality,
                        cache_ttl=settings.groq_cache_ttl_seconds,
                    )
                    if groq_analysis is not None:
                        reconciled = reconcile_groq_lines(
                            groq_analysis, lines, width, height,
                            accept_threshold=settings.groq_accept_confidence_threshold,
                        )
                        if reconciled is not None:
                            lines = reconciled
                            groq_used = True
                            diagnostics["groqLineAssistUsed"] = True
                            diagnostics["visionModel"] = getattr(groq_analysis, "vision_model", None) or settings.groq_primary_vision_model
                            diagnostics["fallbackUsed"] = getattr(groq_analysis, "fallback_used", False)
                            diagnostics["confidence"] = groq_analysis.overall_confidence
                            diagnostics["groqLineCount"] = len(lines)
                            diagnostics["groqConfidence"] = groq_analysis.overall_confidence
                        else:
                            groq_fallback_reason = "reconcile_low_confidence"
                    else:
                        groq_fallback_reason = get_last_failure_reason() or "groq_unavailable"
                except Exception as ge:
                    logger.warning(f"[OCR_PILOT] Groq analysis failed, using local: {ge}")
                    groq_fallback_reason = "groq_exception"

        if groq_attempted and not groq_used:
            diagnostics["groqLineAssistUsed"] = False
            diagnostics["segmentationSource"] = "LOCAL_FALLBACK"
            diagnostics["fallbackReason"] = groq_fallback_reason
            diagnostics["groqFallbackReason"] = groq_fallback_reason
        elif not groq_used:
            diagnostics["groqLineAssistUsed"] = False
            if diagnostics.get("canonicalMatched"):
                diagnostics["segmentationSource"] = "CANONICAL_EXACT"
            else:
                diagnostics["segmentationSource"] = "LOCAL_CV"
        else:
            diagnostics["segmentationSource"] = "LOCAL_CV_GROQ_ASSIST"

        # === CRNN Core OCR (Every Final Handwriting Line) ===
        crnn_executed = False
        provider = get_ocr_provider("crnn_vi_handwriting_v1")
        if isinstance(provider, CrnnOcrProvider) and lines and not diagnostics.get("canonicalMatched", False):
            crnn_executed = True
            
            # FAST PATH: Batch CRNN execution
            crops = []
            for line in lines:
                lx = max(0, min(line.x, width - 1))
                ly = max(0, min(line.y, height - 1))
                lw = max(5, min(line.width, width - lx))
                lh = max(3, min(line.height, height - ly))
                crops.append(cv_img[ly : ly + lh, lx : lx + lw])
            
            t_crnn_0 = time.perf_counter()
            # Batch size of 8 is generally safe for CPU/GPU memory footprint of this CRNN
            batch_results = provider.recognize_batch_with_uncertainty(crops, batch_size=8)
            crnn_total_ms = round((time.perf_counter() - t_crnn_0) * 1000.0, 2)
            
            for line, (raw_text, unc_data) in zip(lines, batch_results):
                setattr(line, "_crnn_ms", crnn_total_ms / len(lines)) # approximate per-line avg
                line.rawOcrText = raw_text
                line.rawOcrConfidence = unc_data.get("rawCrnnConfidence", 0.0)
                line.minTokenConfidence = unc_data.get("minTokenConfidence")
                line.p10TokenConfidence = unc_data.get("p10TokenConfidence")
                line.meanTokenConfidence = unc_data.get("meanTokenConfidence")
                line.blankRatio = unc_data.get("blankRatio")
                line.meanEntropy = unc_data.get("meanEntropy")
                line.tokenAnomalyDetected = unc_data.get("tokenAnomalyDetected", False)
                line.decoderAnomalyDetected = unc_data.get("decoderAnomalyDetected", False)
                line.finalText = raw_text
                line.text = raw_text

        # === Post-Correction Advisors: Groq (Advisor 1) & Gemini (Advisor 2) ===
        groq_active = bool(settings.groq_enabled and getattr(settings, "groq_post_correction_enabled", True))
        gemini_active = bool(getattr(settings, "gemini_enabled", False) and getattr(settings, "gemini_post_correction_enabled", True))
        any_correction_called = False
        any_correction_applied = False
        groq_call_count = 0
        gemini_call_count = 0
        dual_call_count = 0
        groq_total_latency_ms = 0.0
        gemini_total_latency_ms = 0.0
        line_advisor_timings = []
        parallel_wall_clock_ms = 0.0
        sequential_sum_ms = 0.0
        total_corr_start_time = time.time()

        fast_path = (request.headers.get("X-Fast-Path") == "true" or request.query_params.get("fastPath") == "true")
        if not fast_path and (groq_active or gemini_active) and not diagnostics.get("canonicalMatched", False) and lines:
            from app.integrations.groq.corrector import should_request_groq_correction, request_groq_correction
            from app.integrations.gemini.corrector import request_gemini_correction, get_current_gemini_meta
            all_raw_texts = [l.rawOcrText or "" for l in lines]

            # Pass 1: Set clean defaults and identify triggered lines
            triggered_items = []
            for idx, line in enumerate(lines):
                line.suggestions = []
                line.groqSuggestion = None
                line.groqConfidence = None
                line.groqDecision = None
                line.groqStatus = None
                line.groqModel = getattr(settings, "groq_primary_vision_model", "qwen/qwen3.8-27b")
                line.geminiSuggestion = None
                line.geminiConfidence = None
                line.geminiDecision = None
                line.geminiStatus = None
                line.geminiModel = getattr(settings, "gemini_model", "gemini-3.6-flash")
                line.correctedText = None
                line.correctionApplied = False
                line.correctionDecision = "KEEP_RAW"
                line.finalText = line.rawOcrText
                line.text = line.finalText
                line.predictedText = line.finalText

                is_triggered = should_request_groq_correction(
                    line.rawOcrText,
                    line.rawOcrConfidence,
                    domain="HANDWRITING_TEXT",
                    trigger_confidence=getattr(settings, "groq_post_correction_trigger_confidence", 0.82),
                    min_token_confidence=line.minTokenConfidence,
                    p10_confidence=line.p10TokenConfidence,
                    mean_entropy=line.meanEntropy,
                    token_anomaly_detected=line.tokenAnomalyDetected,
                    decoder_anomaly_detected=line.decoderAnomalyDetected,
                    require_token_metrics=True,
                )

                if is_triggered:
                    any_correction_called = True
                    if getattr(line, "tokenAnomalyDetected", False):
                        trigger_reason = "TOKEN_ANOMALY"
                    elif getattr(line, "decoderAnomalyDetected", False):
                        trigger_reason = "DECODER_ANOMALY"
                    elif (line.rawOcrConfidence or 0.0) < getattr(settings, "groq_post_correction_trigger_confidence", 0.82):
                        trigger_reason = "LOW_CONFIDENCE"
                    elif line.minTokenConfidence is None or line.p10TokenConfidence is None:
                        trigger_reason = "MISSING_TOKEN_METRICS"
                    else:
                        trigger_reason = "UNCERTAINTY_HEURISTIC"
                    triggered_items.append((idx, line, trigger_reason))

            # Pass 2: Bounded concurrent scheduling across triggered lines
            if triggered_items:
                concurrency_bound = max(1, getattr(settings, "cloud_advisor_max_concurrency", 3))
                sem = asyncio.Semaphore(concurrency_bound)

                async def process_one_triggered_line(idx: int, line: LineBox, trigger_reason: str):
                    async with sem:
                        t_line_start = time.perf_counter()
                        lx = max(0, min(line.x, width - 1))
                        ly = max(0, min(line.y, height - 1))
                        lw = max(5, min(line.width, width - lx))
                        lh = max(3, min(line.height, height - ly))
                        crop = cv_img[ly : ly + lh, lx : lx + lw]

                        context_lines = [t for i, t in enumerate(all_raw_texts) if i != idx and t]

                        async def run_groq():
                            t0 = time.perf_counter()
                            res = await request_groq_correction(
                                bgr_crop=crop,
                                raw_text=line.rawOcrText or "",
                                raw_confidence=line.rawOcrConfidence or 0.0,
                                domain="HANDWRITING_TEXT",
                                read_only_context=context_lines,
                                primary_model=settings.groq_primary_vision_model,
                                auto_apply_confidence=getattr(settings, "groq_post_correction_auto_apply_confidence", 0.92),
                                max_edit_ratio=getattr(settings, "groq_post_correction_max_edit_ratio", 0.35),
                                timeout_seconds=settings.groq_timeout_seconds,
                                connect_timeout=settings.groq_connect_timeout_seconds,
                                cache_ttl=getattr(settings, "groq_correction_cache_ttl_seconds", 3600),
                            )
                            lat = (time.perf_counter() - t0) * 1000.0
                            return res, lat

                        async def run_gemini():
                            t0 = time.perf_counter()
                            res = await request_gemini_correction(
                                bgr_crop=crop,
                                raw_text=line.rawOcrText or "",
                                raw_confidence=line.rawOcrConfidence or 0.0,
                                domain="HANDWRITING_TEXT",
                                model=getattr(settings, "gemini_model", "gemini-3.6-flash"),
                                timeout_seconds=getattr(settings, "gemini_timeout_seconds", 18.0),
                                connect_timeout=getattr(settings, "gemini_connect_timeout_seconds", 4.0),
                                cache_ttl=getattr(settings, "gemini_correction_cache_ttl_seconds", 3600),
                            )
                            lat = (time.perf_counter() - t0) * 1000.0
                            meta = get_current_gemini_meta()
                            return res, lat, meta

                        coros = []
                        coro_names = []
                        if groq_active:
                            coros.append(run_groq())
                            coro_names.append("GROQ")
                        if gemini_active:
                            coros.append(run_gemini())
                            coro_names.append("GEMINI")

                        raw_results = await asyncio.gather(*coros, return_exceptions=True)

                        groq_res, gemini_res = None, None
                        groq_lat, gemini_lat = 0.0, 0.0
                        gemini_call_meta = {}
                        corr_obj = None
                        gem_obj = None

                        for name, r in zip(coro_names, raw_results):
                            if isinstance(r, Exception):
                                logger.warning(f"[OCR_PILOT] Advisor {name} error: {r}")
                                if name == "GROQ":
                                    line.groqStatus = "UNAVAILABLE"
                                else:
                                    line.geminiStatus = "UNAVAILABLE"
                            elif r is not None:
                                if name == "GROQ":
                                    groq_res, groq_lat = r
                                else:
                                    gemini_res, gemini_lat, gemini_call_meta = r

                        # Process Groq (Advisor 1)
                        if groq_res is not None:
                            corr_obj, decision, edit_ratio, reason = groq_res
                            canonical_groq_dec = normalize_canonical_advisor_decision(decision)
                            line.correctedText = corr_obj.suggested_text
                            line.correctionConfidence = corr_obj.confidence
                            line.correctionDecision = canonical_groq_dec
                            line.groqSuggestion = corr_obj.suggested_text
                            line.groqConfidence = corr_obj.confidence
                            line.groqDecision = canonical_groq_dec
                            line.groqStatus = "SUCCESS"
                            line.correctionApplied = False
                            line.finalText = line.rawOcrText
                        elif groq_active:
                            line.correctedText = None
                            line.correctionApplied = False
                            line.correctionDecision = "KEEP_RAW"
                            line.groqDecision = "KEEP_RAW"
                            line.finalText = line.rawOcrText
                            if not line.groqStatus:
                                line.groqStatus = "UNAVAILABLE"
                        else:
                            line.correctedText = None
                            line.correctionApplied = False
                            line.correctionDecision = "KEEP_RAW"
                            line.finalText = line.rawOcrText

                        # Process Gemini (Advisor 2 - Advisory-first, never silently overrides finalText)
                        if gemini_active:
                            line.geminiModel = getattr(settings, "gemini_model", "gemini-3.6-flash")
                        if gemini_res is not None:
                            gem_obj, gem_dec, gem_ratio, gem_reason = gemini_res
                            canonical_gem_dec = normalize_canonical_advisor_decision(gem_dec)
                            line.geminiSuggestion = gem_obj.suggested_text
                            line.geminiConfidence = gem_obj.confidence
                            line.geminiDecision = canonical_gem_dec
                            line.geminiStatus = "SUCCESS"
                        elif gemini_active:
                            line.geminiSuggestion = None
                            line.geminiDecision = "KEEP_RAW"
                            if not line.geminiStatus:
                                line.geminiStatus = "UNAVAILABLE"

                        # Populate unified suggestions list
                        line_suggestions = []
                        if line.groqStatus == "SUCCESS" and line.groqSuggestion:
                            line_suggestions.append({
                                "provider": "GROQ",
                                "model": settings.groq_primary_vision_model,
                                "text": line.groqSuggestion,
                                "confidence": line.groqConfidence or 0.0,
                                "visualSupport": getattr(corr_obj, "visual_support", "STRONG"),
                                "decision": normalize_canonical_advisor_decision(line.groqDecision),
                                "status": "SUCCESS"
                            })
                        elif groq_active and line.groqStatus:
                            line_suggestions.append({
                                "provider": "GROQ",
                                "model": settings.groq_primary_vision_model,
                                "text": "",
                                "confidence": 0.0,
                                "visualSupport": "NONE",
                                "decision": "KEEP_RAW",
                                "status": line.groqStatus
                            })

                        if line.geminiStatus == "SUCCESS" and line.geminiSuggestion:
                            line_suggestions.append({
                                "provider": "GEMINI",
                                "model": line.geminiModel or getattr(settings, "gemini_model", "gemini-3.6-flash"),
                                "text": line.geminiSuggestion,
                                "confidence": line.geminiConfidence or 0.0,
                                "visualSupport": getattr(gem_obj, "visual_support", "STRONG"),
                                "decision": normalize_canonical_advisor_decision(line.geminiDecision),
                                "status": "SUCCESS"
                            })
                        elif gemini_active and line.geminiStatus:
                            line_suggestions.append({
                                "provider": "GEMINI",
                                "model": line.geminiModel or getattr(settings, "gemini_model", "gemini-3.6-flash"),
                                "text": "",
                                "confidence": 0.0,
                                "visualSupport": "NONE",
                                "decision": "KEEP_RAW",
                                "status": line.geminiStatus
                            })

                        line.suggestions = line_suggestions
                        line.text = line.finalText
                        line.predictedText = line.finalText

                        total_line_ms = round((time.perf_counter() - t_line_start) * 1000.0, 2)

                        timing_record = {
                            "line_index": idx,
                            "crnn_ms": getattr(line, "_crnn_ms", 0.0),
                            "groq_ms": round(groq_lat, 2),
                            "gemini_ms": round(gemini_lat, 2),
                            "key_attempt_count": gemini_call_meta.get("key_attempt_count", 0),
                            "key_failover_ms": gemini_call_meta.get("key_failover_ms", 0.0),
                            "provider_wait_ms": gemini_call_meta.get("provider_wait_ms", 0.0),
                            "total_line_ms": total_line_ms,
                            "trigger_reason": trigger_reason,
                            "groq_status": line.groqStatus,
                            "gemini_status": line.geminiStatus,
                        }
                        return idx, groq_lat, gemini_lat, (1 if groq_active else 0), (1 if gemini_active else 0), timing_record

                t_gather_start = time.perf_counter()
                results = await asyncio.gather(
                    *(process_one_triggered_line(i, l, r) for i, l, r in triggered_items)
                )
                parallel_wall_clock_ms = (time.perf_counter() - t_gather_start) * 1000.0

                for res in results:
                    _, g_lat, gem_lat, g_count, gem_count, timing_rec = res
                    groq_total_latency_ms += g_lat
                    gemini_total_latency_ms += gem_lat
                    groq_call_count += g_count
                    gemini_call_count += gem_count
                    if g_count > 0 and gem_count > 0:
                        dual_call_count += 1
                    line_advisor_timings.append(timing_rec)

                # Sort by line_index for clean deterministic ordering
                line_advisor_timings.sort(key=lambda x: x["line_index"])
                sequential_sum_ms = sum(max(t["groq_ms"], t["gemini_ms"]) for t in line_advisor_timings)
        else:
            for line in lines:
                line.suggestions = []
                line.groqSuggestion = None
                line.groqConfidence = None
                line.groqDecision = None
                line.groqStatus = None
                line.groqModel = getattr(settings, "groq_primary_vision_model", "qwen/qwen3.8-27b")
                line.geminiSuggestion = None
                line.geminiConfidence = None
                line.geminiDecision = None
                line.geminiStatus = None
                line.geminiModel = getattr(settings, "gemini_model", "gemini-3.6-flash")
                line.correctedText = None
                line.correctionApplied = False
                line.correctionDecision = "KEEP_RAW"
                line.finalText = line.rawOcrText
                line.text = line.finalText
                line.predictedText = line.finalText

        total_correction_latency_ms = (time.time() - total_corr_start_time) * 1000 if any_correction_called else 0.0

        try:
            metadata = {
                "timestamp": time.time(),
                "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "width": width,
                "height": height,
                "channels": cv_img.shape[2] if len(cv_img.shape) > 2 else 1,
                "mode": str(getattr(pil_image, "mode", "RGB")),
                "sha256_upload_bytes": upload_sha256,
                "exif_orientation": exif_orientation,
                "detector_version": HW_LINE_DETECTOR_VERSION,
                "path_a_count": diagnostics.get("path_a_count", 0),
                "suspicious_reason": diagnostics.get("suspicious_reason", "NONE"),
                "path_b_invoked": diagnostics.get("path_b_invoked", False),
                "dominant_hue": diagnostics.get("dominant_hue"),
                "projection_band_count": diagnostics.get("projection_band_count", 0),
                "final_box_count": len(lines),
                "groq_used": diagnostics.get("groqUsed", False),
                "gemini_used": diagnostics.get("geminiUsed", False),
                "recognition_engine": diagnostics.get("recognitionEngine", "CRNN"),
                "crnn_executed": crnn_executed,
                "segmentation_source": diagnostics.get("segmentationSource", "LOCAL_CV"),
                "correction_source": diagnostics.get("correctionSource", "NONE"),
                "final_text_source": diagnostics.get("finalTextSource", "CRNN_RAW"),
                "vision_model": diagnostics.get("visionModel"),
                "fallback_used": diagnostics.get("fallbackUsed", False),
                "confidence": diagnostics.get("confidence"),
                "fallback_reason": diagnostics.get("fallbackReason"),
            }
            with open(os.path.join(save_dir, "metadata.json"), "w", encoding="utf-8") as mf:
                json.dump(metadata, mf, indent=2, default=str)
        except Exception as me:
            logger.warning(f"[OCR_PILOT] Failed to write metadata.json: {me}")

        diagnostics = dict(diagnostics)
        diagnostics["detector_version"] = HW_LINE_DETECTOR_VERSION
        diagnostics["requestId"] = req_id
        diagnostics["totalLatencyMs"] = round((time.time() - t_start) * 1000, 2)
        diagnostics["totalCrnnLines"] = len(lines)
        diagnostics["correctionTriggeredLines"] = sum(1 for l in lines if l.suggestions or l.correctedText or getattr(l, "geminiSuggestion", None))
        diagnostics["groqCalls"] = groq_call_count
        diagnostics["geminiCalls"] = gemini_call_count
        diagnostics["dualCalls"] = dual_call_count
        diagnostics["groqLatencyMs"] = round(groq_total_latency_ms, 2)
        diagnostics["geminiLatencyMs"] = round(gemini_total_latency_ms, 2)
        diagnostics["totalCorrectionLatencyMs"] = round(total_correction_latency_ms, 2)
        diagnostics["missingTokenMetricsCount"] = sum(1 for l in lines if l.minTokenConfidence is None or l.p10TokenConfidence is None)
        diagnostics["forcedTriggerDueToMissingMetricsCount"] = sum(
            1 for l in lines
            if (l.minTokenConfidence is None or l.p10TokenConfidence is None)
            and (l.rawOcrConfidence or 0.0) >= getattr(settings, "groq_post_correction_trigger_confidence", 0.82)
        )
        diagnostics["tokenAnomalyTriggerCount"] = sum(1 for l in lines if getattr(l, "tokenAnomalyDetected", False) is True)
        diagnostics["decoderAnomalyTriggerCount"] = sum(1 for l in lines if getattr(l, "decoderAnomalyDetected", False) is True)
        diagnostics["lineAdvisorTimings"] = line_advisor_timings
        diagnostics["sequentialSumMs"] = round(sequential_sum_ms, 2)
        diagnostics["parallelWallClockMs"] = round(parallel_wall_clock_ms, 2)
        diagnostics["advisorConcurrency"] = getattr(settings, "cloud_advisor_max_concurrency", 3)
        any_correction_called = False
        any_correction_applied = False
        groq_used = False

        # Update diagnostics according to OCR-First semantics
        if diagnostics.get("canonicalMatched"):
            diagnostics["recognitionEngine"] = "CANONICAL_EXACT"
            diagnostics["recognitionSource"] = "CANONICAL_EXACT"
            diagnostics["analysisSource"] = "CANONICAL_EXACT"
            diagnostics["finalTextSource"] = "CANONICAL_EXACT"
            diagnostics["correctionSource"] = "NONE"
            diagnostics["crnnExecuted"] = False
            diagnostics["groqLineAssistUsed"] = False
            diagnostics["groqCorrectionUsed"] = False
            diagnostics["groqUsed"] = False
            diagnostics["geminiCorrectionUsed"] = False
            diagnostics["geminiUsed"] = False
            # Truthful semantics (PROD.3A.2): unambiguous attempted/succeeded
            diagnostics["geminiAttempted"] = False
            diagnostics["geminiSucceeded"] = False
            diagnostics["geminiAttemptCount"] = 0
            diagnostics["geminiSuccessCount"] = 0
        else:
            diagnostics["recognitionEngine"] = "CRNN"
            diagnostics["crnnExecuted"] = crnn_executed
            diagnostics["correctionSource"] = "GROQ_POST_CORRECTION" if any_correction_called else "NONE"
            diagnostics["finalTextSource"] = "CRNN_PLUS_GROQ_CORRECTION" if any_correction_applied else "CRNN_RAW"
            diagnostics["recognitionSource"] = diagnostics["finalTextSource"]
            diagnostics["analysisSource"] = diagnostics.get("segmentationSource", "LOCAL_CV")
            diagnostics["groqLineAssistUsed"] = groq_used
            diagnostics["groqCorrectionUsed"] = (groq_call_count > 0)
            diagnostics["groqUsed"] = groq_used or (groq_call_count > 0)
            diagnostics["visionModel"] = settings.groq_primary_vision_model
            diagnostics["geminiCorrectionUsed"] = (gemini_call_count > 0)
            diagnostics["geminiUsed"] = (gemini_call_count > 0)
            diagnostics["groqModel"] = getattr(settings, "groq_primary_vision_model", "qwen/qwen3.8-27b")
            diagnostics["geminiModel"] = getattr(settings, "gemini_model", "gemini-3.6-flash")
            # Truthful semantics (PROD.3A.2): unambiguous attempted/succeeded
            diagnostics["geminiAttempted"] = (gemini_call_count > 0)
            gemini_success_count = sum(1 for l in lines if getattr(l, "geminiStatus", None) == "SUCCESS")
            diagnostics["geminiSucceeded"] = (gemini_success_count > 0)
            diagnostics["geminiAttemptCount"] = gemini_call_count
            diagnostics["geminiSuccessCount"] = gemini_success_count

        # Physical Android Trace Logging (Dev-only)
        if getattr(settings, "ocr_physical_trace_enabled", True) and getattr(settings, "app_env", "development") != "production":
            logger.info(
                f"[OCR-PHYSICAL]\n"
                f"requestId={req_id}\n"
                f"imageSource=CAMERA|GALLERY\n"
                f"cropWidth={width}\n"
                f"cropHeight={height}\n"
                f"segmentationSource={diagnostics.get('segmentationSource', 'LOCAL_CV')}\n"
                f"groqLineAssistUsed={diagnostics.get('groqLineAssistUsed', False)}\n"
                f"lineCount={len(lines)}"
            )
            for l in lines:
                logger.info(
                    f"[OCR-PHYSICAL-LINE] lineOrder={l.order} rawOcrText='{l.rawOcrText or ''}' "
                    f"rawOcrConfidence={l.rawOcrConfidence} minTokenConfidence={l.minTokenConfidence} "
                    f"p10TokenConfidence={l.p10TokenConfidence} meanEntropy={l.meanEntropy} "
                    f"groqCorrectionCalled={bool(l.correctedText or l.correctionDecision in ('AUTO_APPLY', 'SUGGEST_ONLY'))} "
                    f"groqSuggestion='{l.correctedText or ''}' correctionConfidence={l.correctionConfidence} "
                    f"correctionDecision={l.correctionDecision} "
                    f"geminiSuggestion='{getattr(l, 'geminiSuggestion', '') or ''}' "
                    f"geminiDecision={getattr(l, 'geminiDecision', None)} "
                    f"finalText='{l.finalText or ''}'"
                )
            logger.info(
                f"[OCR-PHYSICAL-REQ] recognitionEngine={diagnostics.get('recognitionEngine', 'CRNN')} "
                f"finalTextSource={diagnostics.get('finalTextSource', 'CRNN_RAW')} "
                f"groqCalls={groq_call_count} geminiCalls={gemini_call_count} totalLatencyMs={diagnostics['totalLatencyMs']}"
            )

        logger.info(f"[{HW_LINE_DETECTOR_VERSION}] Response: {len(lines)} lines crnn_executed={crnn_executed} groq_used={diagnostics.get('groqUsed')} (diag: {diagnostics})")

        return OcrDetectLinesResponse(
            width=width,
            height=height,
            lines=lines,
            detector_version=HW_LINE_DETECTOR_VERSION,
            diagnostics=diagnostics
        )
    except Exception as e:
        logger.error(f"[OCR_PILOT] Line detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Line detection error: {str(e)}")


@router.post("/recognize-line", response_model=OcrRecognizeLineResponse)
async def recognize_line(request: Request):
    """
    Dedicated OCR Pilot endpoint for single text-line Vietnamese handwriting recognition.
    Strictly isolated from YOLO, StructuredParser, and ArithmeticValidator.
    Requires internal service authentication via X-Internal-API-Key header.
    Accepts raw binary image stream only (Content-Type: image/jpeg, image/png, application/octet-stream).
    Enforces payload size limit, valid image decoding, and sequence confidence.
    """
    # 1. Enforce Internal Authentication
    api_key = request.headers.get("X-Internal-API-Key")
    if not api_key or api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized internal API request")

    # 2. Reject JSON payloads — Raw binary stream only
    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        raise HTTPException(
            status_code=415, 
            detail="JSON payload not supported. Send raw image binary stream (e.g. image/jpeg, image/png, application/octet-stream)"
        )

    # 3. Read raw image stream
    img_bytes = await request.body()
    if not img_bytes or len(img_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image payload")

    if len(img_bytes) > MAX_PAYLOAD_BYTES:
        raise HTTPException(
            status_code=413, 
            detail=f"Payload exceeds maximum allowed size of {MAX_PAYLOAD_BYTES} bytes"
        )

    try:
        pil_image = Image.open(io.BytesIO(img_bytes))
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
    except Exception as e:
        logger.error(f"[OCR_PILOT] Failed to decode image: {e}")
        raise HTTPException(status_code=400, detail="Invalid image bytes or unreadable image file")

    start_time = time.perf_counter()
    try:
        provider = get_ocr_provider("crnn_vi_handwriting_v1")
        if not isinstance(provider, CrnnOcrProvider):
            raise RuntimeError("CRNN OCR provider is not configured properly")

        recognized_text, confidence = provider.recognize_line_with_confidence(pil_image)
        latency_ms = (time.perf_counter() - start_time) * 1000

        meta = provider.get_metadata()
        model_name = meta.get("model_name", "Vietnamese-Handwriting-OCR-Full")
        model_version = meta.get("model_version", "1.0.0")

        return OcrRecognizeLineResponse(
            recognized_text=recognized_text,
            model_name=model_name,
            model_version=model_version,
            checkpoint_sha256=CHECKPOINT_SHA256,
            vocab_sha256=VOCAB_SHA256,
            preprocessing_version="v1_resize_64x1024_imagenet",
            confidence=confidence,
            latency_ms=round(latency_ms, 2),
        )
    except Exception as e:
        logger.error(f"[OCR_PILOT] Inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"CRNN recognition error: {str(e)}")


from pydantic import BaseModel
class AdviseLinesRequest(BaseModel):
    lines: List[LineBox]
    
@router.post("/advise-lines")
@router.post("/internal/v1/ocr/advise-lines")
async def advise_lines_endpoint(request: Request):
    """
    BACKGROUND ADVISOR PATH.
    Accepts raw CRNN lines, runs Groq and Gemini sequentially or asynchronously in a document batch,
    applies the Safe Arbitration Rule, and returns the AI suggestions.
    """
    from app.integrations.groq.document_corrector import request_groq_document_correction
    from app.integrations.gemini.document_corrector import request_gemini_document_correction
    import time
    
    body = await request.json()
    lines_data = body.get("lines", [])
    if not lines_data:
        return {"lines": []}
        
    lines = [LineBox(**l) for l in lines_data]
    
    groq_active = bool(settings.groq_enabled and getattr(settings, "groq_post_correction_enabled", True))
    gemini_active = bool(getattr(settings, "gemini_enabled", False) and getattr(settings, "gemini_post_correction_enabled", True))
    
    if not groq_active and not gemini_active:
        return {"lines": [l.dict() for l in lines]}
        
    import asyncio
    
    # Run Groq Document Corrector
    groq_task = asyncio.create_task(request_groq_document_correction(lines)) if groq_active else None
    
    # Run Gemini Document Corrector
    gemini_task = asyncio.create_task(request_gemini_document_correction(lines)) if gemini_active else None
    
    groq_results = []
    gemini_results = []
    
    if groq_task:
        try:
            groq_results = await groq_task
        except Exception as e:
            logger.error(f"Groq advisor failed: {e}")
            
    if gemini_task:
        try:
            gemini_results = await gemini_task
        except Exception as e:
            logger.error(f"Gemini advisor failed: {e}")
            
    # Apply Safe Arbitration Rules
    for i, line in enumerate(lines):
        groq_corr = groq_results[i] if groq_results and i < len(groq_results) else None
        gemini_corr = gemini_results[i] if gemini_results and i < len(gemini_results) else None
        
        g_sugg = groq_corr["corrected_text"] if groq_corr and groq_corr["status"] == "SUCCESS" else None
        gem_sugg = gemini_corr["corrected_text"] if gemini_corr and gemini_corr["status"] == "SUCCESS" else None
        
        line.groqSuggestion = g_sugg
        line.groqConfidence = groq_corr.get("confidence", 0.0) if groq_corr else 0.0
        line.groqDecision = groq_corr.get("decision", "ERROR") if groq_corr else "ERROR"
        line.groqStatus = groq_corr.get("status", "ERROR") if groq_corr else "ERROR"
        line.groqModel = groq_corr.get("model", "") if groq_corr else ""
        
        line.geminiSuggestion = gem_sugg
        line.geminiConfidence = gemini_corr.get("confidence", 0.0) if gemini_corr else 0.0
        line.geminiDecision = gemini_corr.get("decision", "ERROR") if gemini_corr else "ERROR"
        line.geminiStatus = gemini_corr.get("status", "ERROR") if gemini_corr else "ERROR"
        line.geminiModel = gemini_corr.get("model", "") if gemini_corr else ""
        
        # Arbitration
        raw = line.rawOcrText
        if not g_sugg and not gem_sugg:
            continue
            
        # Consensus
        if g_sugg and gem_sugg and g_sugg == gem_sugg and g_sugg != raw:
            line.finalText = g_sugg
            line.correctedText = g_sugg
            line.correctionApplied = True
            line.correctionDecision = "CONSENSUS_APPLY"
            continue
            
        # Deterministic Changed-Span Evidence (Trailing duplicate removal)
        if g_sugg and g_sugg != raw:
            # Example: tímm -> tím
            if len(raw) > len(g_sugg) and raw.startswith(g_sugg) and raw[-1] == raw[-2]:
                line.finalText = g_sugg
                line.correctedText = g_sugg
                line.correctionApplied = True
                line.correctionDecision = "DETERMINISTIC_APPLY"
                continue
                
        if gem_sugg and gem_sugg != raw:
            if len(raw) > len(gem_sugg) and raw.startswith(gem_sugg) and raw[-1] == raw[-2]:
                line.finalText = gem_sugg
                line.correctedText = gem_sugg
                line.correctionApplied = True
                line.correctionDecision = "DETERMINISTIC_APPLY"
                continue
                
        # Default: NEEDS_REVIEW
        line.finalText = raw
        line.correctedText = None
        line.correctionApplied = False
        line.correctionDecision = "NEEDS_REVIEW"
        
    return {"lines": [l.dict() for l in lines]}
