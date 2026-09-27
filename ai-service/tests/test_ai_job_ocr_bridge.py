"""
End-to-End AI Job Integration Test for YOLO-CRNN OCR Bridge.
Invokes the exact Celery process_submission task with real YOLOv8 and real CRNN models.
"""
import os
import pytest
from unittest.mock import MagicMock

from app.config import settings
from app.jobs.tasks import process_submission
from app.recognition.model_engine import ModelRecognitionEngine


def test_process_submission_with_yolo_and_crnn_bridge(mocker):
    """
    Test real Celery process_submission execution with:
    - Real YOLOv8 detector
    - Real RowGrouper
    - Real CRNN OCR on row crops (shadow mode)
    - Real StructuredParser
    - Real VerticalAdditionValidator
    """
    # Mock Spring HTTP callback endpoint
    mock_post = mocker.patch("httpx.Client.post")
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    orig_mode = settings.runtime_mode
    orig_ocr = settings.ocr_provider
    orig_bridge = settings.ocr_bridge_mode

    settings.runtime_mode = "MODEL"
    settings.ocr_provider = "crnn_vi_handwriting_v1"
    settings.ocr_bridge_mode = "shadow"

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        assert os.path.exists(sample_path), f"Fixture not found: {sample_path}"

        job_id = "job-int2-e2e-test-1"
        req_data = {
            "submissionId": "sub-int2-1",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "STUDENT",
        }

        result = process_submission(job_id, req_data)

        # 1. Verify job completed successfully
        assert result == "COMPLETED"
        assert mock_post.called

        # 2. Verify callback payload
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "FEEDBACK_READY"
        assert "studentFeedback" in payload
        assert payload["studentFeedback"]["title"] == "Bài làm chính xác!"
        assert payload["recognizedExercise"] == "45 + 27 = 72"

        # 3. Verify real ModelRecognitionEngine ran with bridge diagnostics
        engine = ModelRecognitionEngine()
        rec_res = engine.recognize(sample_path)
        assert len(rec_res.tokens) == 7
        assert rec_res.line_recognitions is not None
        assert len(rec_res.line_recognitions) == 3
        assert rec_res.ocr_provider_used == "crnn_vi_handwriting_v1"
        assert [r.yolo_text for r in rec_res.line_recognitions] == ["45", "+27", "72"]
        # CRNN ran on each row crop
        for r in rec_res.line_recognitions:
            assert r.crnn_text is not None

    finally:
        settings.runtime_mode = orig_mode
        settings.ocr_provider = orig_ocr
        settings.ocr_bridge_mode = orig_bridge


def test_process_submission_with_bridge_off_preserves_speed(mocker):
    """When bridge is off, process_submission runs standard YOLO path with zero CRNN inference."""
    mock_post = mocker.patch("httpx.Client.post")
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    orig_mode = settings.runtime_mode
    orig_ocr = settings.ocr_provider
    orig_bridge = settings.ocr_bridge_mode

    settings.runtime_mode = "MODEL"
    settings.ocr_provider = "noop"
    settings.ocr_bridge_mode = "off"

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        job_id = "job-int2-off-test"
        req_data = {
            "submissionId": "sub-int2-2",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "TEACHER",
        }

        result = process_submission(job_id, req_data)
        assert result == "COMPLETED"
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "PROPOSED_GRADE"
        assert payload["gradeProposal"]["suggestedScore"] == 10
    finally:
        settings.runtime_mode = orig_mode
        settings.ocr_provider = orig_ocr
        settings.ocr_bridge_mode = orig_bridge


def test_process_submission_with_crnn_error_fallback_safe(mocker):
    """
    When CRNN inference throws an error, process_submission safely records CRNN_ERROR,
    sanitizes the error, preserves YOLO tokens and validator authority, and sends a valid callback.
    """
    mock_post = mocker.patch("httpx.Client.post")
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    orig_mode = settings.runtime_mode
    orig_ocr = settings.ocr_provider
    orig_bridge = settings.ocr_bridge_mode

    settings.runtime_mode = "MODEL"
    settings.ocr_provider = "crnn_vi_handwriting_v1"
    settings.ocr_bridge_mode = "shadow"

    # Mock recognize_batch to simulate runtime exception with a file path
    mocker.patch(
        "app.ocr.crnn_provider.CrnnOcrProvider.recognize_batch",
        side_effect=RuntimeError("CUDA out of memory at E:\\secret_weights\\model.bin")
    )

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        job_id = "job-int2-error-test"
        req_data = {
            "submissionId": "sub-int2-error",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "STUDENT",
        }

        result = process_submission(job_id, req_data)

        # 1. Job completes without failing whole pipeline
        assert result == "COMPLETED"
        assert mock_post.called

        # 2. Callback payload has valid status and no leaked secrets/paths
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "FEEDBACK_READY"
        assert payload["recognizedExercise"] == "45 + 27 = 72"

        # Check payload string contains NO raw secret paths
        import json
        payload_str = json.dumps(payload)
        assert "secret_weights" not in payload_str
        assert "E:\\" not in payload_str

        # 3. Direct engine test verifies CRNN_ERROR diagnostic state & sanitized error
        engine = ModelRecognitionEngine()
        rec_res = engine.recognize(sample_path)
        assert rec_res.line_recognitions is not None
        for r in rec_res.line_recognitions:
            assert r.agreement == "CRNN_ERROR"
            assert "<path>" in r.error
            assert "secret_weights" not in r.error

    finally:
        settings.runtime_mode = orig_mode
        settings.ocr_provider = orig_ocr
        settings.ocr_bridge_mode = orig_bridge
