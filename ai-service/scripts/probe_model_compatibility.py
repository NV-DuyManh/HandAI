import hashlib
import json
import os
import sys
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.config import settings

def get_safe_id(key: str) -> str:
    return f"sha256:{hashlib.sha256(key.encode()).hexdigest()[:16]}"

keys = [k.strip() for k in settings.gemini_api_keys.split(",") if k.strip()]
print(f"Loaded {len(keys)} unique owner keys.")

payload = {
    "contents": [{"parts": [{"text": "Say 'OK' in JSON format: {\"status\": \"OK\"}"}]}],
    "generationConfig": {"responseMimeType": "application/json"}
}

results = []

for idx, k in enumerate(keys):
    safe_id = get_safe_id(k)
    row = {
        "index": idx,
        "keyFingerprint": safe_id,
        "avail_25": "UNKNOWN",
        "avail_36": "UNKNOWN",
        "auth_status": "VALID",
        "quota_status": "OK",
        "recommended_state": "UNKNOWN",
        "detail_25": "",
        "detail_36": ""
    }
    
    # 1. Probe 2.5-flash
    url_25 = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={k}"
    try:
        r25 = httpx.post(url_25, json=payload, timeout=8.0)
        if r25.status_code == 200:
            row["avail_25"] = "SUPPORTED"
            row["detail_25"] = "200 SUCCESS"
        elif r25.status_code == 429:
            row["avail_25"] = "SUPPORTED"
            row["quota_status"] = "RATE_LIMIT_429"
            row["detail_25"] = "429 Quota Exceeded"
        elif r25.status_code == 404:
            row["avail_25"] = "MODEL_UNAVAILABLE_404"
            row["detail_25"] = "404 Not Available to this project"
        elif r25.status_code == 403:
            row["avail_25"] = "AUTH_ERROR"
            row["auth_status"] = "CONSUMER_SUSPENDED" if "SUSPENDED" in r25.text else "FORBIDDEN_403"
            row["detail_25"] = "403 Forbidden/Suspended"
        else:
            row["avail_25"] = f"HTTP_{r25.status_code}"
            row["detail_25"] = r25.text[:60]
    except Exception as e:
        row["avail_25"] = "EXCEPTION"
        row["detail_25"] = str(e)

    # 2. Probe 3.6-flash
    url_36 = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={k}"
    try:
        r36 = httpx.post(url_36, json=payload, timeout=8.0)
        if r36.status_code == 200:
            row["avail_36"] = "SUPPORTED"
            row["detail_36"] = "200 SUCCESS"
        elif r36.status_code == 429:
            row["avail_36"] = "SUPPORTED"
            row["quota_status"] = "RATE_LIMIT_429"
            row["detail_36"] = "429 Quota Exceeded"
        elif r36.status_code == 404:
            row["avail_36"] = "MODEL_UNAVAILABLE_404"
            row["detail_36"] = "404 Not Available"
        elif r36.status_code == 403:
            row["avail_36"] = "AUTH_ERROR"
            if row["auth_status"] == "VALID":
                row["auth_status"] = "CONSUMER_SUSPENDED" if "SUSPENDED" in r36.text else "FORBIDDEN_403"
            row["detail_36"] = "403 Forbidden/Suspended"
        else:
            row["avail_36"] = f"HTTP_{r36.status_code}"
            row["detail_36"] = r36.text[:60]
    except Exception as e:
        row["avail_36"] = "EXCEPTION"
        row["detail_36"] = str(e)

    # Determine recommended state
    if row["auth_status"] in ("CONSUMER_SUSPENDED", "FORBIDDEN_403", "AUTH_ERROR"):
        row["recommended_state"] = "DISABLED_AUTH"
    elif row["avail_36"] == "SUPPORTED" and row["detail_36"] == "200 SUCCESS":
        row["recommended_state"] = "HEALTHY"
    elif row["quota_status"] == "RATE_LIMIT_429":
        row["recommended_state"] = "COOLING_DOWN"
    elif row["avail_36"] == "MODEL_UNAVAILABLE_404":
        row["recommended_state"] = "DEGRADED"
    else:
        row["recommended_state"] = "DEGRADED"

    results.append(row)
    print(f"[{idx}] {safe_id}: 2.5={row['avail_25']} ({row['detail_25']}) | 3.6={row['avail_36']} ({row['detail_36']}) | auth={row['auth_status']} | quota={row['quota_status']} | state={row['recommended_state']}")

print("\n=== COMPATIBILITY SUMMARY TABLE ===")
print("| keyFingerprint | 2.5 availability | 3.6 availability | auth status | quota status | recommended state |")
print("|---|---|---|---|---|---|")
for r in results:
    print(f"| `{r['keyFingerprint']}` | {r['avail_25']} | {r['avail_36']} | {r['auth_status']} | {r['quota_status']} | {r['recommended_state']} |")
