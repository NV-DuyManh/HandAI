import cv2
import numpy as np
from typing import List, Tuple
from app.schemas.ocr_pilot import LineBox

def score_and_assign_rows(
    primary: List[dict],
    satellite: List[dict], 
    ambiguous: List[dict],
    global_bands: List[Tuple[int, int]],
    median_h: float
) -> Tuple[List[dict], List[dict]]:
    """
    Step 6: Row Assignment
    Assign components to row proposals using a score based on distance, overlap, mass.
    Returns (assigned_rows, unassigned_components).
    An assigned_row is a dict: {"band": (y1, y2), "components": [], "box": (x,y,w,h)}
    """
    assigned_rows = [{"band": b, "components": [], "box": None} for b in global_bands]
    unassigned = []
    
    all_comps = primary + satellite + ambiguous
    
    for comp in all_comps:
        x, y, w, h = comp["x"], comp["y"], comp["w"], comp["h"]
        c_y = y + h / 2.0
        
        best_band_idx = -1
        best_score = -99999.0
        
        for idx, row in enumerate(assigned_rows):
            b_start, b_end = row["band"]
            b_c_y = (b_start + b_end) / 2.0
            b_h = max(1, b_end - b_start)
            
            v_overlap = max(0, min(y + h, b_end) - max(y, b_start))
            overlap_ratio = v_overlap / max(1, h)
            dist = abs(c_y - b_c_y)
            score = (overlap_ratio * 100.0) - (dist / median_h * 15.0)
            if score > best_score and dist < max(35.0, median_h * 3.5):
                best_score = score
                best_band_idx = idx
                
        if best_band_idx >= 0 and best_score > -50.0:
            assigned_rows[best_band_idx]["components"].append(comp)
        else:
            unassigned.append(comp)
            
    # Compute bounding boxes for each row based on assigned components
    final_rows = []
    for row in assigned_rows:
        if not row["components"]:
            continue
        min_x = min(c["x"] for c in row["components"])
        min_y = min(c["y"] for c in row["components"])
        max_x = max(c["x"] + c["w"] for c in row["components"])
        max_y = max(c["y"] + c["h"] for c in row["components"])
        row["box"] = (min_x, min_y, max_x - min_x, max_y - min_y)
        
        # Check if the row has any primary evidence
        has_primary = any(c in primary for c in row["components"])
        row["has_primary"] = has_primary
        
        final_rows.append(row)
        
    return final_rows, unassigned

def compute_strong_body_bands(binary_mask: np.ndarray, median_h: float, w: int, h: int, thresh_multiplier: float = 0.015) -> List[Tuple[int, int]]:
    # Exact same logic used in global proposal but specifically for a crop (splitting)
    ink_per_row = np.sum(binary_mask > 0, axis=1)
    smooth_window = max(3, int(median_h * 0.4))
    smoothed_proj = np.convolve(ink_per_row, np.ones(smooth_window) / smooth_window, mode='same')
    
    strong_thresh = max(10.0, w * thresh_multiplier)
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
    if in_band and (h - start_y) >= min_band_h:
        strong_bands.append((start_y, h))
        
    merged = []
    for b in strong_bands:
        if not merged:
            merged.append(b)
        else:
            if b[0] - merged[-1][1] <= max(12, int(median_h * 1.2)):
                merged[-1] = (merged[-1][0], b[1])
            else:
                merged.append(b)
    return merged

def recursive_split_merged_rows(box: Tuple[int, int, int, int], binary_mask: np.ndarray, median_h: float) -> List[Tuple[int, int, int, int]]:
    """
    Step 7: Merged-Row Splitting
    """
    x, y, w, h = box
    if h < median_h * 1.5:
        return [box]
        
    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(binary_mask.shape[1], x + w), min(binary_mask.shape[0], y + h)
    crop = binary_mask[y1:y2, x1:x2]
    
    best_bands = []
    # Iterative water-level splitting: start with high thresholds to find dominant rows
    # A text band should span a significant portion of the width. 0.05 means 5% of width.
    for multiplier in [0.05, 0.08, 0.12, 0.15, 0.20]:
        bands = compute_strong_body_bands(crop, median_h, w, h, thresh_multiplier=multiplier)
        if len(bands) >= 2:
            best_bands = bands
            break
            
    if not best_bands:
        return [box]
        
    bands = best_bands
        
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
        
        child_box = (x1 + c_min, c_y_offset + r_min, c_max - c_min + 1, r_max - r_min + 1)
        
        children.extend(recursive_split_merged_rows(child_box, binary_mask, median_h))
        
    return children if children else [box]

