"""
OCR Bridge Module for MathVision Kids.
Bridges YOLO spatial row detections with CRNN line handwriting OCR.
Provides shadow diagnostics without mutating parser input tokens.
"""
from typing import List, Optional, Union
import time
import logging
import re
from PIL import Image

from app.config import settings
from app.layout.row_grouper import RowGroup
from app.schemas.ocr_bridge import (
    LineRecognition,
    BridgeRecognitionResult,
    AgreementState,
    normalize_math_text,
)
from app.ocr.factory import get_ocr_provider

logger = logging.getLogger(__name__)


def _sanitize_error_message(exc: Exception) -> str:
    """
    Sanitizes exception messages to prevent filesystem paths or secrets from leaking.
    Returns a concise, safe diagnostic string.
    """
    exc_type = type(exc).__name__
    raw_msg = str(exc)
    # Mask local absolute Windows or Unix file paths
    safe_msg = re.sub(r"[A-Za-z]:\\[^\s\"',]+", "<path>", raw_msg)
    safe_msg = re.sub(r"/(?:[a-zA-Z0-9_.-]+/)+[a-zA-Z0-9_.-]+", "<path>", safe_msg)
    if len(safe_msg) > 120:
        safe_msg = safe_msg[:117] + "..."
    return f"{exc_type}: {safe_msg}" if safe_msg else exc_type


class FullPageOcrDisallowedError(RuntimeError):
    """Raised when an attempt is made to feed the whole worksheet directly to CRNN when row groups exist."""
    pass


