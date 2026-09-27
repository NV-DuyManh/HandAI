"""
Scale-adaptive deterministic spatial row grouping for MathVision Kids.
Converts unordered YOLO token detections into ordered horizontal row groups.
"""
from typing import List, Optional, Tuple, Dict, Any, Union
from dataclasses import dataclass, field
import statistics
import logging

from app.schemas.core import Token

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RowGroupingConfig:
    """
    Configurable thresholds for scale-adaptive spatial row grouping.
    All geometry thresholds are scale-adaptive ratios relative to median token height.
    """
    # Factor of median token height used for vertical center distance tolerance
    vertical_center_tolerance_factor: float = 0.55

    # Minimum vertical center tolerance in normalized coordinates (prevents collapse on tiny detections)
    min_vertical_tolerance: float = 0.03

    # Minimum vertical overlap ratio between token and row to allow merging
    min_vertical_overlap_ratio: float = 0.30

    # Vertical distance factor (relative to median height) above which a carry marker c1 is kept separate
    carry_separate_height_ratio: float = 0.50

    # Proportional horizontal padding factor for crop bounding box (fraction of median token height)
    crop_padding_x_factor: float = 0.20

    # Proportional vertical padding factor for crop bounding box (fraction of median token height)
    crop_padding_y_factor: float = 0.15

    # Minimum crop dimension in pixels to be valid
    min_crop_dimension_px: int = 4


@dataclass
class RowGroup:
    """
    A single horizontal line group of tokens with spatial bounding box and text representation.
    """
    row_index: int
    bbox: List[float]  # [x, y, w, h] normalized [0, 1]
    tokens: List[Token] = field(default_factory=list)
    yolo_text: str = ""
    token_count: int = 0
    is_eligible_for_ocr: bool = True
    has_carry: bool = False
    is_carry_only: bool = False
    is_separator_only: bool = False
    pixel_bbox: Optional[Tuple[int, int, int, int]] = None
    crop_bbox: Optional[Tuple[int, int, int, int]] = None


