import pytest
from app.jobs.tasks import process_submission
from app.schemas.jobs import JobRequest

def test_celery_task_processing_valid_fixture(mocker):
    # Mock httpx.Client.post to prevent actual HTTP calls to Spring Boot
    mock_post = mocker.patch("httpx.Client.post")
    
    # Mock response
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    job_id = "test-job-id"
    request_data = {
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "maxDigits": 3,
        "oneExerciseOnly": True,
        "policyVersion": "v1.2"
    }
    
    result = process_submission(job_id, request_data)
    
    assert result == "COMPLETED"
    mock_post.assert_called_once()
    
    # Verify callback payload
    call_kwargs = mock_post.call_args.kwargs
    payload = call_kwargs["json"]
    assert payload["status"] == "FEEDBACK_READY"
    # STUDENT mode (default): structured studentFeedback, not gradeProposal
    assert "studentFeedback" in payload
    assert payload["studentFeedback"]["revealAnswer"] is False
