import pytest
import httpx
from app.jobs.tasks import process_submission

def test_callback_5xx_retry(mocker):
    mock_retry = mocker.patch("app.jobs.tasks.process_submission.retry")
    mock_post = mocker.patch("httpx.Client.post")
    
    # Simulate a 500 server error
    mock_response = mocker.Mock()
    mock_response.status_code = 500
    mock_post.return_value = mock_response
    mock_post.side_effect = httpx.HTTPStatusError("500 Server Error", request=mocker.Mock(), response=mock_response)
    
    job_id = "test-5xx"
    request_data = {
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition"
    }
    
    process_submission(job_id, request_data)
    mock_retry.assert_called_once()

def test_callback_4xx_no_retry(mocker):
    mock_retry = mocker.patch("app.jobs.tasks.process_submission.retry")
    mock_post = mocker.patch("httpx.Client.post")
    
    # Simulate a 401 unauthorized
    mock_response = mocker.Mock()
    mock_response.status_code = 401
    mock_post.return_value = mock_response
    mock_post.side_effect = httpx.HTTPStatusError("401 Unauthorized", request=mocker.Mock(), response=mock_response)
    
    job_id = "test-4xx"
    request_data = {
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition"
    }
    
    result = process_submission(job_id, request_data)
    assert result == "FAILED_NO_RETRY"
    mock_retry.assert_not_called()
