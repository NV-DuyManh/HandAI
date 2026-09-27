"""
YOLOv8 Runtime Adapter for MathVision Kids.

Converts raw YOLO detection boxes and class predictions into canonical Token objects
and ImageRecognitionResult consumable by StructuredParser and the deterministic validator.

Rules:
- Explicit label mapping: 14 classes (0..9, +, -, =, c1).
- EXPLICIT_BORROW_MARK_RECOGNITION: NOT_SUPPORTED_BY_MODEL.
- Normalized bounding boxes: [x, y, width, height], top-left origin, [0, 1].
- Row (0=top, 1=bottom, 2=result) and Column (0=units, 1=tens, descending left-to-right) assignment.
- Confidence mapping: raw YOLO confidence maps to token recognition confidence.
- Ambiguity: confidence < ambiguity_threshold marks token ambiguity = True.
"""

from typing import List, Dict, Any, Optional, Tuple
import uuid
import logging
from app.schemas.core import Token, ImageRecognitionResult

logger = logging.getLogger(__name__)

# Explicit class mapping from AI team label map (mathvision_det_v1.0)
LABEL_MAP_14 = {
    0: {"value": "0", "tokenClass": "digit"},
    1: {"value": "1", "tokenClass": "digit"},
    2: {"value": "2", "tokenClass": "digit"},
    3: {"value": "3", "tokenClass": "digit"},
    4: {"value": "4", "tokenClass": "digit"},
    5: {"value": "5", "tokenClass": "digit"},
    6: {"value": "6", "tokenClass": "digit"},
    7: {"value": "7", "tokenClass": "digit"},
    8: {"value": "8", "tokenClass": "digit"},
    9: {"value": "9", "tokenClass": "digit"},
    10: {"value": "+", "tokenClass": "operator"},
    11: {"value": "-", "tokenClass": "operator"},
    12: {"value": "=", "tokenClass": "separator"},
    13: {"value": "1", "tokenClass": "carry"},  # c1 (nhớ 1)
}

# Explicit declaration: Model does not have a borrow mark class
EXPLICIT_BORROW_MARK_RECOGNITION = "NOT_SUPPORTED_BY_MODEL"


def xyxy_to_normalized_xywh(
    xyxy: List[float], img_w: int, img_h: int
) -> List[float]:
    """
    Converts pixel [x1, y1, x2, y2] to canonical normalized [x, y, width, height]
    with top-left origin, clamped to [0.0, 1.0].
    """
    if img_w <= 0 or img_h <= 0:
        raise ValueError(f"Invalid image dimensions: {img_w}x{img_h}")

    x1, y1, x2, y2 = xyxy
    x = max(0.0, min(1.0, float(x1) / img_w))
    y = max(0.0, min(1.0, float(y1) / img_h))
    w = max(0.0, min(1.0, float(x2 - x1) / img_w))
    h = max(0.0, min(1.0, float(y2 - y1) / img_h))

    return [round(x, 4), round(y, 4), round(w, 4), round(h, 4)]


class YoloDetection:
    """Intermediate detection container."""
    def __init__(
        self,
        class_id: int,
        confidence: float,
        xyxy: List[float],
        img_w: int,
        img_h: int,
    ):
        self.class_id = class_id
        self.confidence = confidence
        self.bbox_norm = xyxy_to_normalized_xywh(xyxy, img_w, img_h)
        self.x = self.bbox_norm[0]
        self.y = self.bbox_norm[1]
        self.w = self.bbox_norm[2]
        self.h = self.bbox_norm[3]
        self.x_center = self.x + self.w / 2.0
        self.y_center = self.y + self.h / 2.0

        info = LABEL_MAP_14.get(class_id, {"value": "?", "tokenClass": "unknown"})
        self.value = info["value"]
        self.token_class = info["tokenClass"]


