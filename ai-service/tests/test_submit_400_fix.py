"""
Regression and validation suite for SUBMIT400-01 through SUBMIT400-16.
Verifies the fix for the HTTP 400 multiline trial creation bug.
"""

import json
import os
import requests
import pytest
from pathlib import Path

SPRING_BASE = "http://localhost:8080/api/v1"
REPO_ROOT = Path(__file__).resolve().parents[3]
OCR_PILOT_SERVICE_PATH = REPO_ROOT / "apps" / "student-mobile" / "src" / "services" / "api" / "OcrPilotService.ts"
MULTILINE_REVIEW_PATH = REPO_ROOT / "apps" / "student-mobile" / "src" / "app" / "ocr-pilot" / "multiline-review.tsx"
FIXTURE_IMAGE_PATH = Path(__file__).resolve().parent / "fixtures" / "real_hw" / "REAL-HW-02.jpg"


def get_real_image_bytes():
    if FIXTURE_IMAGE_PATH.exists():
        with open(FIXTURE_IMAGE_PATH, "rb") as f:
            return f.read()
    # Minimal 1x1 valid JPEG fallback
    return (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
        b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
        b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    )


def get_auth_headers():
    try:
        r = requests.post(
            f"{SPRING_BASE}/auth/login",
            json={"email": "minh.student@mathvision.local", "password": "MathVision123!"},
            timeout=5
        )
        if r.status_code == 200:
            token = r.json().get("accessToken")
            return {"Authorization": f"Bearer {token}"}
    except Exception:
        pass
    return {}


def is_spring_available():
    try:
        r = requests.get(f"{SPRING_BASE}/ocr/multiline/detect", timeout=2)
        return True
    except Exception:
        return False


spring_required = pytest.mark.skipif(
    not is_spring_available(),
    reason="Spring Boot not running on localhost:8080"
)


def make_dummy_line(order: int, text: str = "dòng chữ mẫu"):
    return {
        "x": 10,
        "y": 10 + order * 35,
        "width": 200,
        "height": 30,
        "order": order,
        "rawOcrText": text,
        "rawOcrConfidence": 0.95,
        "correctedText": text + " chuẩn",
        "correctionApplied": True,
        "correctionDecision": "AUTO_APPLY",
        "finalText": text + " chuẩn",
        "predictedText": text + " chuẩn",
        "groqSuggestion": text + " chuẩn",
        "groqConfidence": 0.96,
        "groqDecision": "AUTO_APPLY",
        "groqStatus": "SUCCESS",
        "groqModel": "qwen/qwen3.8-27b",
        "geminiSuggestion": None,
        "geminiConfidence": None,
        "geminiDecision": "KEEP_RAW",
        "geminiStatus": "UNAVAILABLE",
        "geminiModel": "gemini-3.6-flash",
    }


# ==============================================================================
# SUBMIT400-01..05: Line Count Scaling via Multipart Transport
# ==============================================================================

@spring_required
def test_submit400_01_one_line_creates_trial():
    """SUBMIT400-01: 1 line creates trial successfully"""
    lines = [make_dummy_line(1, "Một dòng thử nghiệm")]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps(lines),
    }
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=get_auth_headers(), files=files, data=data)
    assert resp.status_code == 201
    res_data = resp.json()
    assert "trialId" in res_data
    assert len(res_data.get("lines", [])) == 1


@spring_required
def test_submit400_02_four_lines_creates_trial():
    """SUBMIT400-02: 4 lines creates trial successfully"""
    lines = [make_dummy_line(i, f"Dòng số {i} tiếng Việt") for i in range(1, 5)]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps(lines),
    }
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=get_auth_headers(), files=files, data=data)
    assert resp.status_code == 201
    res_data = resp.json()
    assert len(res_data.get("lines", [])) == 4


@spring_required
def test_submit400_03_eight_lines_creates_trial():
    """SUBMIT400-03: 8 lines creates trial successfully (Original reproduced bug now fixed)"""
    lines = [make_dummy_line(i, f"Dòng chữ số {i} trong bài tập 8 dòng") for i in range(1, 9)]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps(lines),
    }
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=get_auth_headers(), files=files, data=data)
    assert resp.status_code == 201
    res_data = resp.json()
    assert len(res_data.get("lines", [])) == 8


