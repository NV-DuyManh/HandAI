import os
import pytest
from app.config import settings
from app.jobs.tasks import process_submission
from app.recognition.model_engine import ModelRecognitionEngine, ModelNotAvailableError
from app.recognition.fixture import FixtureRecognitionEngine

def _mock_http(mocker):
    mock_post = mocker.patch("httpx.Client.post")
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response
    return mock_post

def test_model_mode_executes_yolo_and_sets_provenance(mocker):
    """In MODEL mode with valid checkpoint, ModelRecognitionEngine executes and provenance is set."""
    mock_post = _mock_http(mocker)
    original_mode = settings.runtime_mode
    settings.runtime_mode = "MODEL"

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        assert os.path.exists(sample_path)

        result = process_submission("job-provenance-1", {
            "submissionId": "sub_prov_1",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "STUDENT",
        })

        assert result == "COMPLETED"
        assert mock_post.called
        payload = mock_post.call_args.kwargs["json"]

        # Provenance checks
        assert payload["status"] == "FEEDBACK_READY"
        assert payload["modelVersion"] is not None
        assert payload["modelVersion"].startswith("MODEL:MathVision-Kids-Detection:1.0.0:")
        assert "fixture" not in payload["modelVersion"].lower()

        # Check diagnostics structured provenance
        diag = payload.get("diagnostics", {})
        prov = diag.get("modelProvenance", {})
        assert prov.get("recognitionMode") == "MODEL"
        assert prov.get("modelName") == "MathVision-Kids-Detection"
        assert prov.get("modelVersion") == "1.0.0"
        assert prov.get("modelSha256") == "e78f8fa5a2fc8be581b8624fa510cd2c429c40cdbd0930dbb2f1c2d870338985"
    finally:
        settings.runtime_mode = original_mode

def test_missing_checkpoint_fails_explicitly_no_silent_fixture_fallback(mocker):
    """In MODEL mode with missing artifact, system must return MODEL_NOT_AVAILABLE, NEVER fall back to fixture."""
    mock_post = _mock_http(mocker)
    original_mode = settings.runtime_mode
    original_art = settings.model_artifact_path
    settings.runtime_mode = "MODEL"
    settings.model_artifact_path = "non_existent_yolo_weights.pt"

    try:
        engine = ModelRecognitionEngine(artifact_path=settings.model_artifact_path)
        assert not engine.is_ready

        sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
        result = process_submission("job-missing-art-1", {
            "submissionId": "sub_missing_1",
            "imageReference": sample_path,
            "allowedOperations": ["VERTICAL_ADDITION"],
            "policyMode": "STUDENT",
        })

        assert result == "MODEL_NOT_AVAILABLE"
        assert mock_post.called
        payload = mock_post.call_args.kwargs["json"]
        assert payload["status"] == "MODEL_NOT_AVAILABLE"
        assert payload["reasonCode"] == "AI_RUNTIME_ERROR"
        assert "fixture" not in payload["modelVersion"].lower()
    finally:
        settings.runtime_mode = original_mode
        settings.model_artifact_path = original_art

def test_corrupted_checkpoint_fails_explicitly_no_silent_fallback(tmp_path):
    """A corrupted checkpoint file must cause ModelRecognitionEngine to fail, not silently switch engines."""
    bad_weights = tmp_path / "corrupt_weights.pt"
    bad_weights.write_text("NOT_A_VALID_PYTORCH_OR_YOLO_FILE")

    engine = ModelRecognitionEngine(artifact_path=str(bad_weights))
    assert engine._yolo_model is None

    sample_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
    with pytest.raises(ModelNotAvailableError):
        engine.recognize(sample_path)
