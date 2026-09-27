"""
Abstract base class and contract for OCR Providers in MathVision Kids.
"""
from abc import ABC, abstractmethod
from typing import List, Union, Dict, Any
from pathlib import Path
from PIL import Image


class OcrProvider(ABC):
    """
    Abstract interface for text line OCR recognition.
    Strictly accepts text-line cropped images (not full worksheets).
    """

    @abstractmethod
    def recognize_line(self, image: Union[str, Path, Image.Image]) -> str:
        """
        Recognize text in a single line image crop.
        :param image: Path or PIL Image.
        :return: Decoded text string.
        """
        pass

    @abstractmethod
    def recognize_batch(
        self,
        images: List[Union[str, Path, Image.Image]],
        batch_size: int = 4,
    ) -> List[str]:
        """
        Recognize text in a batch of line image crops with memory-safe micro-batching.
        :param images: List of image paths or PIL Images.
        :param batch_size: Chunk size for micro-batching.
        :return: List of decoded text strings in identical order.
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Whether the underlying model weights and runtime dependencies are available."""
        pass

    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """Return provider and model metadata (name, architecture, weights path, etc.)."""
        pass