class RowGrouper:
    """
    Deterministic scale-adaptive spatial row grouper.
    Guarantees:
    - Input-order independence: identical grouping regardless of token list permutation.
    - Scale-adaptive clustering: thresholds adapt to detected token dimensions.
    - Safe carry handling: small carry markers (c1) above columns are not merged if doing so breaks row geometry.
    - Precise left-to-right token ordering within each row.
    """

    def __init__(self, config: Optional[RowGroupingConfig] = None):
        self.config = config or RowGroupingConfig()

    @staticmethod
    def _is_valid_bbox(bbox: Any) -> bool:
        """Checks if a bounding box [x, y, w, h] is geometrically valid and non-degenerate."""
        if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
            return False
        try:
            x, y, w, h = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
            # Must be finite, non-negative, and have positive area
            if w <= 0.0 or h <= 0.0:
                return False
            if x < 0.0 or y < 0.0 or x > 1.0 or y > 1.0:
                # Slight tolerance for edge touching
                if x > 1.05 or y > 1.05:
                    return False
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _compute_vertical_overlap_ratio(
        y1_a: float, y2_a: float, y1_b: float, y2_b: float
    ) -> float:
        """Computes vertical overlap ratio relative to the smaller interval."""
        overlap = max(0.0, min(y2_a, y2_b) - max(y1_a, y1_b))
        h_a = max(1e-6, y2_a - y1_a)
        h_b = max(1e-6, y2_b - y1_b)
        min_h = min(h_a, h_b)
        return overlap / min_h if min_h > 0 else 0.0

    def group(
        self,
        tokens: List[Token],
        img_w: Optional[int] = None,
        img_h: Optional[int] = None,
    ) -> List[RowGroup]:
        """
        Groups detected tokens into ordered horizontal rows.

        Args:
            tokens: Unordered list of Token objects from detector.
            img_w: Optional original image width in pixels.
            img_h: Optional original image height in pixels.

        Returns:
            List of RowGroup objects ordered vertically top-to-bottom.
        """
        # 1. Filter valid tokens with positive-area bboxes
        valid_tokens = [t for t in tokens if self._is_valid_bbox(t.boundingBox)]
        if not valid_tokens:
            return []

        # 2. Guarantee input-order independence: sort deterministically before clustering
        # Sort key: (y_center rounded to 4 decimals, x_center rounded to 4 decimals, value, tokenId)
        sorted_tokens = sorted(
            valid_tokens,
            key=lambda t: (
                round(t.boundingBox[1] + t.boundingBox[3] / 2.0, 4),
                round(t.boundingBox[0] + t.boundingBox[2] / 2.0, 4),
                str(t.value),
                str(t.tokenId),
            ),
        )

        # 3. Calculate scale-adaptive signals
        heights = [t.boundingBox[3] for t in sorted_tokens if t.boundingBox[3] > 0]
        median_h = statistics.median(heights) if heights else 0.05
        tolerance = max(
            self.config.min_vertical_tolerance,
            median_h * self.config.vertical_center_tolerance_factor,
        )

        # 4. Separate carry markers (c1) from standard tokens
        # Carry markers sitting high above digit columns should not pull down or corrupt the main operand row
        regular_tokens: List[Token] = []
        carry_tokens: List[Token] = []
        for t in sorted_tokens:
            if getattr(t, "tokenClass", None) == "carry":
                carry_tokens.append(t)
            else:
                regular_tokens.append(t)

        # 5. Cluster regular tokens into horizontal rows
        # Intermediate row representation: list of tokens
        clustered_rows: List[List[Token]] = []

        for t in regular_tokens:
            t_y_center = t.boundingBox[1] + t.boundingBox[3] / 2.0
            t_y1 = t.boundingBox[1]
            t_y2 = t_y1 + t.boundingBox[3]

            best_row_idx = None
            best_dist = float("inf")

            for idx, r_tokens in enumerate(clustered_rows):
                r_y_centers = [tok.boundingBox[1] + tok.boundingBox[3] / 2.0 for tok in r_tokens]
                r_y_center = sum(r_y_centers) / len(r_y_centers)
                dist = abs(t_y_center - r_y_center)

                r_y1 = min(tok.boundingBox[1] for tok in r_tokens)
                r_y2 = max(tok.boundingBox[1] + tok.boundingBox[3] for tok in r_tokens)
                v_overlap = self._compute_vertical_overlap_ratio(t_y1, t_y2, r_y1, r_y2)

                # Token belongs to row if center distance is within tolerance or strong vertical overlap
                if dist <= tolerance or v_overlap >= self.config.min_vertical_overlap_ratio:
                    if dist < best_dist:
                        best_dist = dist
                        best_row_idx = idx

            if best_row_idx is not None:
                clustered_rows[best_row_idx].append(t)
            else:
                clustered_rows.append([t])

        # 6. Handle carry markers (c1)
        # Evaluate whether each carry marker can be merged or forms a dedicated annotation row
        for c in carry_tokens:
            c_y_center = c.boundingBox[1] + c.boundingBox[3] / 2.0
            c_y1 = c.boundingBox[1]
            c_y2 = c_y1 + c.boundingBox[3]

            best_row_idx = None
            best_dist = float("inf")

            for idx, r_tokens in enumerate(clustered_rows):
                r_y_centers = [tok.boundingBox[1] + tok.boundingBox[3] / 2.0 for tok in r_tokens]
                r_y_center = sum(r_y_centers) / len(r_y_centers)
                dist = abs(c_y_center - r_y_center)

                r_y1 = min(tok.boundingBox[1] for tok in r_tokens)
                r_y2 = max(tok.boundingBox[1] + tok.boundingBox[3] for tok in r_tokens)
                v_overlap = self._compute_vertical_overlap_ratio(c_y1, c_y2, r_y1, r_y2)

                # Strict carry check: only merge if center distance is small and not high above
                # If carry is higher than operand by > carry_separate_height_ratio * median_h, keep separate
                is_high_annotation = (r_y1 - c_y2) > 0.0 or (r_y_center - c_y_center) > (
                    self.config.carry_separate_height_ratio * median_h
                )

                if not is_high_annotation and (
                    dist <= tolerance * 0.8 or v_overlap >= self.config.min_vertical_overlap_ratio
                ):
                    if dist < best_dist:
                        best_dist = dist
                        best_row_idx = idx

            if best_row_idx is not None:
                clustered_rows[best_row_idx].append(c)
            else:
                # Forms dedicated carry annotation row
                clustered_rows.append([c])

        # 7. Sort rows vertically top-to-bottom by row center y
        def row_sort_key(r_tokens: List[Token]) -> Tuple[float, float]:
            avg_y = sum(tok.boundingBox[1] + tok.boundingBox[3] / 2.0 for tok in r_tokens) / len(r_tokens)
            min_x = min(tok.boundingBox[0] for tok in r_tokens)
            return (round(avg_y, 4), round(min_x, 4))

        clustered_rows.sort(key=row_sort_key)

        # 8. Build final RowGroup objects
        row_groups: List[RowGroup] = []

        for row_idx, r_tokens in enumerate(clustered_rows):
            # Sort tokens strictly left-to-right by x coordinate
            tokens_sorted = sorted(
                r_tokens,
                key=lambda tok: (
                    round(tok.boundingBox[0], 4),
                    round(tok.boundingBox[1], 4),
                    str(tok.value),
                ),
            )

            # Compute normalized union bounding box
            min_x = max(0.0, min(tok.boundingBox[0] for tok in tokens_sorted))
            min_y = max(0.0, min(tok.boundingBox[1] for tok in tokens_sorted))
            max_x = min(1.0, max(tok.boundingBox[0] + tok.boundingBox[2] for tok in tokens_sorted))
            max_y = min(1.0, max(tok.boundingBox[1] + tok.boundingBox[3] for tok in tokens_sorted))

            union_w = max(0.001, max_x - min_x)
            union_h = max(0.001, max_y - min_y)
            bbox_norm = [round(min_x, 4), round(min_y, 4), round(union_w, 4), round(union_h, 4)]

            # Construct YOLO text: concatenate left-to-right token values
            # Digits, operators, separators form natural reading text
            yolo_text = "".join(str(tok.value) for tok in tokens_sorted)

            # Classify tokens
            token_classes = set(getattr(tok, "tokenClass", "digit") for tok in tokens_sorted)
            has_carry = "carry" in token_classes
            is_carry_only = token_classes == {"carry"}
            is_separator_only = token_classes == {"separator"}

            # Eligibility for CRNN OCR:
            # - Must have tokens
            # - Must not be carry-only (small auxiliary dot/1 is not a full text line)
            # - Must not be separator-only (e.g. horizontal equals bar)
            # - Must contain digits or operators
            has_text_content = any(
                getattr(tok, "tokenClass", "") in ("digit", "operator") for tok in tokens_sorted
            )
            is_eligible = (not is_carry_only) and (not is_separator_only) and has_text_content

            # Compute pixel bounding box and padded crop if dimensions provided
            pixel_bbox = None
            crop_bbox = None

            if img_w is not None and img_h is not None and img_w > 0 and img_h > 0:
                px1 = int(round(min_x * img_w))
                py1 = int(round(min_y * img_h))
                px2 = int(round(max_x * img_w))
                py2 = int(round(max_y * img_h))
                pixel_bbox = (px1, py1, px2, py2)

                # Proportional padding based on median token height
                pad_x = int(round(median_h * img_h * self.config.crop_padding_x_factor))
                pad_y = int(round(median_h * img_h * self.config.crop_padding_y_factor))

                cx1 = max(0, px1 - pad_x)
                cy1 = max(0, py1 - pad_y)
                cx2 = min(img_w, px2 + pad_x)
                cy2 = min(img_h, py2 + pad_y)

                # Crop dimension safety: ensure positive dimensions
                if (cx2 - cx1) >= self.config.min_crop_dimension_px and (
                    cy2 - cy1
                ) >= self.config.min_crop_dimension_px:
                    crop_bbox = (cx1, cy1, cx2, cy2)
                else:
                    crop_bbox = pixel_bbox

            group = RowGroup(
                row_index=row_idx,
                bbox=bbox_norm,
                tokens=tokens_sorted,
                yolo_text=yolo_text,
                token_count=len(tokens_sorted),
                is_eligible_for_ocr=is_eligible,
                has_carry=has_carry,
                is_carry_only=is_carry_only,
                is_separator_only=is_separator_only,
                pixel_bbox=pixel_bbox,
                crop_bbox=crop_bbox,
            )
            row_groups.append(group)

        return row_groups
