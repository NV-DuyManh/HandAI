"""
Non-regression tests ensuring StructuredParser input tokens and behavior
are 100% preserved before and after OCR bridge execution.
CRNN MUST NOT mutate token labels, bounding boxes, or rows/columns.
"""
import copy
from PIL import Image
from unittest.mock import MagicMock, patch

from app.schemas.core import Token, ImageRecognitionResult
from app.layout.row_grouper import RowGrouper
from app.ocr.bridge import OcrBridge
from app.parsing.parser import StructuredParser


def test_parser_input_tokens_identical_with_bridge_off():
    """Parser receives exact same tokens when bridge is off."""
    tokens = [
        Token(tokenId="t1", value="4", tokenClass="digit", boundingBox=[0.38, 0.22, 0.1, 0.12], confidence=0.98, row=0, column=1),
        Token(tokenId="t2", value="5", tokenClass="digit", boundingBox=[0.51, 0.22, 0.1, 0.12], confidence=0.95, row=0, column=0),
        Token(tokenId="t3", value="+", tokenClass="operator", boundingBox=[0.26, 0.37, 0.11, 0.13], confidence=0.90, row=1, column=99),
        Token(tokenId="t4", value="2", tokenClass="digit", boundingBox=[0.38, 0.38, 0.1, 0.12], confidence=0.97, row=1, column=1),
        Token(tokenId="t5", value="7", tokenClass="digit", boundingBox=[0.51, 0.38, 0.1, 0.12], confidence=0.96, row=1, column=0),
        Token(tokenId="t6", value="7", tokenClass="digit", boundingBox=[0.38, 0.58, 0.1, 0.12], confidence=0.92, row=2, column=1),
        Token(tokenId="t7", value="2", tokenClass="digit", boundingBox=[0.51, 0.58, 0.1, 0.12], confidence=0.91, row=2, column=0),
    ]

    tokens_before = [copy.deepcopy(t) for t in tokens]
    rec_result = ImageRecognitionResult(tokens=tokens, status="SUCCESS")

    parser = StructuredParser()
    parse_before = parser.parse(ImageRecognitionResult(tokens=tokens_before, status="SUCCESS"))

    # Execute RowGrouper + OcrBridge (mode=off)
    grouper = RowGrouper()
    rows = grouper.group(rec_result.tokens)
    bridge = OcrBridge(provider_type="noop", bridge_mode="off")
    dummy_img = Image.new("RGB", (640, 640), (255, 255, 255))
    bridge_res = bridge.recognize_rows(dummy_img, rows)
    rec_result.line_recognitions = bridge_res.line_recognitions

    parse_after = parser.parse(rec_result)

    # Assert tokens were NOT mutated
    assert len(rec_result.tokens) == len(tokens_before)
    for t_after, t_before in zip(rec_result.tokens, tokens_before):
        assert t_after.model_dump() == t_before.model_dump()

    # Assert parse result is identical
    assert parse_after.status == parse_before.status == "VALID_STRUCTURE"
    assert parse_after.operationType == parse_before.operationType == "VERTICAL_ADDITION"
    assert parse_after.operands == parse_before.operands == ["45", "27"]
    assert parse_after.result == parse_before.result == "72"


def test_parser_input_tokens_identical_with_bridge_shadow():
    """Parser receives exact same tokens when bridge is shadow (even with CRNN mismatch)."""
    tokens = [
        Token(tokenId="t1", value="5", tokenClass="digit", boundingBox=[0.38, 0.22, 0.1, 0.12], confidence=0.98, row=0, column=1),
        Token(tokenId="t2", value="2", tokenClass="digit", boundingBox=[0.51, 0.22, 0.1, 0.12], confidence=0.95, row=0, column=0),
        Token(tokenId="t3", value="-", tokenClass="operator", boundingBox=[0.25, 0.38, 0.1, 0.11], confidence=0.90, row=1, column=99),
        Token(tokenId="t4", value="1", tokenClass="digit", boundingBox=[0.38, 0.38, 0.1, 0.12], confidence=0.97, row=1, column=1),
        Token(tokenId="t5", value="8", tokenClass="digit", boundingBox=[0.51, 0.38, 0.1, 0.12], confidence=0.96, row=1, column=0),
        Token(tokenId="t6", value="3", tokenClass="digit", boundingBox=[0.38, 0.58, 0.1, 0.12], confidence=0.92, row=2, column=1),
        Token(tokenId="t7", value="4", tokenClass="digit", boundingBox=[0.51, 0.58, 0.1, 0.12], confidence=0.91, row=2, column=0),
    ]

    tokens_before = [copy.deepcopy(t) for t in tokens]
    rec_result = ImageRecognitionResult(tokens=tokens, status="SUCCESS")

    parser = StructuredParser()
    parse_before = parser.parse(ImageRecognitionResult(tokens=tokens_before, status="SUCCESS"))

    # Mock CRNN outputting completely different text (to test that mismatch never alters parser)
    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = ["DIFFERENT_999", "NOT_MATH", "ABC"]

    grouper = RowGrouper()
    rows = grouper.group(rec_result.tokens, img_w=640, img_h=640)
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        dummy_img = Image.new("RGB", (640, 640), (255, 255, 255))
        bridge_res = bridge.recognize_rows(dummy_img, rows)
        rec_result.line_recognitions = bridge_res.line_recognitions

    parse_after = parser.parse(rec_result)

    # Tokens remain identical to before
    for t_after, t_before in zip(rec_result.tokens, tokens_before):
        assert t_after.model_dump() == t_before.model_dump()

    # Parse result remains 100% identical and correct
    assert parse_after.status == parse_before.status == "VALID_STRUCTURE"
    assert parse_after.operationType == parse_before.operationType == "VERTICAL_SUBTRACTION"
    assert parse_after.operands == parse_before.operands == ["52", "18"]
    assert parse_after.result == parse_before.result == "34"
