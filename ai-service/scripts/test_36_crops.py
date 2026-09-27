import asyncio
import cv2
import base64
import time
import os
import sys

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.integrations.gemini.key_pool import GeminiKeyPool
from app.integrations.gemini.client import call_gemini_correction
from app.integrations.gemini.corrector import GEMINI_CORRECTION_SYSTEM_PROMPT
from app.config import settings

async def test_keys():
    pool = GeminiKeyPool(settings.gemini_api_keys)
    img = cv2.imread("tests/fixtures/ocr_eval/OWNER_POEM_8_LINES.png")
    crop = img[210:259, 66:320]
    _, enc = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    image_b64 = base64.b64encode(enc.tobytes()).decode("utf-8")
    
    for idx in [0, 4, 6, 3]:
        key_entry = pool.entries[idx]
        print(f"Testing key [{idx}] {key_entry.safe_id} on gemini-3.6-flash...")
        t0 = time.time()
        try:
            res = await call_gemini_correction(
                model="gemini-3.6-flash",
                system_prompt=GEMINI_CORRECTION_SYSTEM_PROMPT,
                raw_ocr_text="Mọc trên đổi quề",
                image_b64=image_b64,
                key_entry=key_entry,
                timeout_seconds=20.0
            )
            dur = time.time() - t0
            print(f"SUCCESS! key={key_entry.safe_id}, dur={dur:.2f}s")
            print(f"  Suggested: \"{res.suggested_text}\"")
            print(f"  Confidence: {res.confidence}")
            print(f"  CorrectionNeeded: {res.correction_needed}")
            return True, key_entry.safe_id, res.suggested_text
        except Exception as e:
            dur = time.time() - t0
            print(f"FAILED! key={key_entry.safe_id}, dur={dur:.2f}s, error={e}")

    return False, None, None

if __name__ == "__main__":
    asyncio.run(test_keys())
