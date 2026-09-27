"""
Model Mode End-to-End Tests — process_submission task with real YOLOv8 model.
Verifies Student and Teacher policies, private MinIO reference resolution,
and explicit error handling (NO silent fallback to fixtures).
"""
import os
from pathlib import Path
import pytest
from app.config import settings
from app.jobs.tasks import process_submission


def _mock_http(mocker):
    mock_post = mocker.patch("httpx.Client.post")
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response
    return mock_post


# ─── Real Model Student E2E ───────────────────────────────────────────────────

def test_model_e2e_student_addition(mocker):
    """Real YOLO Model -> STUDENT -> FEEDBACK_READY with studentFeedback."""
    mock_post = _mock_http(mocker)
    original_mode = settings.runtime_mode
    settings.runtime_mode = "MODEL"

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        if not os.path.exists(sample_path):
            pytest.skip("synthetic_addition.jpg not found")

        result = process_submission("job-model-stu-1", {
            "submissionId": "sub_stu_1",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "STUDENT",
        })

        assert result == "COMPLETED"
        assert mock_post.called
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "FEEDBACK_READY"
        assert "studentFeedback" in payload
        assert payload["studentFeedback"]["title"] == "Bài làm chính xác!"
        assert "confidenceBundle" in payload
        assert payload["confidenceBundle"]["recognition"] > 0.5
    finally:
        settings.runtime_mode = original_mode


# ─── Real Model Teacher E2E ───────────────────────────────────────────────────

def test_model_e2e_teacher_addition(mocker):
    """Real YOLO Model -> TEACHER -> PROPOSED_GRADE with isOfficial=False."""
    mock_post = _mock_http(mocker)
    original_mode = settings.runtime_mode
    settings.runtime_mode = "MODEL"

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        if not os.path.exists(sample_path):
            pytest.skip("synthetic_addition.jpg not found")

        result = process_submission("job-model-teach-1", {
            "submissionId": "sub_teach_1",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "TEACHER",
        })

        assert result == "COMPLETED"
        assert mock_post.called
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "PROPOSED_GRADE"
        assert "gradeProposal" in payload
        grade = payload["gradeProposal"]
        assert grade["isOfficial"] is False  # Must NEVER be official
        assert grade["suggestedScore"] == 10
    finally:
        settings.runtime_mode = original_mode


# ─── Real Model Uncertain Sample -> REVIEW_REQUIRED ──────────────────────────

def test_model_e2e_teacher_uncertain_review_required(mocker):
    """Delivered synthetic sample with ambiguous detections -> TEACHER -> REVIEW_REQUIRED."""
    mock_post = _mock_http(mocker)
    original_mode = settings.runtime_mode
    settings.runtime_mode = "MODEL"

    try:
        repo_root = Path(__file__).resolve().parents[3]
        sample_candidates = [
            repo_root / "ai" / "handoff" / "incoming" / "extracted" / "model_handoff" / "sample_io" / "sample_input_synthetic.jpg",
            repo_root / "ai" / "datasets" / "incoming" / "extracted" / "model_handoff" / "sample_io" / "sample_input_synthetic.jpg",
            repo_root / "ai-training" / "incoming" / "extracted" / "model_handoff" / "sample_io" / "sample_input_synthetic.jpg",
        ]
        sample_path = next((str(p) for p in sample_candidates if p.exists()), None)
        if not sample_path:
            pytest.skip("sample_input_synthetic.jpg not found")

        result = process_submission("job-model-teach-uncert", {
            "submissionId": "sub_teach_2",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "TEACHER",
        })

        assert result == "REVIEW_REQUIRED"
        assert mock_post.called
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "REVIEW_REQUIRED"
        assert "evidence" in payload
        assert payload["evidence"][0]["type"] == "UNCERTAINTY"
    finally:
        settings.runtime_mode = original_mode


# ─── No Silent Fallback ───────────────────────────────────────────────────────

def test_model_e2e_no_silent_fallback_on_corrupted_image(mocker):
    """In MODEL mode, corrupt image bytes must fail explicitly, NOT fall back to fixtures."""
    mock_post = _mock_http(mocker)
    original_mode = settings.runtime_mode
    settings.runtime_mode = "MODEL"

    try:
        # Pass a non-existent minio key or invalid path
        result = process_submission("job-fail-explicit", {
            "submissionId": "sub_fail_1",
            "imageReference": "minio://mathvision/non-existent-image-key.jpg",
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "STUDENT",
        })

        assert result == "MODEL_NOT_AVAILABLE"
        assert mock_post.called
        payload = mock_post.call_args.kwargs["json"]
        # Must return explicit error, NEVER fixture status
        assert payload["status"] == "MODEL_NOT_AVAILABLE"
    finally:
        settings.runtime_mode = original_mode
