"""
No-op OCR Provider for testing or running with OCR disabled.
"""
from typing import List, Union, Dict, Any
from pathlib import Path
from PIL import Image

from app.ocr.provider import OcrProvider


class NoopOcrProvider(OcrProvider):
    """Explicit disabled/test OCR provider (not an automatic fallback). Used when OCR is disabled or in unit tests."""

    def recognize_line(self, image: Union[str, Path, Image.Image]) -> str:
        return ""

    def recognize_batch(
        self,
        images: List[Union[str, Path, Image.Image]],
        batch_size: int = 4,
    ) -> List[str]:
        return ["" for _ in images]

    def is_available(self) -> bool:
        return True

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "model_name": "NoopOcrProvider",
            "is_available": True,
        }