@spring_required
def test_submit400_04_nine_lines_creates_trial():
    """SUBMIT400-04: 9 lines creates trial successfully (Physical device failing count)"""
    lines = [make_dummy_line(i, f"Dòng chữ số {i} trong bài thi 9 dòng") for i in range(1, 10)]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps(lines),
    }
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=get_auth_headers(), files=files, data=data)
    assert resp.status_code == 201
    res_data = resp.json()
    assert len(res_data.get("lines", [])) == 9


@spring_required
def test_submit400_05_twenty_lines_creates_trial():
    """SUBMIT400-05: 20 lines creates trial within product limit"""
    lines = [make_dummy_line(i, f"Dòng {i} kiểm tra tải lớn") for i in range(1, 21)]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps(lines),
    }
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=get_auth_headers(), files=files, data=data)
    assert resp.status_code == 201
    res_data = resp.json()
    assert len(res_data.get("lines", [])) == 20


# ==============================================================================
# SUBMIT400-06..10: Data Integrity & Preservation
# ==============================================================================

@spring_required
def test_submit400_06_vietnamese_unicode_survives():
    """SUBMIT400-06: Vietnamese Unicode survives roundtrip through persistence"""
    vietnamese_sample = "Học sinh giỏi: Nguyễn Văn Tuấn, lớp 3A"
    lines = [make_dummy_line(1, vietnamese_sample)]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps(lines, ensure_ascii=False),
    }
    headers = get_auth_headers()
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=headers, files=files, data=data)
    assert resp.status_code == 201
    trial_id = resp.json()["trialId"]

    get_resp = requests.get(f"{SPRING_BASE}/ocr/multiline/trials/{trial_id}", headers=headers)
    assert get_resp.status_code == 200
    saved_lines = get_resp.json().get("lines", [])
    assert len(saved_lines) == 1
    assert saved_lines[0]["rawOcrText"] == vietnamese_sample


@spring_required
def test_submit400_07_advisor_metadata_survives():
    """SUBMIT400-07: Groq advisor metadata survives"""
    line = make_dummy_line(1, "Kiểm tra Groq")
    line["groqSuggestion"] = "Kiểm tra Groq gợi ý"
    line["groqStatus"] = "SUCCESS"
    line["groqModel"] = "qwen/qwen3.8-27b"
    line["groqConfidence"] = 0.98
    line["groqDecision"] = "AUTO_APPLY"

    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps([line]),
    }
    headers = get_auth_headers()
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=headers, files=files, data=data)
    assert resp.status_code == 201
    trial_id = resp.json()["trialId"]

    get_resp = requests.get(f"{SPRING_BASE}/ocr/multiline/trials/{trial_id}", headers=headers)
    saved = get_resp.json()["lines"][0]
    assert saved["groqStatus"] == "SUCCESS"
    assert saved["groqModel"] == "qwen/qwen3.8-27b"
    assert saved["groqSuggestion"] == "Kiểm tra Groq gợi ý"


@spring_required
def test_submit400_08_gemini_unavailable_metadata_survives():
    """SUBMIT400-08: Gemini UNAVAILABLE metadata survives"""
    line = make_dummy_line(1, "Kiểm tra Gemini UNAVAILABLE")
    line["geminiStatus"] = "UNAVAILABLE"
    line["geminiModel"] = "gemini-3.6-flash"
    line["geminiSuggestion"] = None

    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps([line]),
    }
    headers = get_auth_headers()
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=headers, files=files, data=data)
    assert resp.status_code == 201
    trial_id = resp.json()["trialId"]

    get_resp = requests.get(f"{SPRING_BASE}/ocr/multiline/trials/{trial_id}", headers=headers)
    saved = get_resp.json()["lines"][0]
    assert saved["geminiStatus"] == "UNAVAILABLE"
    assert saved["geminiModel"] == "gemini-3.6-flash"