class YoloDetectionAdapter:
    """
    Adapts YOLO detections into canonical tokens with spatial row/column layout.
    """

    def __init__(
        self,
        conf_threshold: float = 0.25,
        ambiguity_threshold: float = 0.50,
        row_tolerance_factor: float = 0.55,
        nms_iou_threshold: float = 0.50,
    ):
        self.conf_threshold = conf_threshold
        self.ambiguity_threshold = ambiguity_threshold
        self.row_tolerance_factor = row_tolerance_factor
        self.nms_iou_threshold = nms_iou_threshold

    def _nms(self, dets: List[YoloDetection], iou_threshold: float = 0.50) -> List[YoloDetection]:
        """Suppresses heavily overlapping detections, keeping higher confidence."""
        if not dets:
            return []
        sorted_dets = sorted(dets, key=lambda d: d.confidence, reverse=True)
        kept: List[YoloDetection] = []
        for d in sorted_dets:
            overlap = False
            for k in kept:
                if self._compute_iou(d, k) > iou_threshold:
                    overlap = True
                    break
            if not overlap:
                kept.append(d)
        return kept

    @staticmethod
    def _compute_iou(a: YoloDetection, b: YoloDetection) -> float:
        ax1, ay1 = a.x, a.y
        ax2, ay2 = a.x + a.w, a.y + a.h
        bx1, by1 = b.x, b.y
        bx2, by2 = b.x + b.w, b.y + b.h

        ix1 = max(ax1, bx1)
        iy1 = max(ay1, by1)
        ix2 = min(ax2, bx2)
        iy2 = min(ay2, by2)

        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0

        intersection = (ix2 - ix1) * (iy2 - iy1)
        area_a = a.w * a.h
        area_b = b.w * b.h
        union = area_a + area_b - intersection
        return intersection / union if union > 0 else 0.0

    def process_detections(
        self,
        raw_boxes: List[Any],
        img_w: int,
        img_h: int,
    ) -> ImageRecognitionResult:
        """
        Process a list of YOLO box objects or detection dicts.
        Returns canonical ImageRecognitionResult.
        """
        detections: List[YoloDetection] = []

        for b in raw_boxes:
            if hasattr(b, "cls") and hasattr(b, "conf") and hasattr(b, "xyxy"):
                cls_id = int(b.cls[0].item())
                conf = float(b.conf[0].item())
                xyxy = b.xyxy[0].tolist()
            elif isinstance(b, dict):
                cls_id = int(b.get("class_id", b.get("cls", 0)))
                conf = float(b.get("confidence", b.get("conf", 1.0)))
                xyxy = b.get("xyxy", [0, 0, 0, 0])
            else:
                continue

            if conf < self.conf_threshold:
                continue

            det = YoloDetection(cls_id, conf, xyxy, img_w, img_h)
            detections.append(det)

        if not detections:
            logger.info("YOLO produced 0 detections above threshold.")
            return ImageRecognitionResult(tokens=[], status="NO_DETECTIONS")

        # NMS suppression for overlapping duplicate detections
        detections = self._nms(detections, iou_threshold=self.nms_iou_threshold)

        # Layout reconstruction: assign rows and columns
        tokens = self._assign_layout(detections)

        # Determine overall recognition status
        has_ambiguity = any(t.ambiguity for t in tokens if t.tokenClass in ("digit", "operator"))
        # Check if critical digits have sufficient confidence
        digits = [t for t in tokens if t.tokenClass == "digit"]
        operators = [t for t in tokens if t.tokenClass == "operator"]

        if not digits or not operators:
            status = "OUT_OF_SCOPE"
        elif has_ambiguity:
            status = "UNCERTAIN_RECOGNITION"
        else:
            status = "SUCCESS"

        return ImageRecognitionResult(tokens=tokens, status=status)

    def _assign_layout(self, detections: List[YoloDetection]) -> List[Token]:
        """
        Assigns rows (0=top operand, 1=bottom operand, 2=result) and
        columns (0=units, 1=tens, 2=hundreds) to digits and operators.
        """
        # Separate separator lines, operators, and digits
        digits = [d for d in detections if d.token_class == "digit"]
        operators = [d for d in detections if d.token_class == "operator"]
        separators = [d for d in detections if d.token_class == "separator"]
        auxiliaries = [d for d in detections if d.token_class == "carry"]

        # Sort all digits by y_center
        digits_by_y = sorted(digits, key=lambda d: d.y_center)

        # Cluster digits into vertical rows
        rows: List[List[YoloDetection]] = []
        if digits_by_y:
            median_h = sorted(d.h for d in digits_by_y)[len(digits_by_y) // 2]
            tolerance = max(0.04, median_h * self.row_tolerance_factor)

            current_row = [digits_by_y[0]]
            current_y = digits_by_y[0].y_center

            for d in digits_by_y[1:]:
                if abs(d.y_center - current_y) <= tolerance:
                    current_row.append(d)
                    current_y = sum(x.y_center for x in current_row) / len(current_row)
                else:
                    rows.append(current_row)
                    current_row = [d]
                    current_y = d.y_center
            rows.append(current_row)

        tokens: List[Token] = []

        # Map clustered digit rows to canonical row index (0, 1, 2)
        # Vertical math worksheet standard:
        # If 3 rows: row 0 = top, row 1 = bottom, row 2 = result
        # If 2 rows: row 0 = top, row 1 = bottom
        for row_idx, row_dets in enumerate(rows[:3]):
            # Sort digits in row descending by x_center (right-to-left)
            # Rightmost = column 0 (units), next = column 1 (tens), etc.
            row_dets_sorted = sorted(row_dets, key=lambda d: d.x_center, reverse=True)
            for col_idx, d in enumerate(row_dets_sorted):
                ambig = d.confidence < self.ambiguity_threshold
                token = Token(
                    tokenId=f"tok_{row_idx}_{col_idx}_{d.class_id}_{uuid.uuid4().hex[:4]}",
                    value=d.value,
                    tokenClass=d.token_class,
                    boundingBox=d.bbox_norm,
                    row=row_idx,
                    column=col_idx,
                    confidence=round(d.confidence, 4),
                    alternatives=[],
                    ambiguity=ambig,
                )
                tokens.append(token)

        # Operators: assign row 1 (convention in vertical math) or match nearest y
        for i, op in enumerate(operators):
            op_row = 1
            if rows:
                # Find closest row by y_center
                row_dists = [abs(op.y_center - (sum(d.y_center for d in r) / len(r))) for r in rows[:3]]
                op_row = int(row_dists.index(min(row_dists)))

            ambig = op.confidence < self.ambiguity_threshold
            tokens.append(
                Token(
                    tokenId=f"tok_op_{i}_{uuid.uuid4().hex[:4]}",
                    value=op.value,
                    tokenClass=op.token_class,
                    boundingBox=op.bbox_norm,
                    row=op_row,
                    column=99,  # Operator does not occupy numeric column
                    confidence=round(op.confidence, 4),
                    alternatives=[],
                    ambiguity=ambig,
                )
            )

        # Separators (= / horizontal lines)
        for i, sep in enumerate(separators):
            tokens.append(
                Token(
                    tokenId=f"tok_sep_{i}_{uuid.uuid4().hex[:4]}",
                    value=sep.value,
                    tokenClass=sep.token_class,
                    boundingBox=sep.bbox_norm,
                    row=None,
                    column=None,
                    confidence=round(sep.confidence, 4),
                    alternatives=[],
                    ambiguity=sep.confidence < self.ambiguity_threshold,
                )
            )

        # Carry markers (c1)
        for i, c in enumerate(auxiliaries):
            tokens.append(
                Token(
                    tokenId=f"tok_carry_{i}_{uuid.uuid4().hex[:4]}",
                    value=c.value,
                    tokenClass=c.token_class,
                    boundingBox=c.bbox_norm,
                    row=0,
                    column=None,
                    confidence=round(c.confidence, 4),
                    alternatives=[],
                    ambiguity=c.confidence < self.ambiguity_threshold,
                )
            )

        return tokens