def verify_primary_body_requirement(box: Tuple[int, int, int, int], binary_mask: np.ndarray, median_h: float) -> bool:
    """
    Step 9: Primary-Body Requirement for Standalone Rows
    """
    x, y, w, h = box
    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(binary_mask.shape[1], x + w), min(binary_mask.shape[0], y + h)
    crop = binary_mask[y1:y2, x1:x2]
    ink = cv2.countNonZero(crop)
    
    if w >= max(60.0, median_h * 2.8) and ink >= max(90, int(median_h * 4.5)):
        return True
    if ink >= max(160, int(median_h * 8.0)):
        return True
    if h >= max(10.0, median_h * 0.5) and ink >= max(35, int(median_h * 1.8)) and w >= max(15.0, median_h * 0.8):
        return True
    return False

def filter_and_merge_residual_false_lines(
    boxes: List[Tuple[int, int, int, int]], 
    binary_mask: np.ndarray, 
    median_h: float, 
    img_h: int, 
    img_w: int
) -> List[Tuple[int, int, int, int]]:
    """
    Step 9b: Multi-Signal Residual False-Line Pruning and Diacritic Absorption.
    1. Merges detached accent/satellite strips into neighboring parent rows.
    2. Drops thin top/bottom edge noise strips and ruler fragments without character bodies.
    3. Preserves legitimate short rows (such as single words or exercise numbers).
    """
    if not boxes or len(boxes) <= 1:
        return boxes

    # 1. Sort top-to-bottom
    sorted_boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    
    # Effective row height from detected candidate boxes to prevent graph-paper noise from skewing median_h down
    median_row_h = float(np.median([b[3] for b in sorted_boxes])) if sorted_boxes else median_h
    eff_median_h = max(median_h, median_row_h)
    
    # Precompute box properties
    box_props = []
    for b in sorted_boxes:
        x, y, w, h = b
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(img_w, x + w), min(img_h, y + h)
        crop = binary_mask[y1:y2, x1:x2] if (x2 > x1 and y2 > y1) else np.zeros((1, 1), dtype=np.uint8)
        ink = int(cv2.countNonZero(crop))
        
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(crop, connectivity=8)
        max_comp_h = 0
        max_comp_w = 0
        comp_count = 0
        for lbl in range(1, num_labels):
            cw = int(stats[lbl, cv2.CC_STAT_WIDTH])
            ch = int(stats[lbl, cv2.CC_STAT_HEIGHT])
            carea = int(stats[lbl, cv2.CC_STAT_AREA])
            if carea >= 4:
                comp_count += 1
                if ch > max_comp_h:
                    max_comp_h = ch
                if cw > max_comp_w:
                    max_comp_w = cw
                    
        fill_ratio = ink / max(1, w * h)
        is_thin = h < (eff_median_h * 0.45)
        has_weak_body = max_comp_h < (eff_median_h * 0.32)
        near_top = y <= max(15, int(img_h * 0.03))
        near_bottom = (y + h) >= (img_h - max(15, int(img_h * 0.03)))
        
        is_sparse = (ink / max(1, w)) < 1.0 and comp_count <= 4
        
        box_props.append({
            "box": list(b),
            "ink": ink,
            "fill_ratio": fill_ratio,
            "comp_count": comp_count,
            "max_comp_h": max_comp_h,
            "max_comp_w": max_comp_w,
            "is_thin": is_thin,
            "has_weak_body": has_weak_body,
            "is_sparse": is_sparse,
            "near_boundary": near_top or near_bottom,
            "dropped": False
        })
        
    # Pass 0: Deduplicate / absorb nested boxes (one inside another)
    for i in range(len(box_props)):
        if box_props[i]["dropped"]:
            continue
        bx, by, bw, bh = box_props[i]["box"]
        for j in range(len(box_props)):
            if i == j or box_props[j]["dropped"]:
                continue
            tx, ty, tw, th = box_props[j]["box"]
            v_ov = max(0, min(by + bh, ty + th) - max(by, ty))
            if v_ov > 0:
                h_ov = max(0, min(bx + bw, tx + tw) - max(bx, tx))
                h_overlap_ratio = h_ov / max(1, min(bw, tw))
                # If box i is >= 70% vertically inside box j and substantially horizontally aligned
                if v_ov / max(1, bh) >= 0.70 and h_overlap_ratio > 0.50:
                    box_props[j]["box"] = [
                        min(bx, tx), min(by, ty),
                        max(bx + bw, tx + tw) - min(bx, tx),
                        max(by + bh, ty + th) - min(by, ty)
                    ]
                    box_props[i]["dropped"] = True
                    break

    # Phase A: Merge satellites/accents/halves into adjacent legitimate rows
    # Bounded by stroke/character median height (median_h), NOT the full line box height
    max_satellite_gap = max(35.0, median_h * 2.2)
    max_legit_line_h = max(75.0, median_row_h * 1.6)
    for i in range(len(box_props)):
        p = box_props[i]
        if p["dropped"]:
            continue
        if p["is_thin"] or p["has_weak_body"] or p["is_sparse"]:
            bx, by, bw, bh = p["box"]
            # Find closest adjacent neighbor
            best_target_idx = -1
            min_gap = 999999.0
            
            # Check row above
            if i - 1 >= 0 and not box_props[i-1]["dropped"]:
                tx, ty, tw, th = box_props[i-1]["box"]
                v_gap = by - (ty + th)
                h_overlap = max(0, min(bx + bw, tx + tw) - max(bx, tx))
                combined_h = max(by + bh, ty + th) - min(by, ty)
                if -max_satellite_gap <= v_gap <= max_satellite_gap and h_overlap > 0 and combined_h <= max_legit_line_h:
                    if abs(v_gap) < min_gap:
                        min_gap = abs(v_gap)
                        best_target_idx = i - 1

            # Check row below
            if i + 1 < len(box_props) and not box_props[i+1]["dropped"]:
                tx, ty, tw, th = box_props[i+1]["box"]
                v_gap = ty - (by + bh)
                h_overlap = max(0, min(bx + bw, tx + tw) - max(bx, tx))
                combined_h = max(by + bh, ty + th) - min(by, ty)
                if -max_satellite_gap <= v_gap <= max_satellite_gap and h_overlap > 0 and combined_h <= max_legit_line_h:
                    if abs(v_gap) < min_gap:
                        min_gap = abs(v_gap)
                        best_target_idx = i + 1

            if best_target_idx >= 0:
                target = box_props[best_target_idx]
                tx, ty, tw, th = target["box"]
                combined_h = max(by + bh, ty + th) - min(by, ty)
                target["box"] = [min(bx, tx), min(by, ty), max(bx + bw, tx + tw) - min(bx, tx), combined_h]
                p["dropped"] = True

    # Phase B: Drop remaining isolated false-positive strips
    surviving = []
    for p in box_props:
        if p["dropped"]:
            continue
        bx, by, bw, bh = p["box"]
        # Near boundary artifacts: drop if thin, weak body, or low ink
        if p["near_boundary"] and (p["is_thin"] or p["has_weak_body"] or p["ink"] < max(20, int(eff_median_h * 2.0))):
            continue
        # Thin strips without character body (ruler line fragment or border noise)
        if (bh < eff_median_h * 0.45 and p["has_weak_body"]) or (p["is_thin"] and p["has_weak_body"]):
            continue
        # Very low ink and no distinct character stroke
        if p["ink"] < max(20, int(eff_median_h * 1.3)) and p["max_comp_h"] < (eff_median_h * 0.32):
            continue
        # Near-solid UI blocks / buttons / cards (not text, text has fill < 0.35)
        if p["fill_ratio"] > 0.55 and (bw * bh) > 600:
            continue

        # Empty UI containers / card frames: wide box with very low component density and low ink fill
        comp_density = p["comp_count"] / max(1.0, bw / 100.0)
        if bw > max(150, int(eff_median_h * 3.0)) and comp_density < 2.0 and p["fill_ratio"] < 0.05:
            continue
            
        # Top-edge status bar / header band (touching top edge with high fill or thin strip)
        if by <= max(5, int(img_h * 0.015)) and (p["fill_ratio"] > 0.40 or bh < 30):
            continue

        surviving.append(tuple(p["box"]))
        
    # Phase C: Merge vertically split halves of the same line (e.g. upper/lower halves separated by ruling)
    sorted_surviving = sorted(surviving, key=lambda b: b[1])
    changed = True
    while changed:
        changed = False
        new_boxes = []
        skip = set()
        for i in range(len(sorted_surviving)):
            if i in skip:
                continue
            b1 = sorted_surviving[i]
            x1, y1, w1, h1 = b1
            for j in range(i + 1, len(sorted_surviving)):
                if j in skip:
                    continue
                b2 = sorted_surviving[j]
                x2, y2, w2, h2 = b2
                
                v_gap = y2 - (y1 + h1)
                combined_h = max(y1 + h1, y2 + h2) - min(y1, y2)
                width_ratio = min(w1, w2) / max(1, max(w1, w2))
                x_aligned = abs(x1 - x2) <= max(20, int(median_h * 1.5))
                
                if width_ratio >= 0.80 and x_aligned:
                    if -max(25.0, median_h * 2.5) <= v_gap <= max(12.0, median_h * 1.5) and combined_h <= max(75.0, median_h * 2.0):
                        nx = min(x1, x2)
                        ny = min(y1, y2)
                        nw = max(x1 + w1, x2 + w2) - nx
                        nh = combined_h
                        b1 = (nx, ny, nw, nh)
                        skip.add(j)
                        changed = True
            new_boxes.append(b1)
        sorted_surviving = new_boxes

    return sorted_surviving

