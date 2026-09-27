"""
Schemas and data structures for YOLO-CRNN OCR bridge and row recognition.
"""
from typing import List, Optional
import unicodedata
import re
from pydantic import BaseModel


class AgreementState:
    """Explicit agreement states between YOLO token sequence and CRNN OCR output."""
    EXACT = "EXACT"
    NORMALIZED_MATCH = "NORMALIZED_MATCH"
    MISMATCH = "MISMATCH"
    CRNN_EMPTY = "CRNN_EMPTY"
    CRNN_NOT_RUN = "CRNN_NOT_RUN"
    CRNN_ERROR = "CRNN_ERROR"
    YOLO_EMPTY = "YOLO_EMPTY"


def normalize_math_text(text: Optional[str]) -> str:
    """
    Conservative normalization helper for math text comparison only.
    - Normalizes Unicode (NFC)
    - Strips whitespace
    - Removes whitespace between digits and around operators (+, -, =, x, *, /)
    - DOES NOT perform dangerous letter-to-digit conversions (e.g. NO O->0, l->1, S->5)
    """
    if not text:
        return ""
    # Unicode NFC normalization
    normalized = unicodedata.normalize("NFC", text.strip())
    # Remove all internal whitespace for arithmetic expression comparison
    normalized = re.sub(r"\s+", "", normalized)
    return normalized


class LineRecognition(BaseModel):
    """
    Internal diagnostic representation of recognition results for a single horizontal row.
    CRNN confidence is absent (None) unless validated.
    """
    row_index: int
    bbox: List[float]  # [x, y, w, h] normalized [0, 1]
    yolo_text: str
    crnn_text: Optional[str] = None
    normalized_yolo_text: str = ""
    normalized_crnn_text: Optional[str] = None
    agreement: str  # AgreementState
    token_count: int
    provider: str = "none"
    confidence: Optional[float] = None  # None / absent — do NOT fabricate
    is_eligible: bool = True
    error: Optional[str] = None


class BridgeRecognitionResult(BaseModel):
    """
    Container for bridge execution over all row groups in an image.
    """
    line_recognitions: List[LineRecognition]
    all_rows_agree: Optional[bool] = None
    provider_used: str = "none"
    bridge_mode: str = "off"  # "off" | "shadow"
    execution_time_ms: float = 0.0
