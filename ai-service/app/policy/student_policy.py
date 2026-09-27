from app.schemas.core import ParsedExercise
from app.schemas.jobs import GradeProposal, Evidence, StudentFeedback


def generate_student_feedback(parsed: ParsedExercise, validation_result: dict) -> dict:
    if parsed.status == "NO_CONTENT_DETECTED":
        return {
            "status": "OUT_OF_SCOPE",
            "studentFeedback": StudentFeedback(
                title="Chưa nhận diện được bài làm",
                hint="MathVision đã thử nhận diện nhưng chưa nhận ra đủ chữ số hoặc dấu phép tính trong ảnh.",
                revealAnswer=False
            )
        }

    if parsed.status == "OUT_OF_SCOPE":
        return {
            "status": "OUT_OF_SCOPE",
            "studentFeedback": StudentFeedback(
                title="Bài toán ngoài phạm vi",
                hint="Xin lỗi, hiện tại hệ thống chỉ hỗ trợ phép cộng và trừ cơ bản.",
                revealAnswer=False
            )
        }

    if parsed.status == "INVALID_LAYOUT":
        return {
            "status": "NEEDS_CONFIRMATION",
            "studentFeedback": StudentFeedback(
                title="Bố cục chưa rõ ràng",
                hint="Hệ thống đã nhận diện được nét viết nhưng chưa rõ bố cục phép tính. Em chụp lại ngay ngắn nhé!",
                revealAnswer=False
            )
        }

    if parsed.status == "UNCERTAIN_STRUCTURE":
        return {
            "status": "NEEDS_CONFIRMATION",
            "studentFeedback": StudentFeedback(
                title="MathVision chưa chắc chắn kết quả",
                hint="MathVision đã thử đọc bài của em nhưng chưa đủ chắc chắn để kết luận. Em có thể kiểm tra hoặc chụp lại nhé!",
                revealAnswer=False
            )
        }

    if validation_result.get("is_valid"):
        return {
            "status": "FEEDBACK_READY",
            "studentFeedback": StudentFeedback(
                title="Bài làm chính xác!",
                hint="Bài làm hoàn toàn chính xác! Làm tốt lắm!",
                revealAnswer=False
            )
        }

    # Generate exactly ONE Socratic hint based on earliest detected error
    evidence = validation_result.get("evidence", [])
    focus_id = None
    if evidence:
        first_error = evidence[0]
        focus_id = first_error.get("evidenceId")
        place_value = first_error.get("placeValue", "cột số")
        if first_error.get("type") == "CARRY_BORROW_ERROR":
            hint_text = f"Hãy kiểm tra lại {place_value} nhé. Phép tính này có nhớ/mượn không em?"
        else:
            hint_text = f"Hãy tính lại {place_value} nhé. Kết quả ở cột này có vẻ chưa chính xác."
    else:
        hint_text = "Bài làm có chỗ chưa chính xác. Em xem lại các bước tính nhé."

    return {
        "status": "FEEDBACK_READY",
        "studentFeedback": StudentFeedback(
            title="Bài làm cần xem lại",
            hint=hint_text,
            focusEvidenceId=focus_id,
            revealAnswer=False   # always False — never reveal answer to student
        )
    }
