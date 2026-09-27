"""
Tests for manifest-driven preprocessing in ModelRecognitionEngine (Phase 4.0.4).
Verifies:
1. Two different manifest preprocessing configs produce two distinct pipelines.
2. Unsupported preprocessing strategies fail clearly with UnsupportedPreprocessingError.
3. Unspecified preprocessing does not force grayscale/Otsu (uses PASSTHROUGH).
"""
import pytest
from app.schemas.model import ModelManifest
from app.recognition.model_engine import (
    ModelRecognitionEngine,
    UnsupportedPreprocessingError,
    SUPPORTED_PREPROCESSING_STRATEGIES,
)


def test_two_different_manifests_produce_distinct_preprocessing_pipelines():
    """Manifest A (Grayscale + Otsu) vs Manifest B (RGB + Normalization)."""
    manifest_a = ModelManifest(
        modelName="digit-cnn-v1",
        modelVersion="1.0.0",
        task="DIGIT_RECOGNITION",
        framework="ONNX",
        artifactFilename="digit_model.onnx",
        artifactFormat="onnx",
        sha256="abc123def456",
        inputWidth=28,
        inputHeight=28,
        inputChannels=1,
        preprocessing="GRAYSCALE_OTSU"
    )

    manifest_b = ModelManifest(
        modelName="resnet-ocr-v2",
        modelVersion="2.0.0",
        task="EXPRESSION_RECOGNITION",
        framework="TORCHSCRIPT",
        artifactFilename="ocr_model.pt",
        artifactFormat="pt",
        sha256="fed654cba321",
        inputWidth=224,
        inputHeight=224,
        inputChannels=3,
        preprocessing="RGB_NORMALIZED"
    )

    engine_a = ModelRecognitionEngine(manifest=manifest_a)
    engine_b = ModelRecognitionEngine(manifest=manifest_b)

    # Verify pipeline A is grayscale, Otsu-binarized, 28x28x1
    assert engine_a.preprocessing_config["strategy"] == "GRAYSCALE_OTSU"
    assert engine_a.preprocessing_config["color_mode"] == "GRAYSCALE"
    assert engine_a.preprocessing_config["binarization"] == "OTSU"
    assert engine_a.preprocessing_config["normalization"] == "DIV_255"
    assert engine_a.preprocessing_config["input_shape"] == (28, 28, 1)

    # Verify pipeline B is RGB, no binarization, standard score normalized, 224x224x3
    assert engine_b.preprocessing_config["strategy"] == "RGB_NORMALIZED"
    assert engine_b.preprocessing_config["color_mode"] == "RGB"
    assert engine_b.preprocessing_config["binarization"] is None
    assert engine_b.preprocessing_config["normalization"] == "STANDARD_SCORE"
    assert engine_b.preprocessing_config["input_shape"] == (224, 224, 3)

    # Distinct configurations verified
    assert engine_a.preprocessing_config != engine_b.preprocessing_config


def test_unsupported_preprocessing_strategy_fails_clearly():
    """Unsupported preprocessing strategy must raise UnsupportedPreprocessingError."""
    invalid_manifest = ModelManifest(
        modelName="experimental-v1",
        modelVersion="0.0.1",
        task="EXPERIMENTAL",
        framework="ONNX",
        artifactFilename="model.onnx",
        artifactFormat="onnx",
        sha256="dummy",
        preprocessing="UNSUPPORTED_QUANTUM_FILTER"
    )

    with pytest.raises(UnsupportedPreprocessingError) as exc_info:
        ModelRecognitionEngine(manifest=invalid_manifest)

    assert "Unsupported preprocessing strategy: 'UNSUPPORTED_QUANTUM_FILTER'" in str(exc_info.value)
    assert "Supported strategies:" in str(exc_info.value)


def test_unspecified_preprocessing_does_not_force_otsu():
    """If manifest does not request preprocessing, default to PASSTHROUGH without Otsu."""
    clean_manifest = ModelManifest(
        modelName="raw-image-model",
        modelVersion="1.0.0",
        task="RAW_DETECTION",
        framework="ONNX",
        artifactFilename="raw.onnx",
        artifactFormat="onnx",
        sha256="raw123",
        inputWidth=640,
        inputHeight=640,
        inputChannels=3,
        preprocessing=None
    )

    engine = ModelRecognitionEngine(manifest=clean_manifest)
    assert engine.preprocessing_config["strategy"] == "PASSTHROUGH"
    assert engine.preprocessing_config["color_mode"] == "ORIGINAL"
    assert engine.preprocessing_config["binarization"] is None
    assert engine.preprocessing_config["input_shape"] == (640, 640, 3)