class OcrBridge:
    """
    Orchestrates row-level OCR on cropped regions from original images.
    
    Modes:
      - "off": CRNN is completely disabled (0 inference overhead, status = CRNN_NOT_RUN).
      - "shadow": CRNN runs on eligible row crops and records recognition diagnostics,
                  WITHOUT mutating YOLO tokens or altering deterministic grading authority.
    """

    def __init__(
        self,
        provider_type: Optional[str] = None,
        bridge_mode: Optional[str] = None,
        batch_size: int = 4,
    ):
        self.bridge_mode = (
            bridge_mode
            if bridge_mode is not None
            else getattr(settings, "ocr_bridge_mode", "off")
        )
        if isinstance(self.bridge_mode, str):
            self.bridge_mode = self.bridge_mode.lower().strip()

        configured_provider = getattr(settings, "ocr_provider", "noop")
        if provider_type is not None:
            self.provider_type = provider_type
        elif self.bridge_mode == "shadow" and (not configured_provider or configured_provider == "noop"):
            self.provider_type = "crnn_vi_handwriting_v1"
        else:
            self.provider_type = configured_provider or "noop"

        self.batch_size = max(1, batch_size)

    @property
    def is_active(self) -> bool:
        """True if the bridge should execute CRNN inference (requires shadow mode and CRNN provider)."""
        return (
            self.bridge_mode == "shadow"
            and self.provider_type in ("crnn_vi_handwriting_v1", "crnn")
        )

    def recognize_rows(
        self,
        image: Union[Image.Image, str],
        row_groups: List[RowGroup],
    ) -> BridgeRecognitionResult:
        """
        Executes row-crop OCR on eligible row groups from the original image.

        Args:
            image: Original PIL.Image.Image or image file path.
            row_groups: List of RowGroup objects from RowGrouper.

        Returns:
            BridgeRecognitionResult containing LineRecognition for each row.
        """
        t0 = time.perf_counter()

        if not row_groups:
            return BridgeRecognitionResult(
                line_recognitions=[],
                all_rows_agree=None,
                provider_used="none",
                bridge_mode=self.bridge_mode,
                execution_time_ms=0.0,
            )

        # 1. Resolve PIL Image
        if isinstance(image, str):
            pil_image = Image.open(image).convert("RGB")
        elif isinstance(image, Image.Image):
            pil_image = image.convert("RGB")
        else:
            raise TypeError(f"Expected PIL.Image.Image or str path, got {type(image)}")

        img_w, img_h = pil_image.size

        # 2. Check bridge mode / provider configuration
        if not self.is_active:
            # Bridge is OFF: Record CRNN_NOT_RUN for all rows with 0 model inference
            line_recognitions = []
            for row in row_groups:
                normalized_yolo = normalize_math_text(row.yolo_text)
                line_recognitions.append(
                    LineRecognition(
                        row_index=row.row_index,
                        bbox=row.bbox,
                        yolo_text=row.yolo_text,
                        crnn_text=None,
                        normalized_yolo_text=normalized_yolo,
                        normalized_crnn_text=None,
                        agreement=AgreementState.CRNN_NOT_RUN,
                        token_count=row.token_count,
                        provider="none",
                        confidence=None,
                        is_eligible=row.is_eligible_for_ocr,
                        error=None,
                    )
                )
            return BridgeRecognitionResult(
                line_recognitions=line_recognitions,
                all_rows_agree=None,
                provider_used="none",
                bridge_mode="off",
                execution_time_ms=round((time.perf_counter() - t0) * 1000, 2),
            )

        # 3. Bridge is ACTIVE: obtain provider singleton
        target_provider = "crnn_vi_handwriting_v1"
        try:
            provider = get_ocr_provider(target_provider)
        except Exception as e:
            logger.error(f"Failed to load OCR provider '{target_provider}': {e}")
            # Explicit failure: record error state, DO NOT silently return fake success
            line_recognitions = []
            for row in row_groups:
                line_recognitions.append(
                    LineRecognition(
                        row_index=row.row_index,
                        bbox=row.bbox,
                        yolo_text=row.yolo_text,
                        crnn_text=None,
                        normalized_yolo_text=normalize_math_text(row.yolo_text),
                        normalized_crnn_text=None,
                        agreement=AgreementState.CRNN_ERROR,
                        token_count=row.token_count,
                        provider=target_provider,
                        confidence=None,
                        is_eligible=row.is_eligible_for_ocr,
                        error=_sanitize_error_message(e),
                    )
                )
            return BridgeRecognitionResult(
                line_recognitions=line_recognitions,
                all_rows_agree=False,
                provider_used=target_provider,
                bridge_mode=self.bridge_mode,
                execution_time_ms=round((time.perf_counter() - t0) * 1000, 2),
            )

        # 4. Prepare crops for eligible rows
        # Full-page safety check (Section 31): ensure crops are localized rows, never entire page
        eligible_indices = []
        crops = []

        for idx, row in enumerate(row_groups):
            if not row.is_eligible_for_ocr:
                continue

            # Determine crop bounding box in pixel coordinates
            if row.crop_bbox is not None:
                cx1, cy1, cx2, cy2 = row.crop_bbox
            else:
                # Compute from normalized bbox if crop_bbox not precomputed
                bx, by, bw, bh = row.bbox
                cx1 = max(0, int(round(bx * img_w)))
                cy1 = max(0, int(round(by * img_h)))
                cx2 = min(img_w, int(round((bx + bw) * img_w)))
                cy2 = min(img_h, int(round((by + bh) * img_h)))

            # Full-page safety guardrail: if crop spans 99%+ of both dimensions and multiple rows exist
            if (
                len(row_groups) > 1
                and (cx2 - cx1) >= int(0.99 * img_w)
                and (cy2 - cy1) >= int(0.99 * img_h)
            ):
                raise FullPageOcrDisallowedError(
                    f"Row {row.row_index} crop spans entire image ({cx2-cx1}x{cy2-cy1}), "
                    "which violates full-page safety rules."
                )

            # Ensure non-zero crop area
            if (cx2 - cx1) < 4 or (cy2 - cy1) < 4:
                continue

            crop = pil_image.crop((cx1, cy1, cx2, cy2))
            crops.append(crop)
            eligible_indices.append(idx)

        # 5. Execute bounded micro-batch OCR inference
        crnn_outputs: List[str] = []
        inference_error: Optional[str] = None
        if crops:
            try:
                # Use provider micro-batching
                crnn_outputs = provider.recognize_batch(crops, batch_size=self.batch_size)
            except Exception as e:
                logger.error(f"CRNN batch inference failed: {e}")
                inference_error = _sanitize_error_message(e)
                crnn_outputs = ["" for _ in crops]

            # Immediately release temporary crop PIL references
            del crops

        # 6. Build LineRecognition results and evaluate agreement
        line_recognitions: List[LineRecognition] = []
        eligible_counter = 0

        for idx, row in enumerate(row_groups):
            normalized_yolo = normalize_math_text(row.yolo_text)

            if idx in eligible_indices and eligible_counter < len(crnn_outputs):
                raw_crnn = crnn_outputs[eligible_counter]
                eligible_counter += 1
                normalized_crnn = normalize_math_text(raw_crnn) if raw_crnn else None

                # Determine agreement state
                if inference_error is not None:
                    agreement = AgreementState.CRNN_ERROR
                    raw_crnn = None
                    normalized_crnn = None
                    row_error = inference_error
                elif not row.yolo_text:
                    agreement = AgreementState.YOLO_EMPTY
                    row_error = None
                elif not raw_crnn:
                    agreement = AgreementState.CRNN_EMPTY
                    row_error = None
                elif row.yolo_text == raw_crnn:
                    agreement = AgreementState.EXACT
                    row_error = None
                elif normalized_yolo == normalized_crnn:
                    agreement = AgreementState.NORMALIZED_MATCH
                    row_error = None
                else:
                    agreement = AgreementState.MISMATCH
                    row_error = None

                rec = LineRecognition(
                    row_index=row.row_index,
                    bbox=row.bbox,
                    yolo_text=row.yolo_text,
                    crnn_text=raw_crnn,
                    normalized_yolo_text=normalized_yolo,
                    normalized_crnn_text=normalized_crnn,
                    agreement=agreement,
                    token_count=row.token_count,
                    provider=target_provider,
                    confidence=None,  # No fake confidence
                    is_eligible=True,
                    error=row_error,
                )
            else:
                # Ineligible row (e.g. carry-only annotation or separator bar)
                rec = LineRecognition(
                    row_index=row.row_index,
                    bbox=row.bbox,
                    yolo_text=row.yolo_text,
                    crnn_text=None,
                    normalized_yolo_text=normalized_yolo,
                    normalized_crnn_text=None,
                    agreement=AgreementState.CRNN_NOT_RUN,
                    token_count=row.token_count,
                    provider=target_provider if self.is_active else "none",
                    confidence=None,
                    is_eligible=False,
                    error=None,
                )
            line_recognitions.append(rec)

        # 7. Evaluate overall agreement across all eligible rows
        eligible_recs = [r for r in line_recognitions if r.is_eligible]
        if eligible_recs:
            all_agree = all(
                r.agreement in (AgreementState.EXACT, AgreementState.NORMALIZED_MATCH)
                for r in eligible_recs
            )
        else:
            all_agree = None

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        return BridgeRecognitionResult(
            line_recognitions=line_recognitions,
            all_rows_agree=all_agree,
            provider_used=target_provider,
            bridge_mode=self.bridge_mode,
            execution_time_ms=elapsed_ms,
        )
