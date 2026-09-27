import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_submit_job_missing_job_id_fails_validation():
    """Missing jobId must fail with 422 validation error."""
    payload = {
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "maxDigits": 6,
        "oneExerciseOnly": True,
        "policyVersion": "v1.2"
    }
    response = client.post("/internal/v1/jobs", json=payload)
    assert response.status_code == 422
    errors = response.json().get("detail", [])
    assert any("jobId" in str(err.get("loc", [])) for err in errors)


def test_submit_job_invalid_job_id_fails_validation():
    """Non-UUID jobId must fail with 422 validation error."""
    payload = {
        "jobId": "not-a-valid-uuid",
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
    }
    response = client.post("/internal/v1/jobs", json=payload)
    assert response.status_code == 422


def test_submit_job_with_spring_job_id(mocker):
    """Spring-owned jobId must be accepted and passed identically to Celery."""
    mock_delay = mocker.patch("app.api.jobs.process_submission.delay")
    spring_job_id = str(uuid.uuid4())
    
    payload = {
        "jobId": spring_job_id,
        "submissionId": "sub_1",
        "imageReference": "fixture://valid-addition",
        "allowedOperations": ["VERTICAL_ADDITION"],
        "maxDigits": 6,
        "oneExerciseOnly": True,
        "policyVersion": "v1.2",
        "policyMode": "TEACHER"
    }
    response = client.post("/internal/v1/jobs", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["jobId"] == spring_job_id
    assert data["status"] == "QUEUED"

    # Verify same jobId passed to Celery task
    mock_delay.assert_called_once()
    called_job_id, called_request_data = mock_delay.call_args[0]
    assert called_job_id == spring_job_id
    assert called_request_data["jobId"] == spring_job_id
    assert called_request_data["policyMode"] == "TEACHER"
