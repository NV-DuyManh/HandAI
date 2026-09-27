from pydantic import BaseModel
from typing import List, Optional, Any

class Token(BaseModel):
    tokenId: str
    value: str
    tokenClass: str
    boundingBox: List[float] # [x, y, width, height]
    row: Optional[int] = None
    column: Optional[int] = None
    placeValue: Optional[str] = None
    confidence: float
    alternatives: List[str] = []
    ambiguity: bool = False

class ImageRecognitionResult(BaseModel):
    tokens: List[Token]
    status: str # SUCCESS, OUT_OF_SCOPE, UNCERTAIN_RECOGNITION, NO_DETECTIONS
    line_recognitions: Optional[List[Any]] = None
    all_rows_agree: Optional[bool] = None
    ocr_provider_used: Optional[str] = None

class ParsedExercise(BaseModel):
    operationType: str
    operands: List[str]
    result: str
    tokens: List[Token]
    status: str # VALID_STRUCTURE, UNCERTAIN_STRUCTURE, OUT_OF_SCOPE, INVALID_LAYOUT, NO_CONTENT_DETECTED