def get_body_center(b: Tuple[int, int, int, int], binary_mask: np.ndarray) -> float:
    x, y, w, h = b
    crop = binary_mask[max(0,y):min(binary_mask.shape[0],y+h), max(0,x):min(binary_mask.shape[1],x+w)]
    row_proj = np.sum(crop > 0, axis=1)
    total_ink = np.sum(row_proj)
    if total_ink == 0:
        return float(y + h / 2.0)
    com = np.sum(np.arange(crop.shape[0]) * row_proj) / total_ink
    return float(y + com)

def consolidate_fragments(boxes: List[Tuple[int, int, int, int]], binary_mask: np.ndarray, median_h: float) -> List[Tuple[int, int, int, int]]:
    """
    Step 8: Same-Row Consolidation (post-split)
    Merge fragmented boxes that clearly belong to the same line.
    """
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    changed = True
    while changed:
        changed = False
        new_boxes = []
        skip = set()
        for i in range(len(boxes)):
            if i in skip: continue
            b1 = boxes[i]
            x1, y1, w1, h1 = b1
            c1_y = get_body_center(b1, binary_mask)
            
            for j in range(i + 1, len(boxes)):
                if j in skip: continue
                b2 = boxes[j]
                x2, y2, w2, h2 = b2
                c2_y = get_body_center(b2, binary_mask)
                
                v_gap = max(0, max(y1, y2) - min(y1+h1, y2+h2))
                h_gap = max(0, max(x1, x2) - min(x1+w1, x2+w2))
                v_overlap = max(0, min(y1+h1, y2+h2) - max(y1, y2))
                h_overlap = max(0, min(x1+w1, x2+w2) - max(x1, x2))
                
                center_dist = abs(c1_y - c2_y)
                
                # MERGE GATE MUST BE STRICTER: Require small body-center distance
                should_merge = False
                if center_dist <= max(15.0, median_h * 1.5):
                    if v_overlap / max(1, min(h1, h2)) >= 0.4 and h_gap <= max(40.0, median_h * 4.0):
                        should_merge = True
                    elif v_gap <= max(15.0, median_h * 1.5) and h_overlap > 0:
                        should_merge = True
                        
                        # Do not merge two independent full-width lines
                        if w1 > median_h * 15 and w2 > median_h * 15 and v_overlap / max(1, min(h1, h2)) < 0.3:
                            should_merge = False

                        
                if should_merge:
                    nx, ny = min(x1, x2), min(y1, y2)
                    nw = max(x1+w1, x2+w2) - nx
                    nh = max(y1+h1, y2+h2) - ny
                    b1 = (nx, ny, nw, nh)
                    x1, y1, w1, h1 = b1
                    c1_y = get_body_center(b1, binary_mask)
                    skip.add(j)
                    changed = True
            new_boxes.append(b1)
        boxes = sorted(new_boxes, key=lambda b: (b[1], b[0]))
    return boxes

