"""
Unit tests for OcrBridge.
Verifies bridge mode configuration, agreement evaluation, crop safety, and zero token mutation.
"""
import pytest
from PIL import Image
from unittest.mock import MagicMock, patch

from app.schemas.core import Token
from app.layout.row_grouper import RowGroup, RowGrouper
from app.ocr.bridge import OcrBridge, FullPageOcrDisallowedError
from app.schemas.ocr_bridge import AgreementState, normalize_math_text


def _create_test_image(w=500, h=500, color=(255, 255, 255)) -> Image.Image:
    return Image.new("RGB", (w, h), color=color)


def _create_test_row(row_idx: int, text: str, y1=0.2, y2=0.3, is_eligible=True) -> RowGroup:
    tok = Token(
        tokenId=f"tok_{row_idx}",
        value=text,
        tokenClass="digit",
        boundingBox=[0.2, y1, 0.4, y2 - y1],
        confidence=0.9,
    )
    return RowGroup(
        row_index=row_idx,
        bbox=[0.2, y1, 0.4, y2 - y1],
        tokens=[tok],
        yolo_text=text,
        token_count=1,
        is_eligible_for_ocr=is_eligible,
        crop_bbox=(100, int(y1 * 500), 300, int(y2 * 500)),
    )


def test_bridge_disabled_does_not_load_crnn():
    """When bridge is off and provider is noop, no model is loaded and CRNN_NOT_RUN is recorded."""
    bridge = OcrBridge(provider_type="noop", bridge_mode="off")
    img = _create_test_image()
    rows = [_create_test_row(0, "456")]

    with patch("app.ocr.bridge.get_ocr_provider") as mock_get_provider:
        res = bridge.recognize_rows(img, rows)
        assert mock_get_provider.call_count == 0

    assert len(res.line_recognitions) == 1
    assert res.line_recognitions[0].agreement == AgreementState.CRNN_NOT_RUN
    assert res.line_recognitions[0].crnn_text is None
    assert res.all_rows_agree is None


def test_bridge_crnn_explicit_opt_in():
    """Explicit opt-in enables CRNN execution."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    assert bridge.is_active is True


def test_bridge_uses_original_image_crop():
    """Bridge crops directly from the passed PIL Image."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image(w=600, h=600)
    rows = [_create_test_row(0, "123", y1=0.1, y2=0.2)]

    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = ["123"]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)
        assert mock_provider.recognize_batch.called
        crops_passed = mock_provider.recognize_batch.call_args[0][0]
        assert len(crops_passed) == 1
        assert isinstance(crops_passed[0], Image.Image)


def test_bridge_never_uses_full_page_when_rows_exist():
    """Safety guardrail raises error if row crop spans 99%+ of entire image when multiple rows exist."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image(w=400, h=400)
    # Malformed row spanning whole image
    row1 = RowGroup(
        row_index=0,
        bbox=[0.0, 0.0, 1.0, 1.0],
        tokens=[],
        yolo_text="1",
        crop_bbox=(0, 0, 400, 400),
        is_eligible_for_ocr=True,
    )
    row2 = RowGroup(
        row_index=1,
        bbox=[0.0, 0.5, 0.5, 0.5],
        tokens=[],
        yolo_text="2",
        crop_bbox=(0, 200, 200, 400),
        is_eligible_for_ocr=True,
    )

    with patch("app.ocr.bridge.get_ocr_provider"):
        with pytest.raises(FullPageOcrDisallowedError, match="violates full-page safety rules"):
            bridge.recognize_rows(img, [row1, row2])


def test_bridge_batch_order_stable():
    """Row recognitions must maintain input row order strictly."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [
        _create_test_row(0, "456", y1=0.1, y2=0.2),
        _create_test_row(1, "+123", y1=0.3, y2=0.4),
        _create_test_row(2, "579", y1=0.5, y2=0.6),
    ]

    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = ["456", "+123", "579"]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)

    assert len(res.line_recognitions) == 3
    assert [r.row_index for r in res.line_recognitions] == [0, 1, 2]
    assert [r.crnn_text for r in res.line_recognitions] == ["456", "+123", "579"]


