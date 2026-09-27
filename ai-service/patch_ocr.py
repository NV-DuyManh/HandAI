import sys

with open('app/api/ocr.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Replace imports
content = re.sub(
    r'from app\.integrations\.groq\.corrector import should_request_groq_correction, request_groq_correction\n\s*from app\.integrations\.gemini\.corrector import request_gemini_correction, get_current_gemini_meta',
    'from app.integrations.groq.corrector import should_request_groq_correction\n            from app.integrations.groq.document_corrector import request_document_groq_correction\n            from app.integrations.gemini.document_corrector import request_document_gemini_correction\n            from app.integrations.gemini.corrector import get_current_gemini_meta',
    content
)

# Replace Pass 2 logic
old_pass2 = '''            # Pass 2: Bounded concurrent scheduling across triggered lines
            if triggered_items:
                concurrency_bound = max(1, getattr(settings, "cloud_advisor_max_concurrency", 3))
                sem = asyncio.Semaphore(concurrency_bound)'''

new_pass2_start = '''            # Pass 2: Batch document-level scheduling
            if triggered_items:
                t_gather_start = time.perf_counter()
                
                req_lines = {}
                for idx, line, reason in triggered_items:
                    req_lines[line.line_id] = {
                        "raw_text": line.rawOcrText or "",
                        "confidence": line.rawOcrConfidence or 0.0,
                        "bbox": (line.x, line.y, line.width, line.height)
                    }
                
                async def run_groq():
                    t0 = time.perf_counter()
                    res = await request_document_groq_correction(
                        bgr_image=cv_img,
                        triggered_lines=req_lines,
                        domain="HANDWRITING_TEXT",
                        primary_model=settings.groq_primary_vision_model,
                        auto_apply_confidence=getattr(settings, "groq_post_correction_auto_apply_confidence", 0.92),
                        max_edit_ratio=getattr(settings, "groq_post_correction_max_edit_ratio", 0.35),
                        timeout_seconds=settings.groq_timeout_seconds,
                        connect_timeout=settings.groq_connect_timeout_seconds,
                        cache_ttl=getattr(settings, "groq_correction_cache_ttl_seconds", 3600),
                    )
                    lat = (time.perf_counter() - t0) * 1000.0
                    return res, lat

                async def run_gemini():
                    t0 = time.perf_counter()
                    res = await request_document_gemini_correction(
                        bgr_image=cv_img,
                        triggered_lines=req_lines,
                        domain="HANDWRITING_TEXT",
                        model=getattr(settings, "gemini_model", "gemini-3.6-flash"),
                        timeout_seconds=getattr(settings, "gemini_timeout_seconds", 18.0),
                        connect_timeout=getattr(settings, "gemini_connect_timeout_seconds", 4.0),
                        cache_ttl=getattr(settings, "gemini_correction_cache_ttl_seconds", 3600),
                    )
                    lat = (time.perf_counter() - t0) * 1000.0
                    meta = get_current_gemini_meta()
                    return res, lat, meta

                coros = []
                coro_names = []
                if groq_active:
                    coros.append(run_groq())
                    coro_names.append("GROQ")
                if gemini_active:
                    coros.append(run_gemini())
                    coro_names.append("GEMINI")

                raw_results = await asyncio.gather(*coros, return_exceptions=True)
                parallel_wall_clock_ms = (time.perf_counter() - t_gather_start) * 1000.0

                groq_doc_res, gemini_doc_res = None, None
                groq_lat, gemini_lat = 0.0, 0.0
                gemini_call_meta = {}

                for name, r in zip(coro_names, raw_results):
                    if isinstance(r, Exception):
                        logger.warning(f"[OCR_PILOT] Advisor {name} error: {r}")
                    elif r is not None:
                        if name == "GROQ":
                            groq_doc_res, groq_lat = r
                        else:
                            gemini_doc_res, gemini_lat, gemini_call_meta = r
                            
                groq_total_latency_ms += groq_lat
                gemini_total_latency_ms += gemini_lat
                if groq_doc_res is not None:
                    groq_call_count += 1
                if gemini_doc_res is not None:
                    gemini_call_count += 1
                if groq_call_count > 0 and gemini_call_count > 0:
                    dual_call_count += 1

                for idx, line, trigger_reason in triggered_items:
                    t_line_start = time.perf_counter()
                    groq_res = groq_doc_res.get(line.line_id) if groq_doc_res else None
                    gemini_res = gemini_doc_res.get(line.line_id) if gemini_doc_res else None
                    
                    corr_obj = None
                    gem_obj = None

                    # Process Groq (Advisor 1)
                    if groq_res is not None:
                        corr_obj, decision, edit_ratio, reason = groq_res
                        canonical_groq_dec = normalize_canonical_advisor_decision(decision)
                        line.correctedText = corr_obj.suggested_text
                        line.correctionConfidence = corr_obj.confidence
                        line.correctionDecision = canonical_groq_dec
                        line.groqSuggestion = corr_obj.suggested_text
                        line.groqConfidence = corr_obj.confidence
                        line.groqDecision = canonical_groq_dec
                        line.groqStatus = "SUCCESS"
                        
                        if canonical_groq_dec in ("AUTO_APPLY_SAFE", "AUTO_APPLY"):
                            line.correctionApplied = True
                            line.finalText = line.correctedText
                            any_correction_applied = True
                        else:
                            line.correctionApplied = False
                            line.finalText = line.rawOcrText
                    elif groq_active:
                        line.correctedText = None
                        line.correctionApplied = False
                        line.correctionDecision = "KEEP_RAW"
                        line.groqDecision = "KEEP_RAW"
                        line.finalText = line.rawOcrText
                        if not line.groqStatus:
                            line.groqStatus = "UNAVAILABLE"
                    else:
                        line.correctedText = None
                        line.correctionApplied = False
                        line.correctionDecision = "KEEP_RAW"
                        line.finalText = line.rawOcrText

                    # Process Gemini (Advisor 2 - Advisory-first, never silently overrides finalText)
                    if gemini_active:
                        line.geminiModel = getattr(settings, "gemini_model", "gemini-3.6-flash")
                    if gemini_res is not None:
                        gem_obj, gem_dec, gem_ratio, gem_reason = gemini_res
                        canonical_gem_dec = normalize_canonical_advisor_decision(gem_dec)
                        line.geminiSuggestion = gem_obj.suggested_text
                        line.geminiConfidence = gem_obj.confidence
                        line.geminiDecision = canonical_gem_dec
                        line.geminiStatus = "SUCCESS"
                    elif gemini_active:
                        line.geminiSuggestion = None
                        line.geminiDecision = "KEEP_RAW"
                        if not line.geminiStatus:
                            line.geminiStatus = "UNAVAILABLE"

                    # Populate unified suggestions list
                    line_suggestions = []
                    if line.groqStatus == "SUCCESS" and line.groqSuggestion:
                        line_suggestions.append({
                            "provider": "GROQ",
                            "model": settings.groq_primary_vision_model,
                            "text": line.groqSuggestion,
                            "confidence": line.groqConfidence or 0.0,
                            "visualSupport": getattr(corr_obj, "visual_support", "STRONG"),
                            "decision": normalize_canonical_advisor_decision(line.groqDecision),
                            "status": "SUCCESS"
                        })
                        for alt in getattr(corr_obj, "alternative_suggestions", []):
                            if alt and alt.strip() and alt.strip() != line.groqSuggestion:
                                line_suggestions.append({
                                    "provider": "GROQ",
                                    "model": settings.groq_primary_vision_model,
                                    "text": alt.strip(),
                                    "confidence": max(0.5, (line.groqConfidence or 0.8) - 0.05),
                                    "visualSupport": getattr(corr_obj, "visual_support", "MODERATE"),
                                    "decision": "SUGGEST_ONLY",
                                    "status": "SUCCESS"
                                })
                    elif groq_active and line.groqStatus:
                        line_suggestions.append({
                            "provider": "GROQ",
                            "model": settings.groq_primary_vision_model,
                            "text": "",
                            "confidence": 0.0,
                            "visualSupport": "NONE",
                            "decision": "KEEP_RAW",
                            "status": line.groqStatus
                        })

                    if line.geminiStatus == "SUCCESS" and line.geminiSuggestion:
                        line_suggestions.append({
                            "provider": "GEMINI",
                            "model": line.geminiModel or getattr(settings, "gemini_model", "gemini-3.6-flash"),
                            "text": line.geminiSuggestion,
                            "confidence": line.geminiConfidence or 0.0,
                            "visualSupport": getattr(gem_obj, "visual_support", "STRONG"),
                            "decision": normalize_canonical_advisor_decision(line.geminiDecision),
                            "status": "SUCCESS"
                        })
                        for alt in getattr(gem_obj, "alternative_suggestions", []):
                            if alt and alt.strip() and alt.strip() != line.geminiSuggestion:
                                line_suggestions.append({
                                    "provider": "GEMINI",
                                    "model": line.geminiModel or getattr(settings, "gemini_model", "gemini-3.6-flash"),
                                    "text": alt.strip(),
                                    "confidence": max(0.5, (line.geminiConfidence or 0.8) - 0.05),
                                    "visualSupport": getattr(gem_obj, "visual_support", "MODERATE"),
                                    "decision": "SUGGEST_ONLY",
                                    "status": "SUCCESS"
                                })
                    elif gemini_active and line.geminiStatus:
                        line_suggestions.append({
                            "provider": "GEMINI",
                            "model": line.geminiModel or getattr(settings, "gemini_model", "gemini-3.6-flash"),
                            "text": "",
                            "confidence": 0.0,
                            "visualSupport": "NONE",
                            "decision": "KEEP_RAW",
                            "status": line.geminiStatus
                        })

                    line.suggestions = line_suggestions
                    line.text = line.finalText
                    line.predictedText = line.finalText

                    total_line_ms = round((time.perf_counter() - t_line_start) * 1000.0, 2)
                    timing_record = {
                        "line_index": idx,
                        "crnn_ms": getattr(line, "_crnn_ms", 0.0),
                        "groq_ms": round(groq_lat, 2) if groq_res else 0.0,
                        "gemini_ms": round(gemini_lat, 2) if gemini_res else 0.0,
                        "key_attempt_count": gemini_call_meta.get("key_attempt_count", 0),
                        "key_failover_ms": gemini_call_meta.get("key_failover_ms", 0.0),
                        "provider_wait_ms": gemini_call_meta.get("provider_wait_ms", 0.0),
                        "total_line_ms": total_line_ms,
                        "trigger_reason": trigger_reason,
                        "groq_status": line.groqStatus,
                        "gemini_status": line.geminiStatus,
                    }
                    line_advisor_timings.append(timing_record)

                # Sort by line_index for clean deterministic ordering
                line_advisor_timings.sort(key=lambda x: x["line_index"])
                sequential_sum_ms = sum(max(t["groq_ms"], t["gemini_ms"]) for t in line_advisor_timings)'''

end_pass2 = '''                # Sort by line_index for clean deterministic ordering
                line_advisor_timings.sort(key=lambda x: x["line_index"])
                sequential_sum_ms = sum(max(t["groq_ms"], t["gemini_ms"]) for t in line_advisor_timings)'''

start_idx = content.find(old_pass2)
end_idx = content.find(end_pass2) + len(end_pass2)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_pass2_start + content[end_idx:]
    with open('app/api/ocr.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced Pass 2 logic in ocr.py")
else:
    print("Could not find Pass 2 block in ocr.py! start_idx=", start_idx, "end_idx=", content.find(end_pass2))
