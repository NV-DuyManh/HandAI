import os
import cv2
import pytest
import app.api.generalized_pipeline as gp
from app.api.ocr import detect_text_lines

@pytest.fixture(autouse=True)
def clean_cache():
    gp.clear_detection_cache()
    yield
    gp.clear_detection_cache()

def get_test_image():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    img_path = os.path.join(base_dir, 'tests', 'fixtures', 'canonical_handwriting', 'OWNER_POEM_BLOCK_1.png')
    if not os.path.exists(img_path):
        img_path = os.path.join(base_dir, 'tests', 'fixtures', 'ocr_eval', 'OWNER_POEM_BLOCK_1.png')
    img = cv2.imread(img_path)
    assert img is not None, f"Image not found at {img_path}"
    return img

def test_true_redetect_lifecycle_and_caching():
    img = get_test_image()

    # 1. First Standard Request (force_redetect=False)
    lines1, diag1 = gp.run_generalized_line_detection(img, force_redetect=False, request_id="req-001")
    assert len(lines1) == 4
    assert diag1["cacheHit"] is False
    assert diag1["detectionRunId"] is not None
    assert diag1["requestId"] == "req-001"
    run_id_1 = diag1["detectionRunId"]

    # 2. Subsequent Standard Request (force_redetect=False) -> Cache Hit!
    lines2, diag2 = gp.run_generalized_line_detection(img, force_redetect=False, request_id="req-002")
    assert len(lines2) == 4
    assert diag2["cacheHit"] is True
    assert diag2["detectionRunId"] == run_id_1
    assert diag2["requestId"] == "req-002"

    # 3. Force Redetect (force_redetect=True) -> Cache Bypassed, New Run ID issued!
    lines3, diag3 = gp.run_generalized_line_detection(img, force_redetect=True, request_id="req-003")
    assert len(lines3) == 4
    assert diag3["cacheHit"] is False
    assert diag3["forceRedetect"] is True
    assert diag3["detectionRunId"] != run_id_1
    assert diag3["requestId"] == "req-003"

def test_true_redetect_preserves_superior_standard_result(monkeypatch):
    img = get_test_image()

    # Step 1: Standard detection produces a strong valid segmentation (score > 90)
    lines_std, diag_std = gp.run_generalized_line_detection(img, force_redetect=False, request_id="req-std")
    assert len(lines_std) == 4
    assert diag_std["structural_quality"] >= 90.0
    std_run_id = diag_std["detectionRunId"]

    # Step 2: Simulate a degraded retry (e.g. noise/lighting causes retry to return lower quality score)
    orig_run_single_profile = gp._run_single_profile
    def mock_degraded_single_profile(*args, **kwargs):
        lines, diag, score, mask, median_h = orig_run_single_profile(*args, **kwargs)
        # Artificially return degraded score and fewer boxes
        return lines[:2], diag, 45.0, mask, median_h

    monkeypatch.setattr(gp, "_run_single_profile", mock_degraded_single_profile)

    # Step 3: Run with force_redetect=True
    lines_retry, diag_retry = gp.run_generalized_line_detection(img, force_redetect=True, request_id="req-retry")

    # The system MUST preserve the better STANDARD result!
    assert diag_retry["qualitySelection"] == "PRESERVED_SUPERIOR_STANDARD"
    assert len(lines_retry) == 4  # Preserved standard 4 lines, not degraded 2
    assert diag_retry["cacheHit"] is False
    assert diag_retry["forceRedetect"] is True
    assert diag_retry["detectionRunId"] != std_run_id
    assert diag_retry["previousRunId"] == std_run_id
    assert diag_retry["requestId"] == "req-retry"

def test_detect_text_lines_contract_passthrough():
    img = get_test_image()

    lines, diag = detect_text_lines(img, force_redetect=False, request_id="contract-01")
    assert len(lines) == 4
    assert diag["cacheHit"] is False
    assert diag["detectionRunId"] is not None

    lines2, diag2 = detect_text_lines(img, force_redetect=False, request_id="contract-02")
    assert diag2["cacheHit"] is True
    assert diag2["detectionRunId"] == diag["detectionRunId"]