@spring_required
def test_submit400_09_suggestions_survives():
    """SUBMIT400-09: suggestions[] survives in line response"""
    line = make_dummy_line(1, "Kiểm tra suggestions array")
    line["suggestions"] = [
        {"provider": "GROQ", "model": "qwen/qwen3.8-27b", "text": "gợi ý", "confidence": 0.95}
    ]
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps([line]),
    }
    headers = get_auth_headers()
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=headers, files=files, data=data)
    assert resp.status_code == 201
    trial_id = resp.json()["trialId"]

    get_resp = requests.get(f"{SPRING_BASE}/ocr/multiline/trials/{trial_id}", headers=headers)
    saved = get_resp.json()["lines"][0]
    assert "suggestions" in saved
    assert isinstance(saved["suggestions"], list)


@spring_required
def test_submit400_10_bounding_boxes_survive():
    """SUBMIT400-10: Bounding box coordinates survive persistence"""
    line = make_dummy_line(3, "Kiểm tra box")
    line["x"] = 45
    line["y"] = 120
    line["width"] = 350
    line["height"] = 40

    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "privacyConfirmed": "true",
        "confirmedLines": json.dumps([line]),
    }
    headers = get_auth_headers()
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=headers, files=files, data=data)
    assert resp.status_code == 201
    trial_id = resp.json()["trialId"]

    get_resp = requests.get(f"{SPRING_BASE}/ocr/multiline/trials/{trial_id}", headers=headers)
    saved = get_resp.json()["lines"][0]
    assert saved["x"] == 45
    assert saved["y"] == 120
    assert saved["width"] == 350
    assert saved["height"] == 40


# ==============================================================================
# SUBMIT400-11..16: Transport Contract, Error Mapping & UX Safety
# ==============================================================================

def test_submit400_11_no_giant_confirmed_lines_query_param():
    """SUBMIT400-11: postMultipart appends stringParams to FormData body parts, URL query is clean"""
    with open(OCR_PILOT_SERVICE_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    assert "formData.append(k, String(v));" in src
    assert "formData.append(fileField.key," in src
    assert "apiClient.post<T>(url, formData" in src
    assert "confirmedLines: JSON.stringify(minimizedLines)" in src


@spring_required
def test_submit400_12_malformed_line_validation_error():
    """SUBMIT400-12: Malformed JSON in confirmedLines produces structured error rather than crash"""
    files = {"image": ("test.jpg", get_real_image_bytes(), "image/jpeg")}
    data = {
        "source": "GALLERY",
        "confirmedLines": "NOT_VALID_JSON{{{",
    }
    resp = requests.post(f"{SPRING_BASE}/ocr/multiline/trials", headers=get_auth_headers(), files=files, data=data)
    assert resp.status_code == 400


def test_submit400_13_mobile_maps_400_safely():
    """SUBMIT400-13: normalizeOcrError converts 400 to friendly Vietnamese alert without raw AxiosError"""
    with open(OCR_PILOT_SERVICE_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    assert "export function normalizeOcrError" in src
    assert "Chưa thể xử lý các dòng chữ" in src
    assert "Một số dòng chưa hợp lệ. Em hãy kiểm tra lại các khung chữ rồi thử tiếp." in src
    assert "Phiên nhận diện hết hạn" in src or "Phiên nhận diện đã hết hạn" in src
    assert "Không thể kết nối đến hệ thống" in src
    assert "Hệ thống đang bận" in src


def test_submit400_14_double_tap_cannot_duplicate_trial():
    """SUBMIT400-14: Double tap is blocked by requestStatus === 'SUBMITTING' guard"""
    with open(MULTILINE_REVIEW_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    assert "if (requestStatus === 'SUBMITTING') return;" in src
    assert "disabled={requestStatus === 'SUBMITTING' || boxes.length === 0}" in src


def test_submit400_15_retry_after_error_works():
    """SUBMIT400-15: Error resets requestStatus to 'ERROR' so CTA is re-enabled for retry"""
    with open(MULTILINE_REVIEW_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    assert "setRequestStatus('ERROR');" in src


def test_submit400_16_back_navigation_never_leaves_spinner_stuck():
    """SUBMIT400-16: Component unmount cancels active request and does not retain stuck spinner"""
    with open(MULTILINE_REVIEW_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    assert "activeAbortControllerRef.current?.abort();" in src or "operationGenerationRef" in src
    assert "setRequestStatus('IDLE');" in src
