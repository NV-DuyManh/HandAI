"""
Policy contract tests — StudentFeedback and GradeProposal canonical contracts.
"""
import pytest
from app.schemas.core import ParsedExercise
from app.policy.student_policy import generate_student_feedback
from app.policy.teacher_policy import generate_teacher_feedback
from app.schemas.jobs import StudentFeedback, GradeProposal


def _make_valid_parsed(op="VERTICAL_ADDITION", op1="12", op2="34", res="46"):
    return ParsedExercise(
        operationType=op, operands=[op1, op2], result=res, tokens=[], status="VALID_STRUCTURE"
    )


def _make_uncertain_parsed():
    return ParsedExercise(
        operationType="UNKNOWN", operands=[], result="", tokens=[], status="UNCERTAIN_STRUCTURE"
    )


def _make_out_of_scope():
    return ParsedExercise(
        operationType="UNKNOWN", operands=[], result="", tokens=[], status="OUT_OF_SCOPE"
    )


# ─── Student policy ───────────────────────────────────────────────────────────

class TestStudentPolicy:
    def test_valid_returns_feedback_ready(self):
        result = generate_student_feedback(_make_valid_parsed(), {"is_valid": True, "evidence": []})
        assert result["status"] == "FEEDBACK_READY"

    def test_valid_has_structured_feedback(self):
        result = generate_student_feedback(_make_valid_parsed(), {"is_valid": True, "evidence": []})
        fb: StudentFeedback = result["studentFeedback"]
        assert isinstance(fb, StudentFeedback)
        assert fb.title
        assert fb.hint
        assert fb.revealAnswer is False

    def test_reveal_answer_always_false(self):
        # Even for invalid exercise — never reveal answer
        evidence = [{"evidenceId": "e1", "type": "COMPUTATION_ERROR",
                     "placeValue": "Hàng đơn vị", "confidence": 0.95, "description": "error"}]
        result = generate_student_feedback(_make_valid_parsed(), {"is_valid": False, "evidence": evidence})
        fb: StudentFeedback = result["studentFeedback"]
        assert fb.revealAnswer is False

    def test_exactly_one_hint_by_default(self):
        """Student policy must generate exactly one Socratic hint."""
        evidence = [{"evidenceId": "e1", "type": "COMPUTATION_ERROR",
                     "placeValue": "Hàng đơn vị", "confidence": 0.95, "description": "error"}]
        result = generate_student_feedback(_make_valid_parsed(), {"is_valid": False, "evidence": evidence})
        fb: StudentFeedback = result["studentFeedback"]
        # hint is a single string (not a list)
        assert isinstance(fb.hint, str)

    def test_focus_evidence_id_set_from_first_error(self):
        evidence = [{"evidenceId": "e_first", "type": "CARRY_BORROW_ERROR",
                     "placeValue": "Hàng chục", "confidence": 0.93, "description": "carry error"}]
        result = generate_student_feedback(_make_valid_parsed(), {"is_valid": False, "evidence": evidence})
        fb: StudentFeedback = result["studentFeedback"]
        assert fb.focusEvidenceId == "e_first"

    def test_uncertain_returns_needs_confirmation(self):
        result = generate_student_feedback(_make_uncertain_parsed(), {})
        assert result["status"] == "NEEDS_CONFIRMATION"

    def test_out_of_scope_status(self):
        result = generate_student_feedback(_make_out_of_scope(), {})
        assert result["status"] == "OUT_OF_SCOPE"

    def test_no_content_detected_status(self):
        parsed = ParsedExercise(operationType="UNKNOWN", operands=[], result="", tokens=[], status="NO_CONTENT_DETECTED")
        result = generate_student_feedback(parsed, {})
        assert result["status"] == "OUT_OF_SCOPE"
        assert "Chưa nhận diện được" in result["studentFeedback"].title

    def test_invalid_layout_status(self):
        parsed = ParsedExercise(operationType="VERTICAL_ADDITION", operands=["1"], result="", tokens=[], status="INVALID_LAYOUT")
        result = generate_student_feedback(parsed, {})
        assert result["status"] == "NEEDS_CONFIRMATION"
        assert "Bố cục" in result["studentFeedback"].title


# ─── Teacher policy ───────────────────────────────────────────────────────────

class TestTeacherPolicy:
    def test_valid_returns_proposed_grade(self):
        result = generate_teacher_feedback(_make_valid_parsed(), {"is_valid": True, "evidence": []})
        assert result["status"] == "PROPOSED_GRADE"

    def test_grade_proposal_is_not_official(self):
        result = generate_teacher_feedback(_make_valid_parsed(), {"is_valid": True, "evidence": []})
        gp: GradeProposal = result["gradeProposal"]
        assert isinstance(gp, GradeProposal)
        assert gp.isOfficial is False

    def test_grade_proposal_has_reason(self):
        result = generate_teacher_feedback(_make_valid_parsed(), {"is_valid": True, "evidence": []})
        gp: GradeProposal = result["gradeProposal"]
        assert gp.reason  # non-empty

    def test_grade_proposal_scores(self):
        result = generate_teacher_feedback(_make_valid_parsed(), {"is_valid": True, "evidence": []})
        gp: GradeProposal = result["gradeProposal"]
        assert gp.suggestedScore == 10
        assert gp.maxScore == 10

    def test_uncertain_returns_review_required(self):
        result = generate_teacher_feedback(_make_uncertain_parsed(), {})
        assert result["status"] == "REVIEW_REQUIRED"

    def test_invalid_returns_proposed_grade_with_evidence(self):
        """Confident invalid arithmetic → PROPOSED_GRADE with advisory score 0 and evidence (not REVIEW_REQUIRED)."""
        evidence = [{"evidenceId": "e1", "type": "COMPUTATION_ERROR", "placeValue": "Hàng đơn vị", "confidence": 0.95, "description": "error"}]
        result = generate_teacher_feedback(_make_valid_parsed(), {"is_valid": False, "evidence": evidence})
        assert result["status"] == "PROPOSED_GRADE"
        gp: GradeProposal = result["gradeProposal"]
        assert gp.isOfficial is False
        assert gp.suggestedScore == 0
        assert gp.maxScore == 10
        assert gp.reason != ""
        assert "evidence" in result
        assert result["evidence"] == evidence

    def test_out_of_scope_status(self):
        result = generate_teacher_feedback(_make_out_of_scope(), {})
        assert result["status"] == "OUT_OF_SCOPE"

    def test_no_content_detected_status(self):
        parsed = ParsedExercise(operationType="UNKNOWN", operands=[], result="", tokens=[], status="NO_CONTENT_DETECTED")
        result = generate_teacher_feedback(parsed, {})
        assert result["status"] == "OUT_OF_SCOPE"

    def test_invalid_layout_status(self):
        parsed = ParsedExercise(operationType="VERTICAL_ADDITION", operands=["1"], result="", tokens=[], status="INVALID_LAYOUT")
        result = generate_teacher_feedback(parsed, {})
        assert result["status"] == "REVIEW_REQUIRED"
        assert result["evidence"][0]["type"] == "INVALID_LAYOUT"