def compute_structural_quality(line_results: List[LineBox], global_bands: List[Tuple[int, int]], ink_coverage: float, median_h: float, img_h: int = 0, img_w: int = 0) -> float:
    score = 100.0
    
    # Penalty for coverage
    if ink_coverage < 0.8:
        score -= (0.8 - ink_coverage) * 50
        
    # Box to band ratio penalty (e.g. 11 boxes for 4 bands)
    if len(global_bands) > 0:
        ratio = len(line_results) / max(1, len(global_bands))
        if ratio > 1.25:
            score -= (ratio - 1.25) * 60  # Steeper penalty for over-segmentation
        elif ratio < 0.8:
            score -= (1.0 - ratio) * 50
    
    # Penalty for extremely short boxes (likely thin strips)
    short_count = sum(1 for b in line_results if b.height < median_h * 0.5)
    score -= short_count * 20
    
    # Penalty for vertically overlapping boxes (improper split / over-segmentation)
    overlap_count = 0
    for i in range(len(line_results)):
        for j in range(i + 1, len(line_results)):
            b1, b2 = line_results[i], line_results[j]
            v_overlap = max(0, min(b1.y + b1.height, b2.y + b2.height) - max(b1.y, b2.y))
            min_h = max(1, min(b1.height, b2.height))
            if v_overlap / min_h > 0.35:
                overlap_count += 1
    if overlap_count > 0:
        score -= overlap_count * 25.0

    # Penalty for content spanning an unusually large fraction of the image.
    # Only applies to tall images (mobile screenshots) where keyboard contamination is likely.
    # Short/wide images (cropped handwriting) are excluded.
    is_tall_mobile = img_h > 600 and img_w > 0 and (img_h / max(1, img_w)) > 1.3
    if is_tall_mobile and len(line_results) >= 2:
        min_y = min(b.y for b in line_results)
        max_y_bottom = max(b.y + b.height for b in line_results)
        content_span = (max_y_bottom - min_y) / img_h
        if content_span > 0.80:
            score -= (content_span - 0.80) * 200.0
        
    # Penalty for collapsed / excessively tall boxes (e.g. giant UI containers / keyboard blocks)
    tall_limit = max(200, int(img_h * 0.40)) if is_tall_mobile else max(150, int(img_h * 0.50))
    tall_boxes = [b for b in line_results if b.height > tall_limit]
    if tall_boxes:
        score -= len(tall_boxes) * 40.0
        
    return max(0.0, score)

