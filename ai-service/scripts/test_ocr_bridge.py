"""
Developer CLI tool for testing YOLO-CRNN OCR Bridge on local images.
Usage:
    python test_ocr_bridge.py path/to/image.jpg
"""
import sys
import os
import argparse
from pathlib import Path
from PIL import Image

# Ensure app root is in sys.path
_SCRIPT_DIR = Path(__file__).resolve().parent
_SERVICE_DIR = _SCRIPT_DIR.parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.config import settings
from app.recognition.model_engine import ModelRecognitionEngine
from app.layout.row_grouper import RowGrouper
from app.ocr.bridge import OcrBridge
from app.parsing.parser import StructuredParser


def run_bridge_diagnostic(image_path: str, provider: str = "crnn_vi_handwriting_v1", bridge_mode: str = "shadow"):
    path = Path(image_path)
    if not path.is_file():
        print(f"Error: Image file not found at '{image_path}'")
        sys.exit(1)

    print("=" * 65)
    print("   MATHVISION KIDS — YOLO-CRNN OCR BRIDGE DIAGNOSTIC TOOL")
    print("=" * 65)
    print(f"Image Path  : {path.resolve()}")
    print(f"OCR Provider: {provider}")
    print(f"Bridge Mode : {bridge_mode}")
    print("-" * 65)

    # 1. Initialize engine
    engine = ModelRecognitionEngine()
    if not engine.is_ready:
        print("[FAIL] ModelRecognitionEngine is not ready (missing manifest or artifact).")
        sys.exit(1)

    # 2. Open image
    pil_image = Image.open(str(path)).convert("RGB")
    img_w, img_h = pil_image.size
    print(f"Image Dimensions: {img_w} x {img_h} px")

    # 3. Detect with YOLO
    imgsz = engine.manifest.inputWidth if (engine.manifest and engine.manifest.inputWidth) else 640
    results = engine._yolo_model(pil_image, conf=engine.adapter.conf_threshold, imgsz=imgsz, verbose=False)
    raw_boxes = results[0].boxes
    recognition_result = engine.adapter.process_detections(raw_boxes, img_w, img_h)

    print(f"Detections  : {len(recognition_result.tokens)} tokens (Status: {recognition_result.status})")

    # 4. Group rows
    grouper = RowGrouper()
    row_groups = grouper.group(recognition_result.tokens, img_w=img_w, img_h=img_h)
    print(f"Rows Grouped: {len(row_groups)} rows\n")

    # 5. Run OCR Bridge
    bridge = OcrBridge(provider_type=provider, bridge_mode=bridge_mode)
    bridge_result = bridge.recognize_rows(pil_image, row_groups)

    for rec in bridge_result.line_recognitions:
        print(f"Row {rec.row_index}:")
        print(f"  YOLO     : {rec.yolo_text}")
        print(f"  CRNN     : {rec.crnn_text if rec.crnn_text is not None else '<not run>'}")
        print(f"  Agreement: {rec.agreement}")
        if rec.error:
            print(f"  Error    : {rec.error}")
        print()

    print(f"All Rows Agree : {bridge_result.all_rows_agree}")
    print(f"Bridge Latency : {bridge_result.execution_time_ms} ms")

    # 6. Parse structured exercise (using unchanged YOLO tokens)
    parser = StructuredParser()
    print("\nParser Result:")
    try:
        parsed = parser.parse(recognition_result)
        print(f"  Status   : {parsed.status}")
        print(f"  Operation: {parsed.operationType}")
        print(f"  Operands : {parsed.operands}")
        print(f"  Result   : {parsed.result}")
    except Exception as e:
        print(f"  Status   : ERROR ({type(e).__name__}: {e})")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test YOLO-CRNN OCR Bridge on local image.")
    parser.add_argument("image", help="Path to input image")
    parser.add_argument("--provider", default="crnn_vi_handwriting_v1", help="OCR provider name")
    parser.add_argument("--bridge-mode", default="shadow", help="Bridge mode (off | shadow)")
    args = parser.parse_args()

    run_bridge_diagnostic(args.image, provider=args.provider, bridge_mode=args.bridge_mode)
