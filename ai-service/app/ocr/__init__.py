"""
OCR Module for MathVision Kids.
Provides text-line handwritten OCR recognition capabilities.
"""
from app.ocr.provider import OcrProvider
from app.ocr.crnn_provider import CrnnOcrProvider
from app.ocr.noop_provider import NoopOcrProvider
from app.ocr.factory import get_ocr_provider, clear_provider_cache
from app.ocr.model import CRNN
from app.ocr.bridge import OcrBridge

__all__ = [
    "OcrProvider",
    "CrnnOcrProvider",
    "NoopOcrProvider",
    "get_ocr_provider",
    "clear_provider_cache",
    "CRNN",
    "OcrBridge",
]
