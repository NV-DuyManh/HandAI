"""
Test Private MinIO -> ImageSourceResolver -> YOLO ModelRecognitionEngine ->
StructuredParser -> Deterministic Validator -> Policy Pipeline.
"""
import pytest
import os
from app.image.resolver import create_configured_resolver
from app.recognition.model_engine import ModelRecognitionEngine
from app.parsing.parser import StructuredParser
from app.validation.addition import VerticalAdditionValidator
from app.validation.subtraction import VerticalSubtractionValidator
from app.policy.student_policy import generate_student_feedback
from app.policy.teacher_policy import generate_teacher_feedback


def test_private_minio_to_yolo_pipeline():
    try:
        from minio import Minio
        client = Minio('localhost:9000', access_key='minioadmin', secret_key='minioadmin123', secure=False)
        if not client.bucket_exists('mathvision'):
            client.make_bucket('mathvision')
    except Exception as e:
        pytest.skip(f"MinIO service not reachable: {e}")

    fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
    sample_add = os.path.join(fixtures_dir, "synthetic_addition.jpg")
    sample_sub = os.path.join(fixtures_dir, "synthetic_subtraction.jpg")

    if not os.path.exists(sample_add) or not os.path.exists(sample_sub):
        pytest.skip("Fixtures not found")

    client.fput_object('mathvision', 'samples/synthetic_addition.jpg', sample_add)
    client.fput_object('mathvision', 'samples/synthetic_subtraction.jpg', sample_sub)

    resolver = create_configured_resolver()
    engine = ModelRecognitionEngine()
    if not engine.is_ready:
        pytest.skip("YOLO model not loaded")

    # 1. Addition test
    bytes_add = resolver.resolve("minio://mathvision/samples/synthetic_addition.jpg")
    rec_add = engine.recognize(bytes_add)
    assert rec_add.status == "SUCCESS"

    parser = StructuredParser()
    parsed_add = parser.parse(rec_add)
    assert parsed_add.status == "VALID_STRUCTURE"
    assert parsed_add.operationType == "VERTICAL_ADDITION"
    assert parsed_add.operands == ["45", "27"]
    assert parsed_add.result == "72"

    val_add = VerticalAdditionValidator().validate(parsed_add)
    assert val_add.get("is_valid") is True

    s_fb = generate_student_feedback(parsed_add, val_add)
    assert s_fb["status"] == "FEEDBACK_READY"
    assert s_fb["studentFeedback"].title == "Bài làm chính xác!"

    t_fb = generate_teacher_feedback(parsed_add, val_add)
    assert t_fb["status"] == "PROPOSED_GRADE"
    assert t_fb["gradeProposal"].isOfficial is False
    assert t_fb["gradeProposal"].suggestedScore == 10

    # 2. Subtraction test
    bytes_sub = resolver.resolve("minio://mathvision/samples/synthetic_subtraction.jpg")
    rec_sub = engine.recognize(bytes_sub)
    assert rec_sub.status == "SUCCESS"

    parsed_sub = parser.parse(rec_sub)
    assert parsed_sub.status == "VALID_STRUCTURE"
    assert parsed_sub.operationType == "VERTICAL_SUBTRACTION"
    assert parsed_sub.operands == ["52", "18"]
    assert parsed_sub.result == "34"

    val_sub = VerticalSubtractionValidator().validate(parsed_sub)
    assert val_sub.get("is_valid") is True

    t_fb_sub = generate_teacher_feedback(parsed_sub, val_sub)
    assert t_fb_sub["status"] == "PROPOSED_GRADE"
    assert t_fb_sub["gradeProposal"].isOfficial is False
    assert t_fb_sub["gradeProposal"].suggestedScore == 10
