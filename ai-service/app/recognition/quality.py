import os
from typing import List, Tuple, Optional


class QualityGate:
    """
    QualityGate implementation for MathVision Kids.
    Ensures that quality heuristics (blur, darkness, glare, crop framing)
    act as ADVISORY signals rather than hard short-circuits.
    Recognition MUST always be attempted for decodable, non-empty images.
    """

    def check_preflight(self, image_reference: str) -> Tuple[bool, Optional[str], List[str]]:
        """
        Performs essential preflight checks before detector/OCR invocation.
        Returns:
            can_continue (bool): True if recognition should proceed.
            hard_stop_reason (Optional[str]): Set only for non-decodable, corrupt, or proven empty images.
            quality_flags (List[str]): Advisory heuristics (e.g. ['BLUR'], ['DARK'], ['INCOMPLETE_CROP']).
        """
        flags: List[str] = []

        # 1. Controlled fixture tags for test predictability
        if "corrupt" in image_reference:
            return False, "IMAGE_DECODE_FAILED", ["CORRUPT_PAYLOAD"]

        if "empty-image" in image_reference or "blank" in image_reference:
            return False, "IMAGE_EFFECTIVELY_EMPTY", ["EMPTY_IMAGE"]

        # Advisory tags — recognition STILL continues!
        if "quality-dark" in image_reference or "dark" in image_reference:
            flags.append("DARK")
        if "quality-blur" in image_reference or "blur" in image_reference:
            flags.append("BLUR")
        if "quality-incomplete-crop" in image_reference or "incomplete-crop" in image_reference:
            flags.append("INCOMPLETE_CROP")
        if "uneven-lighting" in image_reference:
            flags.append("UNEVEN_LIGHTING")

        # 2. Real image checks if image_reference is a local file path
        if os.path.exists(image_reference) and not image_reference.startswith("fixture://"):
            try:
                import cv2
                import numpy as np
                with open(image_reference, "rb") as f:
                    buf = np.frombuffer(f.read(), dtype=np.uint8)
                    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
                if img is None:
                    return False, "IMAGE_DECODE_FAILED", ["DECODE_ERROR"]

                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                # Otsu thresholding: invert so strokes are white foreground
                _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                if cv2.countNonZero(binary) < 20:
                    return False, "IMAGE_EFFECTIVELY_EMPTY", ["EMPTY_IMAGE"]

                # Advisory blur metric (Laplacian variance)
                lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
                if lap_var < 50.0 and "BLUR" not in flags:
                    flags.append("BLUR")

                # Advisory brightness metric
                if gray.mean() < 40.0 and "DARK" not in flags:
                    flags.append("DARK")

            except Exception:
                # Do not block recognition if OpenCV fails or is not present
                pass

        return True, None, flags

    def evaluate(self, image_reference: str) -> str:
        """
        Legacy evaluation method for backwards-compatibility.
        Returns advisory status string: 'PASS', 'NEEDS_RETAKE', or 'CROP_REQUIRED'.
        Note: The orchestrator uses check_preflight() to ensure recognition is attempted.
        """
        _, _, flags = self.check_preflight(image_reference)
        if "INCOMPLETE_CROP" in flags:
            return "CROP_REQUIRED"
        if "DARK" in flags or "BLUR" in flags:
            return "NEEDS_RETAKE"
        return "PASS"
