import io
import sys
import json
import logging
from pathlib import Path

# Ensure UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from fastapi.testclient import TestClient
from app.main import app

# Silence verbose httpx logging
logging.getLogger("httpx").setLevel(logging.WARNING)

client = TestClient(app)
fixture_path = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "ocr_eval" / "OWNER_POEM_8_LINES.png"
img_bytes = fixture_path.read_bytes()

resp = client.post(
    "/internal/v1/ocr/detect-lines",
    content=img_bytes,
    headers={"X-Internal-API-Key": settings.internal_api_key},
)

data = resp.json()
lines = data.get("lines", [])
print(f"Detected lines count: {len(lines)}")
print()
print("| line | raw OCR | raw conf | trigger reason | Groq status/suggestion | Gemini status/suggestion | Gemini model | finalText before user |")
print("|---|---|---|---|---|---|---|---|")

for i, l in enumerate(lines, start=1):
    raw = l.get("rawOcrText", "")
    conf = f"{l.get('rawOcrConfidence', 0.0):.4f}"
    
    # Trigger reason
    reason = l.get("correctionReason") or ("TRIGGERED" if l.get("groqStatus") or l.get("geminiStatus") else "NOT_TRIGGERED")
    
    # Groq suggestion
    if l.get("groqStatus") == "SUCCESS":
        groq_sug = f"SUCCESS / \"{l.get('groqSuggestion')}\""
    elif l.get("groqStatus"):
        groq_sug = f"{l.get('groqStatus')} / (none)"
    else:
        groq_sug = "NOT_TRIGGERED"

    # Gemini suggestion
    if l.get("geminiStatus") == "SUCCESS":
        gem_sug = f"SUCCESS / \"{l.get('geminiSuggestion')}\""
    elif l.get("geminiStatus"):
        gem_sug = f"{l.get('geminiStatus')} / (none)"
    else:
        gem_sug = "NOT_TRIGGERED"

    gem_model = l.get("geminiModel") or settings.gemini_model
    final = l.get("finalText", "")

    print(f"| {i} | {raw} | {conf} | {reason} | {groq_sug} | {gem_sug} | {gem_model} | {final} |")

print()
print(f"AUTO_APPLY_UI_LOCK: {'PASS' if all(l.get('finalText') == l.get('rawOcrText') for l in lines) else 'FAIL'}")
print(f"Groq used: {data.get('diagnostics', {}).get('groqUsed')}")
print(f"Gemini used: {data.get('diagnostics', {}).get('geminiUsed')}")
print(f"Gemini model in diagnostics: {data.get('diagnostics', {}).get('geminiModel')}")
