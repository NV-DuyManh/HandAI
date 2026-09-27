"""
Integration smoke timings and end-to-end model verification.
Measures breakdown:
- Image/MinIO load
- Preprocessing
- YOLO inference
- Token mapping
- Parser
- Validator
- Student Policy
- Teacher Policy
"""
import time
import io
import os
from PIL import Image

from app.recognition.model_engine import ModelRecognitionEngine
from app.parsing.parser import StructuredParser
from app.validation.addition import VerticalAdditionValidator
from app.validation.subtraction import VerticalSubtractionValidator
from app.policy.student_policy import generate_student_feedback
from app.policy.teacher_policy import generate_teacher_feedback
from app.schemas.jobs import GradeProposal


def test_smoke_timings_and_student_teacher_policies(capsys):
    engine = ModelRecognitionEngine()
    assert engine.is_ready is True

    img_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_addition.jpg")
    assert os.path.exists(img_path)

    # 1. Image load
    t0 = time.perf_counter()
    with open(img_path, "rb") as f:
        raw_bytes = f.read()
    t_io = (time.perf_counter() - t0) * 1000

    # 2. Image decode / preprocessing
    t1 = time.perf_counter()
    pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    img_w, img_h = pil_img.size
    t_prep = (time.perf_counter() - t1) * 1000

    # 3. YOLO inference
    t2 = time.perf_counter()
    results = engine._yolo_model(pil_img, conf=engine.adapter.conf_threshold, imgsz=640, verbose=False)
    raw_boxes = results[0].boxes
    t_infer = (time.perf_counter() - t2) * 1000

    # 4. Token mapping
    t3 = time.perf_counter()
    rec_res = engine.adapter.process_detections(raw_boxes, img_w, img_h)
    t_token = (time.perf_counter() - t3) * 1000

    # 5. Parsing
    t4 = time.perf_counter()
    parser = StructuredParser()
    parsed = parser.parse(rec_res)
    t_parse = (time.perf_counter() - t4) * 1000

    # 6. Validation
    t5 = time.perf_counter()
    val = VerticalAdditionValidator()
    val_res = val.validate(parsed)
    t_val = (time.perf_counter() - t5) * 1000

    total_worker = t_io + t_prep + t_infer + t_token + t_parse + t_val

    # Print smoke timings
    print("\n--- INTEGRATION SMOKE TIMINGS ---")
    print(f"Image load .............. {t_io:.2f} ms")
    print(f"Preprocessing ........... {t_prep:.2f} ms")
    print(f"YOLO inference .......... {t_infer:.2f} ms")
    print(f"Token mapping ........... {t_token:.2f} ms")
    print(f"Parser .................. {t_parse:.2f} ms")
    print(f"Validator ............... {t_val:.2f} ms")
    print(f"Total worker processing . {total_worker:.2f} ms")

    # Assertions on pipeline
    assert parsed.status == "VALID_STRUCTURE"
    assert parsed.operands == ["45", "27"]
    assert parsed.result == "72"
    assert val_res["is_valid"] is True

    # 7. Student policy verification
    student_fb = generate_student_feedback(parsed, val_res)
    assert student_fb["status"] == "FEEDBACK_READY"
    assert student_fb.get("studentFeedback") is not None
    assert student_fb["studentFeedback"].title == "Bài làm chính xác!"

    # 8. Teacher policy verification
    teacher_fb = generate_teacher_feedback(parsed, val_res)
    assert teacher_fb["status"] == "PROPOSED_GRADE"
    assert "gradeProposal" in teacher_fb
    grade: GradeProposal = teacher_fb["gradeProposal"]
    assert grade.isOfficial is False  # Must NOT be official
    assert grade.suggestedScore == 10
