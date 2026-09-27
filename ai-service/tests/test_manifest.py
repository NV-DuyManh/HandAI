"""
Expanded manifest tests: missing field, invalid format, missing artifact,
checksum mismatch, unknown label map version, unsupported preprocessing path.
"""
import json
import hashlib
import pytest
from app.recognition.manifest import (
    ModelManifestLoader,
    ManifestValidationError,
    ChecksumMismatchError,
)
from pydantic import ValidationError


VALID_MANIFEST = {
    "modelName": "math-ocr",
    "modelVersion": "1.0.0",
    "task": "arithmetic_recognition",
    "framework": "pytorch",
    "artifactFilename": "model.pt",
    "artifactFormat": "PYTORCH",
    "sha256": "abc123",
    "labelMapVersion": "v1.0",
    "preprocessing": "resize_224_normalize",
}


def _write_manifest(tmp_path, data):
    p = tmp_path / "manifest.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return str(p)


# ── Missing required fields ────────────────────────────────────────────────

def test_missing_manifest_file():
    loader = ModelManifestLoader("non-existent-manifest.json")
    with pytest.raises(FileNotFoundError):
        loader.load()


def test_missing_required_field_raises(tmp_path):
    bad = {k: v for k, v in VALID_MANIFEST.items() if k != "modelVersion"}
    path = _write_manifest(tmp_path, bad)
    loader = ModelManifestLoader(path)
    with pytest.raises(ValidationError):
        loader.load()


# ── Invalid / unsupported artifact format ─────────────────────────────────

def test_invalid_artifact_format_rejected(tmp_path):
    data = {**VALID_MANIFEST, "artifactFormat": "TENSORFLOW"}
    path = _write_manifest(tmp_path, data)
    loader = ModelManifestLoader(path)
    with pytest.raises(ManifestValidationError, match="Unsupported artifact format"):
        loader.load()


def test_supported_formats_accepted(tmp_path):
    for fmt in ("PYTORCH", "TORCHSCRIPT", "ONNX", "PADDLE"):
        data = {**VALID_MANIFEST, "artifactFormat": fmt}
        path = _write_manifest(tmp_path, data)
        loader = ModelManifestLoader(path)
        manifest = loader.load()
        assert manifest.artifactFormat == fmt


# ── Unknown label map version ───────────────────────────────────────────────

def test_unknown_label_map_version_rejected(tmp_path):
    data = {**VALID_MANIFEST, "labelMapVersion": "v99"}
    path = _write_manifest(tmp_path, data)
    loader = ModelManifestLoader(path)
    with pytest.raises(ManifestValidationError, match="Unknown label map version"):
        loader.load()


def test_no_label_map_version_accepted(tmp_path):
    data = {k: v for k, v in VALID_MANIFEST.items() if k != "labelMapVersion"}
    path = _write_manifest(tmp_path, data)
    loader = ModelManifestLoader(path)
    manifest = loader.load()
    assert manifest.labelMapVersion is None


# ── Checksum verification ───────────────────────────────────────────────────

def test_missing_artifact_raises(tmp_path):
    path = _write_manifest(tmp_path, VALID_MANIFEST)
    loader = ModelManifestLoader(path, artifact_base_dir=str(tmp_path))
    with pytest.raises(FileNotFoundError, match="Artifact file not found"):
        loader.load_and_verify_artifact()


def test_checksum_mismatch_raises(tmp_path):
    # Create a real artifact file
    artifact = tmp_path / "model.pt"
    artifact.write_bytes(b"fake model bytes")
    # Put a wrong sha256 in manifest
    data = {**VALID_MANIFEST, "sha256": "wrong_checksum"}
    path = _write_manifest(tmp_path, data)
    loader = ModelManifestLoader(path, artifact_base_dir=str(tmp_path))
    with pytest.raises(ChecksumMismatchError, match="checksum mismatch"):
        loader.load_and_verify_artifact()


def test_checksum_correct_passes(tmp_path):
    artifact = tmp_path / "model.pt"
    artifact_bytes = b"valid model bytes"
    artifact.write_bytes(artifact_bytes)
    sha = hashlib.sha256(artifact_bytes).hexdigest()
    data = {**VALID_MANIFEST, "sha256": sha}
    path = _write_manifest(tmp_path, data)
    loader = ModelManifestLoader(path, artifact_base_dir=str(tmp_path))
    manifest = loader.load_and_verify_artifact()
    assert manifest.sha256 == sha


# ── ModelRecognitionEngine boundary tests ───────────────────────────────────

def test_model_engine_graceful_missing_artifact():
    from app.recognition.model_engine import ModelRecognitionEngine, ModelNotAvailableError
    from app.schemas.model import ModelManifest

    manifest = ModelManifest(**VALID_MANIFEST)
    engine = ModelRecognitionEngine(manifest=manifest, artifact_path=None)
    assert engine.is_ready is False

    with pytest.raises(ModelNotAvailableError, match="Model artifact has not been provided"):
        engine.recognize("fixture://valid-addition")


def test_model_engine_consumes_configuration():
    from app.recognition.model_engine import ModelRecognitionEngine
    from app.schemas.model import ModelManifest

    manifest_data = {
        **VALID_MANIFEST,
        "inputWidth": 256,
        "inputHeight": 256,
        "inputChannels": 3,
        "preprocessing": "normalize_imagenet",
    }
    manifest = ModelManifest(**manifest_data)
    label_map = {"0": "0", "1": "1", "+": "+"}
    engine = ModelRecognitionEngine(
        manifest=manifest,
        artifact_path="/path/to/model.pt",
        label_map=label_map,
    )
    assert engine.is_ready is True
    assert engine.preprocessing_config["strategy"] == "normalize_imagenet"
    assert engine.preprocessing_config["input_shape"] == (256, 256, 3)
    assert engine.label_map["+"] == "+"

