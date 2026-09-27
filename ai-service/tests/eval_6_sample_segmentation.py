"""
PROD.4A.6 — Direct 6-Sample Segmentation Evaluation.
Reads each of the 6 regression fixture images and evaluates segmentation directly.
Output: sample_id, expected, detected, phantoms, merges, splits, PASS/FAIL
"""
import os
import sys
import cv2

# Add parent dir so we can import the app module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.api.ocr import detect_text_lines

FIXTURE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'fixtures'))

SAMPLES = [
    {"id": "OWNER_POEM_BLOCK_1", "path": os.path.join(FIXTURE_DIR, "real_hw", "OWNER_POEM_BLOCK_1.png"), "expected": 4},
    {"id": "OWNER_POEM_8_LINES", "path": os.path.join(FIXTURE_DIR, "ocr_eval", "OWNER_POEM_8_LINES.png"), "expected": 8},
    {"id": "WIDE_NOTEBOOK_SAMPLE", "path": os.path.join(FIXTURE_DIR, "ocr_eval", "WIDE_NOTEBOOK_SAMPLE.png"), "expected": 9},
    {"id": "REAL_HW_01", "path": os.path.join(FIXTURE_DIR, "real_hw", "REAL-HW-01.jpg"), "expected": 4},
    {"id": "REAL_HW_02", "path": os.path.join(FIXTURE_DIR, "real_hw", "REAL-HW-02.jpg"), "expected": 3},
    {"id": "REAL_HW_03", "path": os.path.join(FIXTURE_DIR, "real_hw", "REAL-HW-03.jpg"), "expected": 2},
]


def evaluate():
    print(f"{'Sample ID':<25} {'Expected':>8} {'Detected':>8} {'Phantoms':>8} {'Merges':>8} {'Splits':>8} {'Result':>8}")
    print("-" * 90)

    all_pass = True
    for sample in SAMPLES:
        sid = sample["id"]
        path = sample["path"]
        expected = sample["expected"]

        if not os.path.exists(path):
            print(f"{sid:<25} {expected:>8} {'N/A':>8} {'N/A':>8} {'N/A':>8} {'N/A':>8} {'FIXTURE_UNAVAILABLE':>8}")
            all_pass = False
            continue

        img = cv2.imread(path)
        if img is None:
            print(f"{sid:<25} {expected:>8} {'N/A':>8} {'N/A':>8} {'N/A':>8} {'N/A':>8} {'READ_ERROR':>8}")
            all_pass = False
            continue

        lines, diag = detect_text_lines(img)
        detected = len(lines)

        phantoms = max(0, detected - expected)
        merges = max(0, expected - detected)
        splits = 0  # splits would require content analysis, not available at segmentation level

        result = "PASS" if detected == expected else "FAIL"
        if result == "FAIL":
            all_pass = False

        print(f"{sid:<25} {expected:>8} {detected:>8} {phantoms:>8} {merges:>8} {splits:>8} {result:>8}")

    print("-" * 90)
    print(f"Overall: {'ALL 6 PASS' if all_pass else 'HAS FAILURES'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(evaluate())
