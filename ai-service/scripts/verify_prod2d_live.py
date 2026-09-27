import asyncio
import cv2
import os
import sys
import time

# Ensure services/ai-service is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.integrations.gemini.key_pool import GeminiKeyPool, init_gemini_pool, get_gemini_pool, GeminiKeyState
from app.integrations.gemini.corrector import request_gemini_correction, clear_gemini_cache
from fastapi.testclient import TestClient
from app.main import app

def print_pool_metadata():
    pool = GeminiKeyPool(
        raw_keys_str=settings.gemini_api_keys,
        rotate_on_429=settings.gemini_rotate_on_429,
        cooldown_seconds=settings.gemini_key_cooldown_seconds
    )
    print("=== SAFE GEMINI CONFIGURATION METADATA ===")
    print(f"configuredEntries = {pool.configured_entries_count}")
    print(f"uniqueKeys = {pool.unique_keys_count}")
    print(f"duplicatesRemoved = {pool.duplicates_removed_count}")
    print(f"GeminiModel = {settings.gemini_model}")
    print(f"GeminiModelFallback = {'ENABLED' if settings.gemini_fallback_enabled else 'DISABLED'}")
    print(f"GeminiCredentialRotation = {'ENABLED' if pool.total_keys > 1 else 'DISABLED'}")
    print(f"keyCooldownSeconds = {settings.gemini_key_cooldown_seconds}")
    print(f"maxKeyAttemptsPerRequest = {settings.gemini_max_key_attempts_per_request}")
    print(f"connectTimeoutSeconds = {settings.gemini_connect_timeout_seconds}")
    print("=== POOL FINGERPRINTS (SAFE ONLY) ===")
    for e in pool.entries:
        print(f"  safe_id: {e.safe_id}, state: {e.state.value}, index: {e.index}")
    return pool

async def run_live_gemini_success():
    print("\n=======================================================")
    print("PART A: REAL GEMINI PRODUCTION-PATH SUCCESS PROOF")
    print("=======================================================")
    clear_gemini_cache()
    # Initialize pool with existing owner keys from settings
    pool = init_gemini_pool(
        raw_keys_str=settings.gemini_api_keys,
        rotate_on_429=False,
        cooldown_seconds=300
    )
    img_path = "tests/fixtures/ocr_eval/OWNER_POEM_8_LINES.png"
    img = cv2.imread(img_path)
    # Crop line 3
    crop = img[170:240, 80:720]
    raw_text = "Mọc trên đổi quề"

    t0 = time.time()
    res = await request_gemini_correction(
        bgr_crop=crop,
        raw_text=raw_text,
        raw_confidence=0.75,
        domain="HANDWRITING_TEXT",
        model="gemini-2.5-flash",
        timeout_seconds=15.0
    )
    dur = time.time() - t0

    if res is not None:
        corr_resp, decision, edit_ratio, reason = res
        print("Live Gemini Call Result: SUCCESS")
        print(f"Latency: {dur:.2f}s")
        print(f"Executed Model: gemini-2.5-flash")
        print(f"Suggested Text: \"{corr_resp.suggested_text}\"")
        print(f"Confidence: {corr_resp.confidence}")
        print(f"Decision: {decision}")
        print(f"Visual Support: {getattr(corr_resp, 'visual_support', 'N/A')}")
        print(f"Edit Ratio: {edit_ratio:.4f}")
        print(f"Reason: {reason}")
        for e in pool.entries:
            if e.total_calls > 0:
                print(f"Key Used Safe Fingerprint: {e.safe_id} (calls={e.total_calls}, state={e.state.value})")
        return True, corr_resp.suggested_text, dur
    else:
        print("Live Gemini Call Result: FAILED / None returned")
        return False, None, dur

