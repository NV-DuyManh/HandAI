"""
Fixture E2E tests — process_submission task through full pipeline (mocked HTTP).
Tests cover STUDENT and TEACHER policy modes, quality gating, and uncertainty.
"""
import pytest
from app.jobs.tasks import process_submission


def _mock_http(mocker):
    mock_post = mocker.patch("httpx.Client.post")
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response
    return mock_post


# ─── STUDENT mode (default policyMode) ───────────────────────────────────────

def test_e2e_student_valid_addition(mocker):
    """Valid addition → STUDENT → FEEDBACK_READY with studentFeedback."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-valid", {
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "STUDENT",
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "FEEDBACK_READY"
    assert "studentFeedback" in payload
    assert payload["studentFeedback"]["revealAnswer"] is False
    assert payload.get("reasonCode") is None


def test_e2e_student_uncertain(mocker):
    """Uncertain recognition → STUDENT → NEEDS_CONFIRMATION."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-uncert", {
        "submissionId": "sub_1",
        "imageReference": "fixture://ambiguous-digit",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "STUDENT",
    })
    assert result == "NEEDS_CONFIRMATION"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "NEEDS_CONFIRMATION"
    assert payload["reasonCode"] == "OCR_LOW_CONFIDENCE"


def test_e2e_student_invalid_math(mocker):
    """Invalid addition (carry error) → STUDENT → FEEDBACK_READY with hint."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-invalid", {
        "submissionId": "sub_1",
        "imageReference": "fixture://addition-carry-error",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "STUDENT",
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "FEEDBACK_READY"
    assert "studentFeedback" in payload
    fb = payload["studentFeedback"]
    assert fb["revealAnswer"] is False
    assert fb["hint"]  # non-empty Socratic hint


# ─── TEACHER mode ─────────────────────────────────────────────────────────────

def test_e2e_teacher_valid_addition(mocker):
    """Valid addition → TEACHER → PROPOSED_GRADE with gradeProposal."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-teacher-valid", {
        "submissionId": "sub_2",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "TEACHER",
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "PROPOSED_GRADE"
    gp = payload["gradeProposal"]
    assert gp["isOfficial"] is False
    assert gp["suggestedScore"] == 10
    assert gp["maxScore"] == 10
    assert gp["reason"]  # non-empty


def test_e2e_teacher_invalid_math(mocker):
    """Confident invalid addition → TEACHER → PROPOSED_GRADE with evidence (NOT REVIEW_REQUIRED)."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-teacher-invalid", {
        "submissionId": "sub_2",
        "imageReference": "fixture://addition-carry-error",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "TEACHER",
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "PROPOSED_GRADE"
    assert "gradeProposal" in payload
    assert payload["gradeProposal"]["isOfficial"] is False
    assert payload["gradeProposal"]["suggestedScore"] == 0
    assert "evidence" in payload
    assert len(payload["evidence"]) >= 1
    assert payload["evidence"][0]["type"] in ("CARRY_BORROW_ERROR", "COMPUTATION_ERROR")


def test_e2e_teacher_uncertain(mocker):
    """Uncertain recognition → TEACHER → REVIEW_REQUIRED."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-teacher-uncert", {
        "submissionId": "sub_2",
        "imageReference": "fixture://ambiguous-digit",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "TEACHER",
    })
    assert result == "REVIEW_REQUIRED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "REVIEW_REQUIRED"


# ─── Quality gate E2E (Advisory heuristics — recognition ALWAYS attempted) ───

