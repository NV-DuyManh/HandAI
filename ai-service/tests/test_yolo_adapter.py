"""
Tests for YOLOv8 Runtime Adapter, Bounding Box Normalization,
Label Mapping, Manifest Normalization, and ModelRecognitionEngine.
"""
import os
import pytest
from app.recognition.yolo_adapter import (
    xyxy_to_normalized_xywh,
    YoloDetectionAdapter,
    LABEL_MAP_14,
    EXPLICIT_BORROW_MARK_RECOGNITION,
)
from app.recognition.manifest import ModelManifestLoader
from app.recognition.model_engine import ModelRecognitionEngine, ModelNotAvailableError
from app.parsing.parser import StructuredParser
from app.validation.addition import VerticalAdditionValidator
from app.validation.subtraction import VerticalSubtractionValidator


# ── 1. Bounding Box Conversion Tests ─────────────────────────────────────────

def test_bbox_normalization_standard():
    # 100, 200, 300, 400 on 1000x1000 image -> x=0.1, y=0.2, w=0.2, h=0.2
    bbox = xyxy_to_normalized_xywh([100, 200, 300, 400], 1000, 1000)
    assert bbox == [0.1, 0.2, 0.2, 0.2]


def test_bbox_normalization_clamping():
    # Negative coordinates and beyond boundary clamped to [0.0, 1.0]
    bbox = xyxy_to_normalized_xywh([-50, -20, 1200, 900], 1000, 800)
    assert bbox[0] >= 0.0
    assert bbox[1] >= 0.0
    assert bbox[2] <= 1.0
    assert bbox[3] <= 1.0


def test_bbox_normalization_invalid_dims():
    with pytest.raises(ValueError, match="Invalid image dimensions"):
        xyxy_to_normalized_xywh([10, 10, 20, 20], 0, 100)


# ── 2. Explicit Label Mapping Tests ──────────────────────────────────────────

def test_label_map_coverage():
    assert len(LABEL_MAP_14) == 14
    # Digits 0-9
    for i in range(10):
        assert LABEL_MAP_14[i]["value"] == str(i)
        assert LABEL_MAP_14[i]["tokenClass"] == "digit"
    # Operators
    assert LABEL_MAP_14[10]["value"] == "+"
    assert LABEL_MAP_14[10]["tokenClass"] == "operator"
    assert LABEL_MAP_14[11]["value"] == "-"
    assert LABEL_MAP_14[11]["tokenClass"] == "operator"
    # Separator
    assert LABEL_MAP_14[12]["value"] == "="
    assert LABEL_MAP_14[12]["tokenClass"] == "separator"
    # Carry
    assert LABEL_MAP_14[13]["value"] == "1"
    assert LABEL_MAP_14[13]["tokenClass"] == "carry"


def test_borrow_mark_explicit_limitation():
    # Borrow mark is explicitly NOT supported by the model
    assert EXPLICIT_BORROW_MARK_RECOGNITION == "NOT_SUPPORTED_BY_MODEL"
    # Verify no borrow class exists in the 14-class map
    classes = [v["tokenClass"] for v in LABEL_MAP_14.values()]
    assert "borrow" not in classes


# ── 3. Normalized Manifest Loading & Checksum ────────────────────────────────

def test_normalized_manifest_loading():
    manifest_path = os.path.join(os.path.dirname(__file__), "..", "models", "model_manifest.json")
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    if not os.path.exists(manifest_path):
        pytest.skip("Runtime models directory not initialized yet")

    loader = ModelManifestLoader(manifest_path, artifact_base_dir=models_dir)
    manifest = loader.load_and_verify_artifact()

    assert manifest.modelName == "MathVision-Kids-Detection"
    assert manifest.modelVersion == "1.0.0"
    assert manifest.task == "OBJECT_DETECTION"
    assert manifest.framework == "ULTRALYTICS_YOLO"
    assert manifest.artifactFormat == "PYTORCH"
    assert manifest.labelMapVersion == "mathvision_det_v1.0"
    assert manifest.sha256.lower() == "e78f8fa5a2fc8be581b8624fa510cd2c429c40cdbd0930dbb2f1c2d870338985"


# ── 4. Spatial Layout & StructuredParser Compatibility ───────────────────────

