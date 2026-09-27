import logging
from app.jobs.celery_app import celery_app
from app.callbacks.spring_callback import send_callback
from app.schemas.jobs import AiCallbackRequest, GradeProposal, StudentFeedback
from app.schemas.confidence import ConfidenceBundle
from app.config import settings
from app.recognition.fixture import FixtureRecognitionEngine
from app.validation.addition import VerticalAdditionValidator
from app.validation.subtraction import VerticalSubtractionValidator
from app.recognition.quality import QualityGate
from app.parsing.parser import StructuredParser
from app.policy.student_policy import generate_student_feedback
from app.policy.teacher_policy import generate_teacher_feedback
from app.observability.logging import set_correlation_context
import httpx

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def process_submission(self, job_id: str, request_data: dict):
    try:
        set_correlation_context(job_id, request_data.get('submissionId'))
        logger.info(f"Processing job {job_id} for submission {request_data.get('submissionId')}")

        image_ref = request_data.get('imageReference', '')
        policy_mode = request_data.get('policyMode', 'STUDENT')  # STUDENT | TEACHER

        # ── 1. Quality Preflight & Advisory Flags ────────────────────────────
        quality_gate = QualityGate()
        can_continue, hard_stop_reason, quality_flags = quality_gate.check_preflight(image_ref)

        # Determine initial model provenance based on runtime mode
        if settings.runtime_mode == "FIXTURE":
            model_version_str = "FIXTURE:fixture-v1"
            model_provenance = {
                "recognitionMode": "FIXTURE",
                "modelVersion": "fixture-v1",
            }
        else:
            model_version_str = "MODEL:MathVision-Kids-Detection:1.0.0:e78f8fa5"
            model_provenance = {
                "recognitionMode": "MODEL",
                "modelName": "MathVision-Kids-Detection",
                "modelVersion": "1.0.0",
                "modelSha256": "e78f8fa5a2fc8be581b8624fa510cd2c429c40cdbd0930dbb2f1c2d870338985",
            }

        # Track full attempt diagnostics
        diagnostics = {
            "detectorInvoked": False,
            "detectorTokenCount": None,
            "ocrInvoked": False,
            "ocrTextLength": None,
            "parserInvoked": False,
            "parserStatus": None,
            "validatorInvoked": False,
            "validatorStatus": None,
            "qualityFlags": quality_flags,
            "reasonCode": None,
            "modelProvenance": model_provenance,
        }

        # Hard stop ONLY for undecodable, corrupt, or proven empty images
        if not can_continue:
            diagnostics["reasonCode"] = hard_stop_reason
            status_out = "NEEDS_RETAKE" if hard_stop_reason == "IMAGE_EFFECTIVELY_EMPTY" else "REVIEW_REQUIRED"
            student_fb = None
            if policy_mode == "STUDENT":
                if hard_stop_reason == "IMAGE_EFFECTIVELY_EMPTY":
                    student_fb = StudentFeedback(
                        title="Ảnh chưa có nội dung",
                        hint="MathVision kiểm tra thấy ảnh chưa có chữ viết bài làm. Em hãy đặt bài làm vào khung và chụp lại nhé!",
                        revealAnswer=False
                    )
                else:
                    student_fb = StudentFeedback(
                        title="Không thể đọc ảnh",
                        hint="Ảnh chụp bị lỗi định dạng hoặc không thể tải lên được. Em vui lòng chụp lại nhé!",
                        revealAnswer=False
                    )
            callback = AiCallbackRequest(
                status=status_out,
                studentFeedback=student_fb,
                reasonCode=hard_stop_reason,
                diagnostics=diagnostics,
                modelVersion=model_version_str
            )
            send_callback(job_id, callback)
            return status_out

        # ── 2. Recognition (ALWAYS ATTEMPTED FOR DECODABLE IMAGES) ─────────────
        if settings.runtime_mode == "FIXTURE":
            engine = FixtureRecognitionEngine()
        else:
            from app.recognition.model_engine import ModelRecognitionEngine
            engine = ModelRecognitionEngine()
            if getattr(engine, "manifest", None):
                m = engine.manifest
                model_version_str = f"MODEL:{m.modelName}:{m.modelVersion}:{m.sha256[:8]}"
                model_provenance["modelName"] = m.modelName
                model_provenance["modelVersion"] = m.modelVersion
                model_provenance["modelSha256"] = m.sha256
            if not engine.is_ready:
                logger.error("MODEL mode active but ModelRecognitionEngine is not ready.")
                diagnostics["reasonCode"] = "AI_RUNTIME_ERROR"
                callback = AiCallbackRequest(
                    status="MODEL_NOT_AVAILABLE",
                    reasonCode="AI_RUNTIME_ERROR",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
                send_callback(job_id, callback)
                return "MODEL_NOT_AVAILABLE"

        diagnostics["detectorInvoked"] = True
        try:
            recognition_result = engine.recognize(image_ref)
        except Exception as e:
            logger.error(f"Recognition failed in mode {settings.runtime_mode}: {e}")
            diagnostics["reasonCode"] = "AI_RUNTIME_ERROR"
            callback = AiCallbackRequest(
                status="MODEL_NOT_AVAILABLE",
                reasonCode="AI_RUNTIME_ERROR",
                diagnostics=diagnostics,
                modelVersion=model_version_str
            )
            send_callback(job_id, callback)
            return "MODEL_NOT_AVAILABLE"

        tokens = recognition_result.tokens or []
        diagnostics["detectorTokenCount"] = len(tokens)

        # Log OCR Bridge diagnostics if available
        if getattr(recognition_result, "line_recognitions", None):
            recs = recognition_result.line_recognitions
            diagnostics["ocrInvoked"] = True
            total_ocr_len = sum(len(r.crnn_text or "") for r in recs)
            diagnostics["ocrTextLength"] = total_ocr_len
            logger.info(
                f"OCR Bridge processed {len(recs)} rows | "
                f"provider={getattr(recognition_result, 'ocr_provider_used', 'none')} | "
                f"all_agree={getattr(recognition_result, 'all_rows_agree', None)}"
            )
            for r in recs:
                logger.info(
                    f"  Row {r.row_index}: YOLO='{r.yolo_text}' | CRNN='{r.crnn_text}' | Agreement={r.agreement}"
                )
        else:
            diagnostics["ocrInvoked"] = False
            diagnostics["ocrTextLength"] = None

        # Canonical confidence bundle — deterministic in fixture mode
        if recognition_result.status == "UNCERTAIN_RECOGNITION":
            conf = ConfidenceBundle(recognition=0.4, structure=0.3, diagnosis=0.0)
        elif recognition_result.status == "SUCCESS":
            rec_conf = 0.99
            if settings.runtime_mode == "MODEL" and recognition_result.tokens:
                rec_conf = round(sum(t.confidence for t in recognition_result.tokens) / len(recognition_result.tokens), 2)
            conf = ConfidenceBundle(recognition=rec_conf, structure=0.95, diagnosis=0.0)
        else:
            conf = ConfidenceBundle(recognition=0.0, structure=0.0, diagnosis=0.0)

        # ── 3. Parsing ───────────────────────────────────────────────────────
        diagnostics["parserInvoked"] = True
        parser = StructuredParser()
        parsed_exercise = parser.parse(recognition_result)
        diagnostics["parserStatus"] = parsed_exercise.status

        # Update structure confidence from parse result
        if parsed_exercise.status == "VALID_STRUCTURE":
            conf = ConfidenceBundle(recognition=conf.recognition, structure=0.97, diagnosis=0.0)

        # ── 4. OUT_OF_SCOPE / NO_CONTENT_DETECTED / INVALID_LAYOUT / UNCERTAINTY early exits ──
        if parsed_exercise.status == "NO_CONTENT_DETECTED":
            # Check if quality heuristics support an image quality issue (e.g. BLUR, DARK)
            if quality_flags:
                reason_code = "IMAGE_QUALITY_FAILED"
            else:
                reason_code = "DETECTOR_NO_TOKENS"
            diagnostics["reasonCode"] = reason_code

            if policy_mode == "STUDENT":
                result = generate_student_feedback(parsed_exercise, {})
                fb = result.get("studentFeedback")
                if reason_code == "IMAGE_QUALITY_FAILED":
                    fb = StudentFeedback(
                        title="Chất lượng ảnh chụp chưa đạt",
                        hint="Ảnh chụp có thể bị chói sáng, quá tối hoặc mờ nét. Em kiểm tra lại ánh sáng và chụp lại nhé!",
                        revealAnswer=False
                    )
                else:
                    fb = StudentFeedback(
                        title="Chưa nhận diện được bài làm",
                        hint="MathVision đã thử nhận diện nhưng chưa nhận ra đủ chữ số hoặc dấu phép tính trong ảnh.",
                        revealAnswer=False
                    )
                status_out = "NEEDS_RETAKE" if reason_code == "IMAGE_QUALITY_FAILED" else result["status"]
                callback = AiCallbackRequest(
                    status=status_out,
                    studentFeedback=fb,
                    confidenceBundle=conf.model_dump(),
                    reasonCode=reason_code,
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            else:
                result = generate_teacher_feedback(parsed_exercise, {})
                status_out = "REVIEW_REQUIRED" if reason_code == "IMAGE_QUALITY_FAILED" else result["status"]
                callback = AiCallbackRequest(
                    status=status_out,
                    confidenceBundle=conf.model_dump(),
                    reasonCode=reason_code,
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            send_callback(job_id, callback)
            return "NO_CONTENT_DETECTED"

        if parsed_exercise.status == "OUT_OF_SCOPE":
            diagnostics["reasonCode"] = "OUT_OF_SCOPE"
            if policy_mode == "STUDENT":
                result = generate_student_feedback(parsed_exercise, {})
                callback = AiCallbackRequest(
                    status=result["status"],
                    studentFeedback=result.get("studentFeedback"),
                    confidenceBundle=conf.model_dump(),
                    reasonCode="OUT_OF_SCOPE",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            else:
                result = generate_teacher_feedback(parsed_exercise, {})
                callback = AiCallbackRequest(
                    status=result["status"],
                    confidenceBundle=conf.model_dump(),
                    reasonCode="OUT_OF_SCOPE",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            send_callback(job_id, callback)
            return "OUT_OF_SCOPE"

        if parsed_exercise.status == "INVALID_LAYOUT":
            diagnostics["reasonCode"] = "INVALID_LAYOUT"
            if policy_mode == "STUDENT":
                result = generate_student_feedback(parsed_exercise, {})
                status_out = result["status"]
                callback = AiCallbackRequest(
                    status=status_out,
                    studentFeedback=result.get("studentFeedback"),
                    confidenceBundle=conf.model_dump(),
                    reasonCode="INVALID_LAYOUT",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            else:
                result = generate_teacher_feedback(parsed_exercise, {})
                status_out = result["status"]
                callback = AiCallbackRequest(
                    status=status_out,
                    evidence=result.get("evidence"),
                    confidenceBundle=conf.model_dump(),
                    reasonCode="INVALID_LAYOUT",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            send_callback(job_id, callback)
            return status_out

        if parsed_exercise.status == "UNCERTAIN_STRUCTURE":
            diagnostics["reasonCode"] = "OCR_LOW_CONFIDENCE"
            if policy_mode == "STUDENT":
                result = generate_student_feedback(parsed_exercise, {})
                status_out = result["status"]   # NEEDS_CONFIRMATION
                callback = AiCallbackRequest(
                    status=status_out,
                    studentFeedback=result.get("studentFeedback"),
                    confidenceBundle=conf.model_dump(),
                    reasonCode="OCR_LOW_CONFIDENCE",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            else:
                result = generate_teacher_feedback(parsed_exercise, {})
                status_out = result["status"]   # REVIEW_REQUIRED
                callback = AiCallbackRequest(
                    status=status_out,
                    evidence=result.get("evidence"),
                    confidenceBundle=conf.model_dump(),
                    reasonCode="OCR_LOW_CONFIDENCE",
                    diagnostics=diagnostics,
                    modelVersion=model_version_str
                )
            send_callback(job_id, callback)
            return status_out

        # ── 5. Deterministic Validation ──────────────────────────────────────
        diagnostics["validatorInvoked"] = True
        if parsed_exercise.operationType == "VERTICAL_ADDITION":
            validator = VerticalAdditionValidator()
        elif parsed_exercise.operationType == "VERTICAL_SUBTRACTION":
            validator = VerticalSubtractionValidator()
        else:
            diagnostics["validatorStatus"] = "UNSUPPORTED_OPERATION"
            diagnostics["reasonCode"] = "OUT_OF_SCOPE"
            callback = AiCallbackRequest(
                status="OUT_OF_SCOPE",
                confidenceBundle=conf.model_dump(),
                reasonCode="OUT_OF_SCOPE",
                diagnostics=diagnostics,
                modelVersion=model_version_str
            )
            send_callback(job_id, callback)
            return "OUT_OF_SCOPE"

        validation_result = validator.validate(parsed_exercise)
        diagnostics["validatorStatus"] = "VALID" if validation_result.get("is_valid") else "INVALID"

        # Update diagnosis confidence
        diag_conf = 0.97 if validation_result.get("is_valid") else 0.93
        conf = ConfidenceBundle(
            recognition=conf.recognition,
            structure=conf.structure,
            diagnosis=diag_conf
        )

        recognized_expr = (
            f"{parsed_exercise.operands[0]} "
            f"{'+ ' if 'ADDITION' in parsed_exercise.operationType else '- '}"
            f"{parsed_exercise.operands[1]} = {parsed_exercise.result}"
        )

        # ── 6. Policy Layer ──────────────────────────────────────────────────
        diagnostics["reasonCode"] = None
        if policy_mode == "STUDENT":
            result = generate_student_feedback(parsed_exercise, validation_result)
            callback = AiCallbackRequest(
                status=result["status"],
                studentFeedback=result.get("studentFeedback"),
                evidence=validation_result.get("evidence") if not validation_result.get("is_valid") else None,
                recognizedExercise=recognized_expr,
                confidenceBundle=conf.model_dump(),
                reasonCode=None,
                diagnostics=diagnostics,
                modelVersion=model_version_str
            )
        else:
            result = generate_teacher_feedback(parsed_exercise, validation_result)
            callback = AiCallbackRequest(
                status=result["status"],
                gradeProposal=result.get("gradeProposal"),
                evidence=result.get("evidence"),
                recognizedExercise=recognized_expr,
                confidenceBundle=conf.model_dump(),
                reasonCode=None,
                diagnostics=diagnostics,
                modelVersion=model_version_str
            )

        send_callback(job_id, callback)
        return "COMPLETED"

    except httpx.HTTPStatusError as exc:
        if 400 <= exc.response.status_code < 500:
            logger.error(
                f"Callback 4xx error for job {job_id}: {exc.response.status_code}. Not retrying."
            )
            return "FAILED_NO_RETRY"
        logger.error(f"Callback HTTP error for job {job_id}: {exc}. Retrying...")
        self.retry(exc=exc, countdown=2 ** self.request.retries)
    except httpx.RequestError as exc:
        logger.error(f"Network error processing job {job_id}: {exc}. Retrying...")
        self.retry(exc=exc, countdown=2 ** self.request.retries)
    except Exception as exc:
        logger.error(f"Error processing job {job_id}: {exc}", exc_info=True)
        self.retry(exc=exc, countdown=2 ** self.request.retries)
