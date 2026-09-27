from app.recognition.engine import RecognitionEngine
from app.schemas.core import ImageRecognitionResult, Token

class FixtureRecognitionEngine(RecognitionEngine):
    def recognize(self, image_reference: str) -> ImageRecognitionResult:
        if "no-tokens" in image_reference or "quality-fail" in image_reference:
            return ImageRecognitionResult(tokens=[], status="NO_DETECTIONS")

        if "out-of-scope" in image_reference:
            return ImageRecognitionResult(tokens=[], status="OUT_OF_SCOPE")
            
        if "ambiguous" in image_reference:
            return ImageRecognitionResult(
                tokens=[
                    Token(tokenId="1", value="?", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.4, ambiguity=True)
                ],
                status="UNCERTAIN_RECOGNITION"
            )
            
        if "addition-carry-error" in image_reference:
            return ImageRecognitionResult(
                tokens=[
                    Token(tokenId="1", value="4", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=1),
                    Token(tokenId="2", value="5", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=0),
                    Token(tokenId="3", value="+", tokenClass="operator", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=2),
                    Token(tokenId="4", value="2", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=1),
                    Token(tokenId="5", value="7", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=0),
                    Token(tokenId="6", value="6", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=1),
                    Token(tokenId="7", value="2", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=0),
                ],
                status="SUCCESS"
            )
            
        if "subtraction-borrow-error" in image_reference:
            return ImageRecognitionResult(
                tokens=[
                    Token(tokenId="1", value="5", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=1),
                    Token(tokenId="2", value="2", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=0),
                    Token(tokenId="3", value="-", tokenClass="operator", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=2),
                    Token(tokenId="4", value="1", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=1),
                    Token(tokenId="5", value="8", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=0),
                    Token(tokenId="6", value="4", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=1),
                    Token(tokenId="7", value="4", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=0),
                ],
                status="SUCCESS"
            )

        # Default valid addition (12 + 34 = 46)
        return ImageRecognitionResult(
            tokens=[
                Token(tokenId="1", value="1", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=1),
                Token(tokenId="2", value="2", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=0),
                Token(tokenId="3", value="+", tokenClass="operator", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=2),
                Token(tokenId="4", value="3", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=1),
                Token(tokenId="5", value="4", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=0),
                Token(tokenId="6", value="4", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=1),
                Token(tokenId="7", value="6", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=0),
            ],
            status="SUCCESS"
        )