def test_adapter_spatial_layout_addition():
    adapter = YoloDetectionAdapter(conf_threshold=0.20, ambiguity_threshold=0.50)

    # Synthetic detections mimicking:
    #   38
    # + 47
    # ----
    #   85
    mock_boxes = [
        # Row 0: 3 (tens), 8 (units)
        {"class_id": 3, "confidence": 0.95, "xyxy": [450, 180, 550, 320]},
        {"class_id": 8, "confidence": 0.96, "xyxy": [580, 180, 680, 320]},
        # Row 1: + (operator), 4 (tens), 7 (units)
        {"class_id": 10, "confidence": 0.90, "xyxy": [320, 380, 420, 500]},
        {"class_id": 4, "confidence": 0.92, "xyxy": [450, 380, 550, 520]},
        {"class_id": 7, "confidence": 0.93, "xyxy": [580, 380, 680, 520]},
        # Separator: =
        {"class_id": 12, "confidence": 0.85, "xyxy": [300, 540, 700, 560]},
        # Row 2: 8 (tens), 5 (units)
        {"class_id": 8, "confidence": 0.94, "xyxy": [450, 600, 550, 740]},
        {"class_id": 5, "confidence": 0.91, "xyxy": [580, 600, 680, 740]},
    ]

    rec_result = adapter.process_detections(mock_boxes, img_w=1000, img_h=1000)
    assert rec_result.status == "SUCCESS"

    # Feed into frozen StructuredParser
    parser = StructuredParser()
    parsed = parser.parse(rec_result)

    assert parsed.status == "VALID_STRUCTURE"
    assert parsed.operationType == "VERTICAL_ADDITION"
    assert parsed.operands == ["38", "47"]
    assert parsed.result == "85"

    # Validate with frozen VerticalAdditionValidator
    validator = VerticalAdditionValidator()
    val_res = validator.validate(parsed)
    assert val_res["is_valid"] is True


def test_adapter_uncertainty_flagging():
    adapter = YoloDetectionAdapter(conf_threshold=0.20, ambiguity_threshold=0.50)

    # One digit has low confidence (0.35 < 0.50)
    mock_boxes = [
        {"class_id": 3, "confidence": 0.95, "xyxy": [450, 180, 550, 320]},
        {"class_id": 8, "confidence": 0.35, "xyxy": [580, 180, 680, 320]},  # Uncertain
        {"class_id": 10, "confidence": 0.90, "xyxy": [320, 380, 420, 500]},
        {"class_id": 4, "confidence": 0.92, "xyxy": [450, 380, 550, 520]},
        {"class_id": 7, "confidence": 0.93, "xyxy": [580, 380, 680, 520]},
        {"class_id": 8, "confidence": 0.94, "xyxy": [450, 600, 550, 740]},
        {"class_id": 5, "confidence": 0.91, "xyxy": [580, 600, 680, 740]},
    ]

    rec_result = adapter.process_detections(mock_boxes, img_w=1000, img_h=1000)
    assert rec_result.status == "UNCERTAIN_RECOGNITION"

    parser = StructuredParser()
    parsed = parser.parse(rec_result)
    assert parsed.status == "UNCERTAIN_STRUCTURE"


# ── 5. Real Model Inference Smoke Test ───────────────────────────────────────

def test_real_yolo_model_inference_synthetic_addition():
    engine = ModelRecognitionEngine()
    if not engine.is_ready:
        pytest.skip("YOLO model artifact not loaded")

    img_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
    if not os.path.exists(img_path):
        pytest.skip("synthetic_addition.jpg fixture not found")

    rec_res = engine.recognize(img_path)
    assert len(rec_res.tokens) >= 5

    parser = StructuredParser()
    parsed = parser.parse(rec_res)
    assert parsed.operationType == "VERTICAL_ADDITION"
    assert parsed.status == "VALID_STRUCTURE"

    validator = VerticalAdditionValidator()
    val_res = validator.validate(parsed)
    assert val_res["is_valid"] is True


def test_real_yolo_model_inference_synthetic_subtraction():
    engine = ModelRecognitionEngine()
    if not engine.is_ready:
        pytest.skip("YOLO model artifact not loaded")

    img_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_subtraction.jpg")
    if not os.path.exists(img_path):
        pytest.skip("synthetic_subtraction.jpg fixture not found")

    rec_res = engine.recognize(img_path)
    assert len(rec_res.tokens) >= 5

    parser = StructuredParser()
    parsed = parser.parse(rec_res)
    assert parsed.operationType == "VERTICAL_SUBTRACTION"
    assert parsed.status == "VALID_STRUCTURE"

    validator = VerticalSubtractionValidator()
    val_res = validator.validate(parsed)
    assert val_res["is_valid"] is True
