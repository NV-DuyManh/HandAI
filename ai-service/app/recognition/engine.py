from abc import ABC, abstractmethod
from app.schemas.core import ImageRecognitionResult

class RecognitionEngine(ABC):
    @abstractmethod
    def recognize(self, image_reference: str) -> ImageRecognitionResult:
        pass