def test_e2e_quality_dark_image_still_attempts_recognition(mocker):
    """Dark image with decodable math → detector is invoked, does NOT reject before recognition."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-quality-dark", {
        "submissionId": "sub_3",
        "imageReference": "fixture://quality-dark-image",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["diagnostics"]["detectorInvoked"] is True
    assert "DARK" in payload["diagnostics"]["qualityFlags"]
    assert payload["status"] == "FEEDBACK_READY"


def test_e2e_quality_crop_still_attempts_recognition(mocker):
    """Incomplete crop with decodable math → detector is invoked, does NOT reject before recognition."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-quality-crop", {
        "submissionId": "sub_3",
        "imageReference": "fixture://quality-incomplete-crop",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["diagnostics"]["detectorInvoked"] is True
    assert "INCOMPLETE_CROP" in payload["diagnostics"]["qualityFlags"]
    assert payload["status"] == "FEEDBACK_READY"


def test_e2e_quality_severe_blur_attempts_recognition_and_abstains(mocker):
    """Severe blur causing zero tokens → detector runs first, then attributes IMAGE_QUALITY_FAILED."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-quality-fail", {
        "submissionId": "sub_fail",
        "imageReference": "fixture://quality-fail-blur",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "NO_CONTENT_DETECTED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["diagnostics"]["detectorInvoked"] is True
    assert payload["diagnostics"]["detectorTokenCount"] == 0
    assert "BLUR" in payload["diagnostics"]["qualityFlags"]
    assert payload["status"] == "NEEDS_RETAKE"
    assert payload["reasonCode"] == "IMAGE_QUALITY_FAILED"


def test_e2e_empty_image_stops_as_effectively_empty(mocker):
    """Proven empty image → stops as IMAGE_EFFECTIVELY_EMPTY without invoking detector."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-empty", {
        "submissionId": "sub_empty",
        "imageReference": "fixture://empty-image",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "NEEDS_RETAKE"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["reasonCode"] == "IMAGE_EFFECTIVELY_EMPTY"
    assert payload["diagnostics"]["detectorInvoked"] is False


def test_e2e_corrupt_payload_rejects(mocker):
    """Corrupt payload → stops as IMAGE_DECODE_FAILED."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-corrupt", {
        "submissionId": "sub_corrupt",
        "imageReference": "fixture://corrupt-payload",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "REVIEW_REQUIRED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["reasonCode"] == "IMAGE_DECODE_FAILED"
    assert payload["diagnostics"]["detectorInvoked"] is False


def test_e2e_uneven_lighting_attempts_recognition(mocker):
    """Uneven lighting decodable image → detector is invoked, quality flag recorded."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-lighting", {
        "submissionId": "sub_light",
        "imageReference": "fixture://uneven-lighting-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "COMPLETED"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["diagnostics"]["detectorInvoked"] is True
    assert "UNEVEN_LIGHTING" in payload["diagnostics"]["qualityFlags"]


# ─── OUT_OF_SCOPE ──────────────────────────────────────────────────────────────

def test_e2e_out_of_scope(mocker):
    """Out-of-scope content → OUT_OF_SCOPE callback."""
    mock_post = _mock_http(mocker)
    result = process_submission("job-oos", {
        "submissionId": "sub_4",
        "imageReference": "fixture://out-of-scope-exercise",
        "allowedOperations": ["VERTICAL_ADDITION"],
    })
    assert result == "OUT_OF_SCOPE"
    payload = mock_post.call_args.kwargs["json"]
    assert payload["status"] == "OUT_OF_SCOPE"
    assert payload["reasonCode"] == "OUT_OF_SCOPE"


# ─── Confidence bundle present ────────────────────────────────────────────────

def test_e2e_confidence_bundle_present(mocker):
    """ConfidenceBundle with 3 canonical dimensions present in callback."""
    mock_post = _mock_http(mocker)
    process_submission("job-conf", {
        "submissionId": "sub_5",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "policyMode": "STUDENT",
    })
    payload = mock_post.call_args.kwargs["json"]
    cb = payload.get("confidenceBundle", {})
    assert set(cb.keys()) == {"recognition", "structure", "diagnosis"}
    for key in ("recognition", "structure", "diagnosis"):
        assert 0.0 <= cb[key] <= 1.0