def test_bridge_exact_agreement():
    """Identical raw output produces AgreementState.EXACT."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "789")]

    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = ["789"]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)

    assert res.line_recognitions[0].agreement == AgreementState.EXACT
    assert res.all_rows_agree is True


def test_bridge_normalized_match():
    """Formatting differences (e.g. whitespace) produce AgreementState.NORMALIZED_MATCH."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "+278")]

    mock_provider = MagicMock()
    # CRNN outputs spaced "+ 278"
    mock_provider.recognize_batch.return_value = ["+ 278"]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)

    assert res.line_recognitions[0].agreement == AgreementState.NORMALIZED_MATCH
    assert res.all_rows_agree is True


def test_bridge_mismatch_is_not_math_error():
    """Different strings produce MISMATCH, which is recognition evidence, not a math validation error."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "456")]

    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = ["450"]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)

    assert res.line_recognitions[0].agreement == AgreementState.MISMATCH
    assert res.all_rows_agree is False


def test_bridge_crnn_empty():
    """Empty string from CRNN yields CRNN_EMPTY."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "456")]

    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = [""]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)

    assert res.line_recognitions[0].agreement == AgreementState.CRNN_EMPTY
    assert res.all_rows_agree is False


def test_bridge_failure_is_explicit():
    """Failure to load model records explicit CRNN_ERROR state without silent fake success."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "456")]

    with patch("app.ocr.bridge.get_ocr_provider", side_effect=FileNotFoundError("weights missing")):
        res = bridge.recognize_rows(img, rows)

    assert len(res.line_recognitions) == 1
    assert "weights missing" in res.line_recognitions[0].error
    assert res.line_recognitions[0].agreement == AgreementState.CRNN_ERROR


def test_bridge_inference_exception_yields_crnn_error():
    """When CRNN inference throws an exception, record explicit CRNN_ERROR."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "456")]

    mock_provider = MagicMock()
    mock_provider.recognize_batch.side_effect = RuntimeError("Inference tensor OOM")

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, rows)

    assert len(res.line_recognitions) == 1
    assert res.line_recognitions[0].agreement == AgreementState.CRNN_ERROR
    assert "Inference tensor OOM" in res.line_recognitions[0].error
    assert res.line_recognitions[0].crnn_text is None


def test_bridge_carry_only_row_yields_crnn_not_run():
    """Carry-only row is intentionally skipped and marked CRNN_NOT_RUN with no error."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    carry_row = _create_test_row(0, "1")
    carry_row.is_carry_only = True
    carry_row.is_eligible_for_ocr = False

    mock_provider = MagicMock()

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        res = bridge.recognize_rows(img, [carry_row])

    assert len(res.line_recognitions) == 1
    assert res.line_recognitions[0].agreement == AgreementState.CRNN_NOT_RUN
    assert res.line_recognitions[0].error is None
    assert res.line_recognitions[0].is_eligible is False
    mock_provider.recognize_batch.assert_not_called()


def test_bridge_preserves_spatial_tokens():
    """CRNN execution must never mutate the tokens inside row groups."""
    bridge = OcrBridge(provider_type="crnn_vi_handwriting_v1", bridge_mode="shadow")
    img = _create_test_image()
    rows = [_create_test_row(0, "456")]
    orig_value = rows[0].tokens[0].value
    orig_box = list(rows[0].tokens[0].boundingBox)

    mock_provider = MagicMock()
    mock_provider.recognize_batch.return_value = ["different_text_999"]

    with patch("app.ocr.bridge.get_ocr_provider", return_value=mock_provider):
        bridge.recognize_rows(img, rows)

    # Token value and boundingBox remain strictly untouched
    assert rows[0].tokens[0].value == orig_value
    assert rows[0].tokens[0].boundingBox == orig_box


def test_normalize_math_text_conservative():
    """Verify conservative normalization rules."""
    assert normalize_math_text("  12 + 34  ") == "12+34"
    assert normalize_math_text("4 5 6") == "456"
    assert normalize_math_text("+ 2 7 8") == "+278"
    # Never convert letters to digits!
    assert normalize_math_text("O") == "O"
    assert normalize_math_text("l") == "l"
    assert normalize_math_text("S") == "S"