def _run_single_profile(bgr_image: np.ndarray, height: int, width: int, max_lines: int, profile: str) -> Tuple[List[LineBox], dict, float, np.ndarray, float]:
    from app.api.generalized import extract_ink_mask, compute_global_row_proposals, classify_components
    final_mask, chromatic_mask = extract_ink_mask(bgr_image, height, width, profile=profile)
    
    if cv2.countNonZero(final_mask) < 20:
        return [], {}, 0.0, final_mask, 15.0
        
    raw_cnts, _ = cv2.findContours(final_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    char_cnts = [cv2.boundingRect(c)[3] for c in raw_cnts if cv2.contourArea(c) >= 20 and cv2.boundingRect(c)[3] >= 8]
    heights = [cv2.boundingRect(c)[3] for c in raw_cnts if cv2.contourArea(c) > 5]
    median_h = float(np.median(char_cnts)) if char_cnts else (float(np.median(heights)) if heights else 15.0)
    
    global_bands = compute_global_row_proposals(final_mask, median_h)
    primary, satellite, noise, ambiguous = classify_components(final_mask, global_bands, median_h)
    
    assigned_rows, unassigned = score_and_assign_rows(primary, satellite, ambiguous, global_bands, median_h)
    
    candidate_boxes = [r["box"] for r in assigned_rows if r["box"] is not None]
    
    # Profile-specific fragment consolidation tweaks can be applied here if needed.
    # For now, rely on ink mask differences.
    consolidated = consolidate_fragments(candidate_boxes, final_mask, median_h)
    
    # Store original bounding boxes for distance checks to prevent chain reaction
    original_consolidated = list(consolidated)
    
    for comp in unassigned:
        sx, sy, sw, sh = comp["x"], comp["y"], comp["w"], comp["h"]
        best_p_idx = -1
        best_dist = 999999.0
        for p_idx, b in enumerate(original_consolidated):
            px, py, pw, ph = b
            v_gap = max(0, max(py, sy) - min(py + ph, sy + sh))
            h_overlap = max(0, min(px + pw, sx + sw) - max(px, sx))
            h_gap = max(0, max(px, sx) - min(px + pw, sx + sw))
            
            # Robust satellite attachment threshold: v_gap <= max(30.0, median_h * 2.5)
            if v_gap <= max(30.0, median_h * 2.5) and (h_overlap > 0 or h_gap <= max(35.0, median_h * 2.5)):
                dist = v_gap + h_gap * 0.5
                if dist < best_dist:
                    best_dist = dist
                    best_p_idx = p_idx
        if best_p_idx >= 0:
            p = consolidated[best_p_idx]
            nx, ny = min(p[0], sx), min(p[1], sy)
            nw = max(p[0] + p[2], sx + sw) - nx
            nh = max(p[1] + p[3], sy + sh) - ny
            consolidated[best_p_idx] = (nx, ny, nw, nh)

    final_split_boxes = []
    for b in consolidated:
        final_split_boxes.extend(recursive_split_merged_rows(b, final_mask, median_h))
    consolidated = consolidate_fragments(final_split_boxes, final_mask, median_h)
    
    final_boxes = []
    for b in consolidated:
        if verify_primary_body_requirement(b, final_mask, median_h):
            final_boxes.append(b)
            
    final_boxes = filter_and_merge_residual_false_lines(final_boxes, final_mask, median_h, height, width)

    # Prune detached bottom UI / keyboard blocks in mobile screenshots:
    # A massive vertical gap (>35% image height) separating content from full-width (>85% width) bottom elements.
    if len(final_boxes) >= 2 and height > 400:
        sorted_for_gap = sorted(final_boxes, key=lambda b: b[1])
        chrome_start_y = None
        for gi in range(1, len(sorted_for_gap)):
            prev_bottom = sorted_for_gap[gi - 1][1] + sorted_for_gap[gi - 1][3]
            curr_top = sorted_for_gap[gi][1]
            curr_w = sorted_for_gap[gi][2]
            gap = curr_top - prev_bottom
            # A massive vertical gap (>35% image height) separating top content from bottom UI buttons / controls (>60% width)
            if gap > (height * 0.35) and curr_top > (height * 0.60) and curr_w > (width * 0.60):
                chrome_start_y = curr_top
                break
        if chrome_start_y is not None:
            final_boxes = [b for b in final_boxes if b[1] < chrome_start_y]
            
    unassigned_ink = sum(c["ink"] for c in unassigned)
    total_ink = cv2.countNonZero(final_mask)
    ink_coverage = (total_ink - unassigned_ink) / max(1, total_ink)
    
    sorted_final = sorted(final_boxes, key=lambda b: (b[1], b[0]))
    if len(sorted_final) > max_lines:
        sorted_final = sorted_final[:max_lines]
        
    line_results = [
        LineBox(line_id=f"line_{idx}", x=int(b[0]), y=int(b[1]), width=int(b[2]), height=int(b[3]), order=idx)
        for idx, b in enumerate(sorted_final, 1)
    ]
    
    quality_score = compute_structural_quality(line_results, global_bands, ink_coverage, median_h, img_h=height, img_w=width)
    
    needs_review = False
    if ink_coverage < 0.20 or (len(global_bands) > 0 and len(line_results) > len(global_bands) * 2):
        needs_review = True
    if ink_coverage < 0.5:
        needs_review = True
    if len(ambiguous) + len(noise) > max(20, len(primary) * 3):
        needs_review = True
    if quality_score < 85.0:
        needs_review = True
        
    diag = {
        "bands_detected": len(global_bands),
        "ink_coverage_ratio": float(ink_coverage),
        "needs_review": needs_review,
        "structural_quality": float(quality_score)
    }
    
    return line_results, diag, quality_score, final_mask, median_h

_DETECTION_RUN_CACHE: dict = {}

def find_inner_ui_cards(img: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Detects inner UI cards / dialog frames in mobile screenshots.
    Uses contour analysis, geometric positioning, and bounding area.
    """
    if img is None or img.size == 0:
        return []
    h, w = img.shape[:2]
    if h < 500 or (h / max(1, w)) < 1.3:
        return []
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    cnts, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    ui_cards = []
    for c in cnts:
        rx, ry, rw, rh = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        if ry > 120 and rw > w * 0.40 and rh > h * 0.25 and area > (w * h * 0.10):
            aspect = rw / max(1, rh)
            if 0.3 <= aspect <= 2.5:
                ui_cards.append((rx, ry, rw, rh))
    return ui_cards

def clear_detection_cache():
    _DETECTION_RUN_CACHE.clear()


def _detect_chromatic_projection_rows(
    bgr_image: np.ndarray,
    median_h: float,
    max_lines: int,
) -> List[LineBox]:
    """Recover densely spaced blue/violet-ink rows from horizontal projection peaks."""
    height, width = bgr_image.shape[:2]
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    saturated = (saturation > 25) & (value < 235)
    candidate_hues = hue[saturated]
    if candidate_hues.size < 100:
        return []

    histogram = cv2.calcHist([candidate_hues], [0], None, [180], [0, 180]).ravel()
    dominant_hue = int(np.argmax(histogram))
    if not 80 <= dominant_hue <= 155:
        return []
    delta = np.minimum((hue.astype(np.int16) - dominant_hue) % 180, (dominant_hue - hue.astype(np.int16)) % 180)
    chromatic_mask = ((delta <= 25) & saturated).astype(np.uint8)

    row_projection = chromatic_mask.sum(axis=1).astype(np.float64)
    smooth_window = max(5, int(round(median_h * 0.5)))
    if smooth_window % 2 == 0:
        smooth_window += 1
    smoothed = np.convolve(row_projection, np.ones(smooth_window) / smooth_window, mode="same")
    peak_floor = max(width * 0.015, float(np.percentile(smoothed, 90)) * 0.25)
    radius = max(2, int(round(median_h * 0.25)))
    candidates = [
        y for y in range(radius, height - radius)
        if smoothed[y] >= peak_floor and smoothed[y] == np.max(smoothed[y - radius:y + radius + 1])
    ]

    min_distance = max(18, int(round(median_h * 1.7)))
    peaks: List[int] = []
    for y in sorted(candidates, key=lambda item: smoothed[item], reverse=True):
        if all(abs(y - selected) >= min_distance for selected in peaks):
            peaks.append(y)
        if len(peaks) >= max_lines:
            break
    peaks.sort()
    if len(peaks) < 2:
        return []

    gaps = np.diff(peaks)
    typical_gap = float(np.median(gaps))
    if typical_gap < max(12.0, median_h * 1.1) or float(np.max(gaps)) > typical_gap * 2.5:
        return []

    half_height = max(int(round(median_h * 1.4)), int(round(typical_gap * 0.62)))
    rows: List[LineBox] = []
    for peak in peaks:
        y1, y2 = max(0, peak - half_height), min(height, peak + half_height + 1)
        ink_columns = np.flatnonzero(np.any(chromatic_mask[y1:y2] > 0, axis=0))
        if ink_columns.size == 0:
            continue
        x1 = max(0, int(ink_columns[0]) - 8)
        x2 = min(width, int(ink_columns[-1]) + 9)
        if x2 - x1 < max(30, int(median_h * 2.0)):
            continue
        rows.append(LineBox(
            line_id=f"line_{len(rows) + 1}",
            x=x1,
            y=y1,
            width=x2 - x1,
            height=y2 - y1,
            order=len(rows) + 1,
        ))
    return rows


def run_generalized_line_detection(
    bgr_image: np.ndarray,
    max_lines: int = 30,
    force_redetect: bool = False,
    request_id: str = None
) -> Tuple[List[LineBox], dict]:
    """
    The General Handwriting Line Segmentation Pipeline with Canonical Bypass,
    caching, and True Re-detect Quality Safety.
    """
    import hashlib
    import uuid

    if bgr_image is None or bgr_image.size == 0:
        return [], {
            "detector_version": "generalized-20260914",
            "cacheHit": False,
            "detectionRunId": str(uuid.uuid4()),
            "requestId": request_id or str(uuid.uuid4()),
            "final_box_count": 0
        }

    img_hash = hashlib.sha256(bgr_image.tobytes()).hexdigest()

    if not force_redetect and img_hash in _DETECTION_RUN_CACHE:
        cached = _DETECTION_RUN_CACHE[img_hash]
        lines = [LineBox(line_id=b.line_id, x=b.x, y=b.y, width=b.width, height=b.height, order=b.order) for b in cached["lines"]]
        diag = dict(cached["diag"])
        diag["cacheHit"] = True
        diag["detectionRunId"] = cached["run_id"]
        if request_id:
            diag["requestId"] = request_id
        return lines, diag

    from app.canonical.matcher import CanonicalMatcher
    from app.canonical.row_localizer import localize_rows
    from app.api.ocr import correct_skew
    from app.config import settings

    current_run_id = str(uuid.uuid4())

    # Check Canonical Matching ONLY if explicitly enabled (demoted from production default in GROQ.5)
    if getattr(settings, "canonical_runtime_override_enabled", False):
        matcher = CanonicalMatcher()
        matched_fixture = matcher.match(bgr_image)
        if matched_fixture:
            boxes = localize_rows(bgr_image, matched_fixture)
            diag = {
                "detector_version": "canonical-exact-20260916",
                "canonicalMatched": True,
                "fixtureId": matched_fixture.fixture_id,
                "canonicalConfidence": 1.0,
                "recognitionSource": "CANONICAL_EXACT",
                "final_box_count": len(boxes),
                "cacheHit": False,
                "detectionRunId": current_run_id,
                "requestId": request_id or str(uuid.uuid4())
            }
            _DETECTION_RUN_CACHE[img_hash] = {
                "lines": boxes,
                "diag": diag,
                "score": 100.0,
                "run_id": current_run_id,
                "requestId": request_id,
            }
            return boxes, diag

    bgr_image = correct_skew(bgr_image, max_angle=10.0)
    height, width = bgr_image.shape[:2]

    # 1. Run Default Profile (PROFILE_A)
    best_lines, best_diag, best_score, best_mask, best_median_h = _run_single_profile(bgr_image, height, width, max_lines, "PROFILE_A")
    best_profile = "PROFILE_A"

    # 2. Check if Suspicious
    suspicious = best_diag.get("needs_review", False) or best_score < 90.0

    # 3. Deterministic Fallback if Suspicious
    if suspicious:
        for fallback_profile in ["PROFILE_B", "PROFILE_C"]:
            f_lines, f_diag, f_score, f_mask, f_median_h = _run_single_profile(bgr_image, height, width, max_lines, fallback_profile)
            if f_score > best_score:
                best_score = f_score
                best_lines = f_lines
                best_diag = f_diag
                best_mask = f_mask
                best_median_h = f_median_h
                best_profile = fallback_profile

    projection_lines = _detect_chromatic_projection_rows(bgr_image, best_median_h, max_lines)
    if len(projection_lines) > len(best_lines):
        best_lines = projection_lines
        best_score = max(best_score, 95.0)
        best_diag["chromatic_projection_used"] = True
        best_diag["chromatic_projection_count"] = len(projection_lines)

    # 4. Final Formatting (Midpoint-Bounded Safe Padding)
    # Sort strictly by vertical center of mass (centerY) to guarantee correct reading order
    sorted_candidates = sorted(best_lines, key=lambda b: (b.y + b.height / 2.0))
    
    padded_boxes = []
    for idx, b in enumerate(sorted_candidates):
        curr_cy = b.y + b.height / 2.0
        pad_x = max(5, int(b.width * 0.02))
        pad_y = max(4, int(b.height * 0.08))
        
        # Upper midpoint bound
        if idx > 0:
            prev_cy = sorted_candidates[idx - 1].y + sorted_candidates[idx - 1].height / 2.0
            mid_prev = (prev_cy + curr_cy) / 2.0
            safe_top = max(0, int(mid_prev - 6))
            yp = max(safe_top, b.y - pad_y)
        else:
            yp = max(0, b.y - pad_y)
            
        # Lower midpoint bound
        if idx < len(sorted_candidates) - 1:
            next_cy = sorted_candidates[idx + 1].y + sorted_candidates[idx + 1].height / 2.0
            mid_next = (curr_cy + next_cy) / 2.0
            safe_bottom = min(height, int(mid_next + 6))
            btm_p = min(safe_bottom, b.y + b.height + pad_y)
        else:
            btm_p = min(height, b.y + b.height + pad_y)
            
        xp = max(0, b.x - pad_x)
        wp = min(width - xp, b.width + 2 * pad_x)
        hp = max(10, btm_p - yp)
        padded_boxes.append((xp, yp, wp, hp))

    padded_boxes.sort(key=lambda b: (b[1] + b[3] / 2.0))

    final_line_results = []
    for idx, b in enumerate(padded_boxes, 1):
        final_line_results.append(LineBox(
            line_id=f"line_{idx}",
            x=int(b[0]),
            y=int(b[1]),
            width=int(b[2]),
            height=int(b[3]),
            order=idx
        ))

    # Mobile UI chrome / inner dialog card suppression:
    cards = find_inner_ui_cards(bgr_image)
    if cards:
        card_top = min(c[1] for c in cards)
        pruned_lines = [l for l in final_line_results if (l.y + l.height * 0.5) < card_top]
        if len(pruned_lines) > 0:
            final_line_results = [
                LineBox(line_id=f"line_{idx}", x=l.x, y=l.y, width=l.width, height=l.height, order=idx)
                for idx, l in enumerate(pruned_lines, 1)
            ]
            best_diag["inner_ui_card_pruned"] = True

    # True Re-detect Quality Safety (Section 10)
    # If force_redetect is active and previous standard run had a high quality score (>= 80),
    # but the retry produces a worse/lower score, the system MUST preserve the better STANDARD result.
    if force_redetect and img_hash in _DETECTION_RUN_CACHE:
        previous = _DETECTION_RUN_CACHE[img_hash]
        if previous["score"] >= 80.0 and best_score < previous["score"]:
            lines = [LineBox(line_id=b.line_id, x=b.x, y=b.y, width=b.width, height=b.height, order=b.order) for b in previous["lines"]]
            diag = dict(previous["diag"])
            diag["cacheHit"] = False
            diag["forceRedetect"] = True
            diag["detectionRunId"] = current_run_id
            diag["previousRunId"] = previous["run_id"]
            diag["qualitySelection"] = "PRESERVED_SUPERIOR_STANDARD"
            if request_id:
                diag["requestId"] = request_id
            return lines, diag

    best_diag["detector_version"] = "generalized-20260914"
    best_diag["selected_profile"] = best_profile
    best_diag["final_box_count"] = len(final_line_results)
    best_diag["path_a_suspicious"] = suspicious
    best_diag["path_b_invoked"] = False
    best_diag["path_a_count"] = len(final_line_results)
    best_diag["cacheHit"] = False
    best_diag["detectionRunId"] = current_run_id
    best_diag["forceRedetect"] = force_redetect
    if request_id:
        best_diag["requestId"] = request_id
    if force_redetect and img_hash in _DETECTION_RUN_CACHE:
        best_diag["qualitySelection"] = "ACCEPTED_RETRY"

    _DETECTION_RUN_CACHE[img_hash] = {
        "lines": final_line_results,
        "diag": best_diag,
        "score": best_score,
        "run_id": current_run_id,
        "requestId": request_id,
    }

    return final_line_results, best_diag