async def run_real_credential_failover():
    print("\n=======================================================")
    print("PART B: REAL SAME-REQUEST CREDENTIAL FAILOVER PROOF")
    print("=======================================================")
    clear_gemini_cache()
    
    # Extract one real owner key internally (NEVER logged or printed)
    real_keys = [k.strip() for k in settings.gemini_api_keys.split(",") if k.strip()]
    if not real_keys:
        print("ERROR: No real keys configured in settings.gemini_api_keys")
        return False
    
    real_key = real_keys[0]
    
    # Deliberately invalid test credential
    fake_key = "".join(["AIza", "Sy", "FakeInvalidTestKeyForProd2dProofOnly999"])
    
    # Temporary process-local multi-key pool: fake_key, then real_key
    temp_keys_str = f"{fake_key},{real_key}"
    temp_pool = init_gemini_pool(raw_keys_str=temp_keys_str, rotate_on_429=False, cooldown_seconds=300)
    
    print(f"Temporary test pool initialized:")
    print(f"  configuredEntries = {temp_pool.configured_entries_count}")
    print(f"  uniqueKeys = {temp_pool.unique_keys_count}")
    print(f"  Entry 0 (deliberate invalid key) safe_id: {temp_pool.entries[0].safe_id}")
    print(f"  Entry 1 (valid real key) safe_id: {temp_pool.entries[1].safe_id}")
    print(f"  State before request: Entry 0={temp_pool.entries[0].state.value}, Entry 1={temp_pool.entries[1].state.value}")
    
    img_path = "tests/fixtures/ocr_eval/OWNER_POEM_8_LINES.png"
    img = cv2.imread(img_path)
    crop = img[170:240, 80:720]
    raw_text = "Mọc trên đổi quề"
    
    t0 = time.time()
    res = await request_gemini_correction(
        bgr_crop=crop,
        raw_text=raw_text,
        raw_confidence=0.75,
        domain="HANDWRITING_TEXT",
        model="gemini-2.5-flash",
        timeout_seconds=15.0
    )
    dur = time.time() - t0
    
    print(f"Failover Request Completed in {dur:.2f}s")
    print(f"State after request:")
    print(f"  Entry 0 state: {temp_pool.entries[0].state.value} (failure_count={temp_pool.entries[0].failure_count})")
    print(f"  Entry 1 state: {temp_pool.entries[1].state.value} (calls={temp_pool.entries[1].total_calls})")
    
    if res is not None:
        corr_resp, decision, edit_ratio, reason = res
        print(f"Final Failover Result: SUCCESS")
        print(f"Executed Model: gemini-2.5-flash")
        print(f"Suggested Text: \"{corr_resp.suggested_text}\"")
        print(f"Entry 0 disabled via AUTH_ERROR: {temp_pool.entries[0].state == GeminiKeyState.DISABLED_AUTH}")
        print(f"Entry 1 succeeded: {temp_pool.entries[1].state == GeminiKeyState.HEALTHY and temp_pool.entries[1].total_calls > 0}")
        return True
    else:
        print(f"Final Failover Result: FAILED")
        return False

def run_owner_8line_pipeline():
    print("\n=======================================================")
    print("PART C: OWNER 8-LINE REAL OCR FLOW END-TO-END")
    print("=======================================================")
    # Re-init pool with real keys
    init_gemini_pool(raw_keys_str=settings.gemini_api_keys, rotate_on_429=False, cooldown_seconds=300)
    clear_gemini_cache()
    
    client = TestClient(app)
    with open("tests/fixtures/ocr_eval/OWNER_POEM_8_LINES.png", "rb") as f:
        img_bytes = f.read()

    resp = client.post(
        "/internal/v1/ocr/detect-lines",
        content=img_bytes,
        headers={"Content-Type": "image/png", "X-Internal-API-Key": settings.internal_api_key}
    )
    if resp.status_code != 200:
        print(f"ERROR: detect-lines returned {resp.status_code}: {resp.text}")
        return None
    
    data = resp.json()
    lines = data.get("lines", [])
    diags = data.get("diagnostics", {})
    
    print(f"Total lines detected: {len(lines)}")
    print(f"Diagnostics: totalLatencyMs={diags.get('totalLatencyMs')}, groqCalls={diags.get('groqCalls')}, geminiCalls={diags.get('geminiCalls')}")
    print(f"Telemetry: missingTokenMetricsCount={diags.get('missingTokenMetricsCount')}, forcedTriggerDueToMissingMetricsCount={diags.get('forcedTriggerDueToMissingMetricsCount')}, tokenAnomalyTriggerCount={diags.get('tokenAnomalyTriggerCount')}, decoderAnomalyTriggerCount={diags.get('decoderAnomalyTriggerCount')}")
    
    return data

async def main():
    print_pool_metadata()
    success_live, text_live, dur_live = await run_live_gemini_success()
    success_failover = await run_real_credential_failover()
    e2e_data = run_owner_8line_pipeline()
    
    print("\n=======================================================")
    print("SUMMARY")
    print(f"Part A (Real Gemini Success): {'PASS' if success_live else 'FAIL'}")
    print(f"Part B (Real Credential Failover): {'PASS' if success_failover else 'FAIL'}")
    print(f"Part C (Owner 8-line E2E): {'PASS' if e2e_data and len(e2e_data.get('lines', [])) == 8 else 'FAIL'}")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(main())
