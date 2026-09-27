import sys, json, io, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)
with open('tests/fixtures/ocr_eval/OWNER_POEM_8_LINES.png', 'rb') as f:
    img_bytes = f.read()

resp = client.post(
    '/internal/v1/ocr/detect-lines',
    content=img_bytes,
    headers={'Content-Type': 'image/png', 'X-Internal-API-Key': settings.internal_api_key}
)
data = resp.json()

lines = data.get('lines', [])
print(f"Total lines: {len(lines)}")

print("\n| Line | BBox (x,y,w,h) | rawOcrText | rawConf | minTokConf | p10TokConf | meanEntropy | tokenAnom | decoderAnom | Trigger Reason | Groq Status | Groq Suggestion | Gemini Status | Gemini Suggestion | finalText (before user) |")
print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")

for idx, l in enumerate(lines):
    order = l.get("order", idx + 1)
    bbox = f"({l['x']},{l['y']},{l['width']},{l['height']})"
    raw = l.get("rawOcrText") or ""
    conf = l.get("rawOcrConfidence") or 0.0
    min_tok = l.get("minTokenConfidence") or 0.0
    p10 = l.get("p10TokenConfidence") or 0.0
    ent = l.get("meanEntropy") or 0.0
    tanom = l.get("tokenAnomalyDetected", False)
    danom = l.get("decoderAnomalyDetected", False)
    groq_st = l.get("groqStatus") or "BYPASS"
    groq_sugg = l.get("groqSuggestion") or "-"
    gem_st = l.get("geminiStatus") or "BYPASS"
    gem_sugg = l.get("geminiSuggestion") or "-"
    final_t = l.get("finalText") or ""
    
    reasons = []
    if conf < 0.82:
        reasons.append(f"rawConf < 0.82 ({conf:.3f})")
    if min_tok < 0.40:
        reasons.append(f"minTok < 0.40 ({min_tok:.3f})")
    if p10 < 0.50:
        reasons.append(f"p10 < 0.50 ({p10:.3f})")
    if ent > 1.20:
        reasons.append(f"entropy > 1.20 ({ent:.3f})")
    if tanom or danom:
        reasons.append("anomaly_detected")
    if not reasons:
        trig_reason = "BYPASS_CLEAN"
    else:
        trig_reason = "; ".join(reasons)
        
    print(f"| {order} | {bbox} | {raw} | {conf:.3f} | {min_tok:.3f} | {p10:.3f} | {ent:.3f} | {tanom} | {danom} | {trig_reason} | {groq_st} | {groq_sugg} | {gem_st} | {gem_sugg} | {final_t} |")
