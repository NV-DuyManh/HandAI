"""
Real-Stack E2E Verification Script for MathVision Kids Phase 4.2.1.
Executes True Student MODEL E2E, True Teacher MODEL E2E, and Model Uncertainty Flow
across running processes: Spring Boot -> MinIO -> FastAPI -> Redis -> Celery -> YOLO -> DB.
"""
import sys
import time
import json
import uuid
import subprocess
from pathlib import Path
import requests

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_SPRING = "http://localhost:8080"
BASE_FASTAPI = "http://localhost:8000"

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
SAMPLE_ADDITION = FIXTURES_DIR / "synthetic_addition.jpg"
SAMPLE_SUBTRACTION = FIXTURES_DIR / "synthetic_subtraction.jpg"
SAMPLE_UNCERTAIN = FIXTURES_DIR / "sample_input_synthetic.jpg"


def db_query(sql: str):
    """Executes a SQL query in the PostgreSQL container and returns JSON rows."""
    wrapped_sql = f"SELECT row_to_json(t) FROM ({sql}) t;"
    cmd = [
        "docker", "exec", "-i", "mathvision-postgres",
        "psql", "-U", "mathvision", "-d", "mathvision",
        "-t", "-A", "-c", wrapped_sql
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
    if not proc.stdout:
        return []
    out = proc.stdout.strip()
    if not out:
        return []
    lines = [line.strip() for line in out.splitlines() if line.strip()]
    return [json.loads(line) for line in lines]


def db_query_one(sql: str):
    rows = db_query(sql)
    return rows[0] if rows else None


def check_fastapi_ready():
    print("\n[1] Checking FastAPI MODEL Mode Readiness & Health...")
    health_resp = requests.get(f"{BASE_FASTAPI}/health", timeout=5)
    print("  GET /health HTTP Status:", health_resp.status_code, health_resp.json())
    assert health_resp.status_code == 200

    resp = requests.get(f"{BASE_FASTAPI}/ready", timeout=15)
    print("  GET /ready HTTP Status:", resp.status_code)
    data = resp.json()
    print("  Ready Payload:", data)
    assert resp.status_code == 200
    assert data.get("status") == "ready"
    assert data.get("mode") == "MODEL"
    assert data.get("model_loaded") is True
    print("  -> FastAPI MODEL Readiness: PASS")
    return data


def login(email, password="MathVision123!"):
    resp = requests.post(
        f"{BASE_SPRING}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=5,
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["token"]


def test_student_confident_model_e2e():
    print("\n[2] Executing Student Confident MODEL E2E Flow...")
    token = login("minh.student@mathvision.local")
    headers = {"Authorization": f"Bearer {token}"}

    assert SAMPLE_ADDITION.exists(), f"Fixture missing: {SAMPLE_ADDITION}"
    with open(SAMPLE_ADDITION, "rb") as f:
        files = {"image": ("synthetic_addition.jpg", f, "image/jpeg")}
        data = {"source": "CAMERA"}
        resp = requests.post(
            f"{BASE_SPRING}/api/v1/student/submissions",
            headers=headers,
            files=files,
            data=data,
            timeout=10,
        )

    assert resp.status_code == 202, f"Submission creation failed: {resp.text}"
    sub_data = resp.json()
    submission_id = sub_data["submissionId"]
    print(f"  Created Submission ID: {submission_id}")

    # Poll for processing completion
    print("  Polling for Celery worker + YOLO inference completion...")
    final_status = None
    for attempt in range(25):
        time.sleep(1.5)
        poll_resp = requests.get(
            f"{BASE_SPRING}/api/v1/student/submissions/{submission_id}",
            headers=headers,
            timeout=5,
        )
        if poll_resp.status_code == 200:
            final_status = poll_resp.json().get("status")
            print(f"    Attempt {attempt+1}: status = {final_status}")
            if final_status in ("FEEDBACK_READY", "REVIEWED", "FAILED"):
                break

    print(f"  Final Submission Status: {final_status}")
    assert final_status == "FEEDBACK_READY", f"Unexpected status: {final_status}"

    # Query DB to inspect AiJob and AnalysisResult
    job_row = db_query_one(f"SELECT job_id, status, submitted_at, completed_at FROM ai_jobs WHERE submission_id = '{submission_id}'")
    print("  Database AiJob:", job_row)
    assert job_row is not None, "AiJob not found in database!"
    job_id = job_row["job_id"]
    job_status = job_row["status"]
    assert job_status == "COMPLETED", f"AiJob status is {job_status}, expected COMPLETED"
    assert job_row.get("completed_at") is not None

    sub_row = db_query_one(f"SELECT submission_id, status FROM submissions WHERE submission_id = '{submission_id}'")
    print("  Database Submission:", sub_row)
    assert sub_row is not None
    assert sub_row["status"] == "FEEDBACK_READY"

    analysis_row = db_query_one(f"SELECT analysis_result_id, status, student_feedback, evidence, model_version FROM analysis_results WHERE submission_id = '{submission_id}'")
    print("  Database AnalysisResult:", analysis_row)
    assert analysis_row is not None, "AnalysisResult not found in database!"
    assert analysis_row["status"] == "FEEDBACK_READY"
    assert analysis_row.get("student_feedback") is not None
    assert analysis_row["student_feedback"].get("revealAnswer") is False

    print(f"  -> Student Confident MODEL E2E: PASS (jobId={job_id}, status=FEEDBACK_READY)")
    return {
        "submission_id": submission_id,
        "job_id": str(job_id),
        "job_status": job_status,
        "submission_status": final_status,
        "analysis_result": analysis_row,
    }


def test_student_uncertain_model_e2e():
    print("\n[3] Executing Student Uncertain MODEL E2E Flow on Delivered Sample Image...")
    token = login("minh.student@mathvision.local")
    headers = {"Authorization": f"Bearer {token}"}

    assert SAMPLE_UNCERTAIN.exists(), f"Sample image missing: {SAMPLE_UNCERTAIN}"
    with open(SAMPLE_UNCERTAIN, "rb") as f:
        files = {"image": ("sample_input_synthetic.jpg", f, "image/jpeg")}
        data = {"source": "WORKSHEET_SCAN"}
        resp = requests.post(
            f"{BASE_SPRING}/api/v1/student/submissions",
            headers=headers,
            files=files,
            data=data,
            timeout=10,
        )

    assert resp.status_code == 202, f"Submission creation failed: {resp.text}"
    sub_data = resp.json()
    submission_id = sub_data["submissionId"]
    print(f"  Created Uncertain Submission ID: {submission_id}")

    final_status = None
    for attempt in range(25):
        time.sleep(1.5)
        poll_resp = requests.get(
            f"{BASE_SPRING}/api/v1/student/submissions/{submission_id}",
            headers=headers,
            timeout=5,
        )
        if poll_resp.status_code == 200:
            final_status = poll_resp.json().get("status")
            print(f"    Attempt {attempt+1}: status = {final_status}")
            if final_status == "NEEDS_CONFIRMATION":
                break
            job_check = db_query_one(f"SELECT status, completed_at FROM ai_jobs WHERE submission_id = '{submission_id}'")
            if job_check and job_check.get("completed_at"):
                time.sleep(0.5)
                poll_resp2 = requests.get(
                    f"{BASE_SPRING}/api/v1/student/submissions/{submission_id}",
                    headers=headers,
                    timeout=5,
                )
                final_status = poll_resp2.json().get("status")
                break

    job_row = db_query_one(f"SELECT job_id, status, completed_at FROM ai_jobs WHERE submission_id = '{submission_id}'")
    print("  Database AiJob:", job_row)
    assert job_row is not None
    job_id = job_row["job_id"]
    assert job_row["status"] == "COMPLETED"

    sub_row = db_query_one(f"SELECT submission_id, status FROM submissions WHERE submission_id = '{submission_id}'")
    print("  Database Submission:", sub_row)
    assert sub_row is not None
    assert sub_row["status"] == "NEEDS_CONFIRMATION", f"Expected Submission status NEEDS_CONFIRMATION, got {sub_row['status']}"

    analysis_row = db_query_one(f"SELECT analysis_result_id, status, student_feedback, model_version FROM analysis_results WHERE submission_id = '{submission_id}'")
    print("  Database AnalysisResult:", analysis_row)
    assert analysis_row is not None
    assert analysis_row["status"] == "NEEDS_CONFIRMATION", f"Expected AnalysisResult status NEEDS_CONFIRMATION, got {analysis_row['status']}"
    assert "chưa rõ" in analysis_row["student_feedback"]["title"].lower() or "chụp lại" in analysis_row["student_feedback"]["hint"].lower()

    print(f"  -> Student Uncertain MODEL E2E: PASS (AiJob=COMPLETED, AnalysisResult=NEEDS_CONFIRMATION, Submission=NEEDS_CONFIRMATION, jobId={job_id})")
    return {
        "submission_id": submission_id,
        "job_id": str(job_id),
        "job_status": job_row["status"],
        "submission_status": sub_row["status"],
        "analysis_status": analysis_row["status"],
    }


def test_teacher_confident_model_e2e():
    print("\n[4] Executing Teacher Confident MODEL E2E Flow...")
    teacher_token = login("lan.teacher@mathvision.local")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # 1. Fetch teacher assignments
    resp = requests.get(f"{BASE_SPRING}/api/v1/teacher/assignments", headers=teacher_headers, timeout=5)
    assert resp.status_code == 200, f"Failed to get assignments: {resp.text}"
    assignments = resp.json()
    assert len(assignments) > 0, "No assignments found for teacher"
    assignment = assignments[0]
    assignment_id = assignment["assignmentId"]
    class_id = assignment["classId"]
    print(f"  Using Assignment: {assignment['title']} (ID: {assignment_id})")

    # 2. Fetch classroom students to get studentIds (batch requires 10 to 30 submissions)
    students_rows = db_query(f"SELECT student_id FROM classroom_students WHERE class_id = '{class_id}' LIMIT 10")
    assert len(students_rows) >= 10, f"Expected at least 10 students in class, got {len(students_rows)}"
    student_ids = [str(r["student_id"]) for r in students_rows]
    print(f"  Using {len(student_ids)} Classroom Students for Batch Verification")

    # 3. Create batch
    batch_resp = requests.post(
        f"{BASE_SPRING}/api/v1/teacher/batches",
        headers=teacher_headers,
        json={"assignmentId": assignment_id},
        timeout=5,
    )
    assert batch_resp.status_code == 201, f"Failed to create batch: {batch_resp.text}"
    batch = batch_resp.json()
    batch_id = batch["batchId"]
    print(f"  Created Batch ID: {batch_id}")

    # 4. Upload 10 submission images with manifest mapping
    mappings = [{"fileIndex": i, "studentId": student_ids[i]} for i in range(10)]
    with open(SAMPLE_ADDITION, "rb") as f:
        img_bytes = f.read()

    files = [("images", (f"synthetic_addition_{i}.jpg", img_bytes, "image/jpeg")) for i in range(10)]
    data = {"manifest": json.dumps(mappings)}
    upload_resp = requests.post(
        f"{BASE_SPRING}/api/v1/teacher/batches/{batch_id}/submissions",
        headers=teacher_headers,
        files=files,
        data=data,
        timeout=15,
    )
    assert upload_resp.status_code == 202, f"Failed to upload batch submissions: {upload_resp.text}"
    print("  Uploaded 10 batch submissions (HTTP 202 Accepted).")

    # 5. Poll batch until all submissions processed and available in review queue
    print("  Polling for batch submissions processing...")
    for attempt in range(25):
        time.sleep(1.0)
        q_resp = requests.get(
            f"{BASE_SPRING}/api/v1/teacher/batches/{batch_id}/review",
            headers=teacher_headers,
            timeout=5,
        )
        if q_resp.status_code == 200:
            review_queue = q_resp.json()
            print(f"    Attempt {attempt+1}: processed review queue count = {len(review_queue)}/10")
            if len(review_queue) == 10:
                break

    # 6. Find submission in batch and verify grade proposal & teacher decision absence
    sub_row = db_query_one(f"SELECT submission_id, status FROM submissions WHERE batch_id = '{batch_id}'")
    assert sub_row is not None, "Submission for batch not found in DB!"
    sub_id = sub_row["submission_id"]
    sub_status = sub_row["status"]
    print(f"  Batch Submission: ID = {sub_id}, status = {sub_status}")
    assert sub_status == "PROPOSED_GRADE", f"Expected submission status PROPOSED_GRADE, got {sub_status}"

    # Query analysis result
    analysis_row = db_query_one(f"SELECT grade_proposal FROM analysis_results WHERE submission_id = '{sub_id}'")
    print("  Analysis Result grade_proposal:", analysis_row)
    assert analysis_row is not None, "AnalysisResult missing!"
    grade_proposal = analysis_row.get("grade_proposal")
    assert grade_proposal is not None, "GradeProposal must be present"
    assert grade_proposal.get("isOfficial") is False, "gradeProposal.isOfficial must be False"
    assert grade_proposal.get("suggestedScore") == 10

    # Query teacher decisions table: must be ABSENT
    decision_row = db_query_one(f"SELECT decision_id FROM teacher_decisions WHERE submission_id = '{sub_id}'")
    print("  Teacher Decision Record in DB:", decision_row)
    assert decision_row is None, f"TeacherDecision must be ABSENT, but found record: {decision_row}"

    print("  -> Teacher Confident MODEL E2E: PASS (PROPOSED_GRADE, isOfficial=False, TeacherDecision=ABSENT)")
    return {
        "batch_id": batch_id,
        "submission_id": str(sub_id),
        "submission_status": sub_status,
        "grade_proposal": grade_proposal,
        "teacher_decision": None,
    }


def test_teacher_uncertain_model_e2e():
    print("\n[5] Executing Teacher Uncertain MODEL E2E Flow...")
    teacher_token = login("lan.teacher@mathvision.local")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # 1. Fetch teacher assignments
    resp = requests.get(f"{BASE_SPRING}/api/v1/teacher/assignments", headers=teacher_headers, timeout=5)
    assert resp.status_code == 200, f"Failed to get assignments: {resp.text}"
    assignments = resp.json()
    assignment = assignments[0]
    assignment_id = assignment["assignmentId"]
    class_id = assignment["classId"]

    # 2. Fetch classroom students to get studentIds
    students_rows = db_query(f"SELECT student_id FROM classroom_students WHERE class_id = '{class_id}' LIMIT 10")
    student_ids = [str(r["student_id"]) for r in students_rows]

    # 3. Create batch
    batch_resp = requests.post(
        f"{BASE_SPRING}/api/v1/teacher/batches",
        headers=teacher_headers,
        json={"assignmentId": assignment_id},
        timeout=5,
    )
    assert batch_resp.status_code == 201
    batch_id = batch_resp.json()["batchId"]
    print(f"  Created Uncertain Batch ID: {batch_id}")

    # 4. Upload 10 uncertain submission images
    mappings = [{"fileIndex": i, "studentId": student_ids[i]} for i in range(10)]
    with open(SAMPLE_UNCERTAIN, "rb") as f:
        img_bytes = f.read()

    files = [("images", (f"sample_input_synthetic_{i}.jpg", img_bytes, "image/jpeg")) for i in range(10)]
    data = {"manifest": json.dumps(mappings)}
    upload_resp = requests.post(
        f"{BASE_SPRING}/api/v1/teacher/batches/{batch_id}/submissions",
        headers=teacher_headers,
        files=files,
        data=data,
        timeout=15,
    )
    assert upload_resp.status_code == 202
    print("  Uploaded 10 uncertain batch submissions (HTTP 202 Accepted).")

    # 5. Poll batch until processed
    print("  Polling for uncertain batch processing...")
    for attempt in range(25):
        time.sleep(1.0)
        q_resp = requests.get(
            f"{BASE_SPRING}/api/v1/teacher/batches/{batch_id}/review",
            headers=teacher_headers,
            timeout=5,
        )
        if q_resp.status_code == 200:
            review_queue = q_resp.json()
            print(f"    Attempt {attempt+1}: processed review queue count = {len(review_queue)}/10")
            if len(review_queue) == 10:
                break

    # 6. Check submission status in DB
    sub_row = db_query_one(f"SELECT submission_id, status FROM submissions WHERE batch_id = '{batch_id}'")
    assert sub_row is not None
    sub_id = sub_row["submission_id"]
    sub_status = sub_row["status"]
    print(f"  Teacher Uncertain Submission: ID = {sub_id}, status = {sub_status}")
    assert sub_status == "REVIEW_REQUIRED", f"Expected submission status REVIEW_REQUIRED, got {sub_status}"

    # Query analysis result
    analysis_row = db_query_one(f"SELECT status, review_reasons FROM analysis_results WHERE submission_id = '{sub_id}'")
    print("  Teacher Uncertain AnalysisResult:", analysis_row)
    assert analysis_row is not None
    assert analysis_row["status"] == "REVIEW_REQUIRED", f"Expected AnalysisResult status REVIEW_REQUIRED, got {analysis_row['status']}"

    # Query AiJob
    job_row = db_query_one(f"SELECT job_id, status, completed_at FROM ai_jobs WHERE submission_id = '{sub_id}'")
    print("  Teacher Uncertain AiJob:", job_row)
    assert job_row is not None
    assert job_row["status"] == "COMPLETED"

    # Query teacher decision: must be ABSENT
    decision_row = db_query_one(f"SELECT decision_id FROM teacher_decisions WHERE submission_id = '{sub_id}'")
    print("  Teacher Decision Record in DB:", decision_row)
    assert decision_row is None, f"TeacherDecision must be ABSENT, but found: {decision_row}"

    print("  -> Teacher Uncertain MODEL E2E: PASS (REVIEW_REQUIRED, AiJob=COMPLETED, TeacherDecision=ABSENT)")
    return {
        "batch_id": batch_id,
        "submission_id": str(sub_id),
        "submission_status": sub_status,
        "analysis_status": analysis_row["status"],
        "teacher_decision": None,
    }


def main():
    print("========================================================")
    print(" MathVision Kids — Real-Stack MODEL E2E Verification")
    print("========================================================")

    ready_data = check_fastapi_ready()
    student_conf = test_student_confident_model_e2e()
    student_uncert = test_student_uncertain_model_e2e()
    teacher_conf = test_teacher_confident_model_e2e()
    teacher_uncert = test_teacher_uncertain_model_e2e()

    print("\n========================================================")
    print(" ALL 4 REAL-STACK MODEL E2E VERIFICATIONS SUCCEEDED!")
    print("========================================================")
    print("Summary:")
    print("  FastAPI Readiness .............. PASS (mode=MODEL, model_loaded=True)")
    print(f"  Student Confident MODEL E2E .... PASS (jobId={student_conf['job_id']}, status={student_conf['submission_status']})")
    print(f"  Student Uncertain MODEL E2E .... PASS (jobId={student_uncert['job_id']}, submission_status={student_uncert['submission_status']}, analysis_status={student_uncert['analysis_status']})")
    print(f"  Teacher Confident MODEL E2E .... PASS (batchId={teacher_conf['batch_id']}, status={teacher_conf['submission_status']}, isOfficial={teacher_conf['grade_proposal']['isOfficial']}, teacherDecision=ABSENT)")
    print(f"  Teacher Uncertain MODEL E2E .... PASS (batchId={teacher_uncert['batch_id']}, status={teacher_uncert['submission_status']}, analysis_status={teacher_uncert['analysis_status']}, teacherDecision=ABSENT)")


if __name__ == "__main__":
    main()

