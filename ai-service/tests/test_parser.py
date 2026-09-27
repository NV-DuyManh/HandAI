from app.parsing.parser import StructuredParser
from app.schemas.core import ImageRecognitionResult, Token

def test_parser_uncertain_structure():
    parser = StructuredParser()
    res = ImageRecognitionResult(
        tokens=[Token(tokenId="1", value="?", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.4, ambiguity=True)],
        status="UNCERTAIN_RECOGNITION"
    )
    parsed = parser.parse(res)
    assert parsed.status == "UNCERTAIN_STRUCTURE"

def test_parser_valid_structure():
    parser = StructuredParser()
    res = ImageRecognitionResult(
        tokens=[
            Token(tokenId="1", value="1", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=0),
            Token(tokenId="2", value="+", tokenClass="operator", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=1),
            Token(tokenId="3", value="2", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=0),
            Token(tokenId="4", value="3", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=2, column=0),
        ],
        status="SUCCESS"
    )
    parsed = parser.parse(res)
    assert parsed.status == "VALID_STRUCTURE"
    assert parsed.operationType == "VERTICAL_ADDITION"
    assert parsed.operands == ["1", "2"]
    assert parsed.result == "3"

def test_parser_no_detections():
    parser = StructuredParser()
    res = ImageRecognitionResult(tokens=[], status="NO_DETECTIONS")
    parsed = parser.parse(res)
    assert parsed.status == "NO_CONTENT_DETECTED"
    assert parsed.operationType == "UNKNOWN"

def test_parser_invalid_layout():
    parser = StructuredParser()
    # Missing result row (only row 0 and 1)
    res = ImageRecognitionResult(
        tokens=[
            Token(tokenId="1", value="1", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=0, column=0),
            Token(tokenId="2", value="+", tokenClass="operator", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=1),
            Token(tokenId="3", value="2", tokenClass="digit", boundingBox=[0,0,0,0], confidence=0.99, row=1, column=0),
        ],
        status="SUCCESS"
    )
    parsed = parser.parse(res)
    assert parsed.status == "INVALID_LAYOUT"
