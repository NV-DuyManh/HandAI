from app.schemas.core import ParsedExercise
from app.schemas.jobs import GradeProposal


def generate_teacher_feedback(parsed: ParsedExercise, validation_result: dict) -> dict:
    """
    Teacher policy mapping:

    VALID_STRUCTURE + is_valid = True   → PROPOSED_GRADE (clean pass)
    VALID_STRUCTURE + is_valid = False  → PROPOSED_GRADE with evidence
        (Confident diagnosis: teacher reviews the grade proposal and evidence,
         does NOT mean uncertainty — it means the validator found a specific error.)

    UNCERTAIN_STRUCTURE                 → REVIEW_REQUIRED
        (Insufficient safe evidence to diagnose at all.)

    OUT_OF_SCOPE                        → OUT_OF_SCOPE

    Canonical distinction:
      REVIEW_REQUIRED   = insufficient / uncertain evidence to produce any proposal
      PROPOSED_GRADE    = confident diagnosis (correct OR incorrect), teacher reviews advisory
    """
    if parsed.status in ("OUT_OF_SCOPE", "NO_CONTENT_DETECTED"):
        return {"status": "OUT_OF_SCOPE"}

    if parsed.status == "INVALID_LAYOUT":
        return {
            "status": "REVIEW_REQUIRED",
            "evidence": [{
                "evidenceId": "err_layout",
                "type": "INVALID_LAYOUT",
                "confidence": 0.4,
                "description": "Bố cục phép tính chưa hoàn chỉnh hoặc thiếu toán tử / toán hạng."
            }]
        }

    if parsed.status == "UNCERTAIN_STRUCTURE":
        # Uncertainty — cannot safely diagnose. Teacher must review raw image.
        return {
            "status": "REVIEW_REQUIRED",
            "evidence": [{
                "evidenceId": "err_uncert",
                "type": "UNCERTAINTY",
                "confidence": 0.5,
                "description": "Ảnh hoặc nét chữ không rõ ràng. Hệ thống không thể chẩn đoán chắc chắn."
            }]
        }

    # VALID_STRUCTURE — confident diagnosis (correct or incorrect)
    is_valid = validation_result.get("is_valid", False)
    evidence = validation_result.get("evidence", [])

    if is_valid:
        expr = _build_expr(parsed)
        grade = GradeProposal(
            suggestedScore=10,
            maxScore=10,
            reason=f"Phép tính được xác minh đúng: {expr}",
            confidence=0.97,
            isOfficial=False
        )
        return {
            "status": "PROPOSED_GRADE",
            "gradeProposal": grade
        }
    else:
        # Confident invalid — still PROPOSED_GRADE, not REVIEW_REQUIRED.
        # Teacher receives the grade proposal (suggestedScore reduced) and evidence
        # so they can review the earliest identified error. isOfficial remains False.
        expr = _build_expr(parsed)
        grade = GradeProposal(
            suggestedScore=0,
            maxScore=10,
            reason=f"Phép tính không chính xác: {expr}. Lỗi được phát hiện ở cột sớm nhất.",
            confidence=0.93,
            isOfficial=False
        )
        return {
            "status": "PROPOSED_GRADE",
            "gradeProposal": grade,
            "evidence": evidence
        }


def _build_expr(parsed: ParsedExercise) -> str:
    if parsed.operands and len(parsed.operands) >= 2:
        op_sym = "+" if "ADDITION" in parsed.operationType else "-"
        return f"{parsed.operands[0]} {op_sym} {parsed.operands[1]} = {parsed.result}"
    return ""
