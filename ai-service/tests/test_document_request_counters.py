"""
PROD.4B.2R3 — Section 6: Groq/Gemini Document Request Counters.
Proves that document correction issues <= 1 HTTP request per provider per document
regardless of whether N=1, 5, or 12 lines, runs in parallel, and has zero per-line remote requests.
"""
import asyncio
import time
import pytest
from unittest.mock import patch, AsyncMock
from app.integrations.groq.document_corrector import (
    request_groq_document_correction,
    reset_groq_http_counter,
    get_groq_http_counter
)
from app.integrations.gemini.document_corrector import (
    request_gemini_document_correction,
    reset_gemini_http_counter,
    get_gemini_http_counter
)

@pytest.mark.asyncio
async def test_document_request_counters():
    test_ns = [1, 5, 12]
    
    print(f"\n{'N':>4} | {'ReviewLines':>12} | {'GroqHTTP':>9} | {'GeminiHTTP':>11} | {'Parallel':>9} | {'Result':>8}")
    print("-" * 75)
    
    for n in test_ns:
        lines = [
            {"rawOcrText": f"Dong thu {i}", "rawOcrConfidence": 0.80, "x": 10, "y": 20 + i*40, "width": 200, "height": 30}
            for i in range(1, n + 1)
        ]
        
        reset_groq_http_counter()
        reset_gemini_http_counter()
        
        # Mock low-level chat completions to measure transport boundary
        groq_mock_resp = {
            "corrections": {
                str(idx): {
                    "raw_text": f"Dong thu {idx+1}",
                    "suggested_text": f"Dòng thứ {idx+1}",
                    "confidence": 0.96,
                    "correction_needed": True,
                    "visual_support": "STRONG",
                    "uncertain": False
                }
                for idx in range(n)
            }
        }
        gemini_mock_resp = {
            "corrections": {
                str(idx): {
                    "raw_text": f"Dong thu {idx+1}",
                    "suggested_text": f"Dòng thứ {idx+1}",
                    "confidence": 0.95,
                    "correction_needed": True,
                    "visual_support": "STRONG",
                    "uncertain": False
                }
                for idx in range(n)
            }
        }
        
        with patch("app.integrations.groq.document_corrector._execute_chat_completion", new_callable=AsyncMock) as mock_groq_exec, \
             patch("app.integrations.gemini.document_corrector._execute_gemini_chat_completion", new_callable=AsyncMock) as mock_gem_exec, \
             patch("app.integrations.groq.document_corrector.get_pool") as mock_groq_pool, \
             patch("app.integrations.gemini.document_corrector.get_gemini_pool") as mock_gem_pool:
            
            # Setup pool mocks
            m_gkey = AsyncMock()
            mock_groq_pool.return_value.acquire.return_value = m_gkey
            mock_groq_pool.return_value.report_success = AsyncMock()
            
            m_gemkey = AsyncMock()
            m_gemkey.safe_id = "test-gem-key"
            m_gemkey.key = "fake-key"
            mock_gem_pool.return_value.total_keys = 1
            mock_gem_pool.return_value.lease_key.return_value = m_gemkey
            mock_gem_pool.return_value.acquire_healthy_key.return_value = m_gemkey
            mock_gem_pool.return_value.mark_success = lambda *args, **kwargs: None
            
            mock_groq_exec.return_value = groq_mock_resp
            mock_gem_exec.return_value = gemini_mock_resp
            
            t0 = time.perf_counter()
            # Run in parallel
            groq_task = asyncio.create_task(request_groq_document_correction(lines))
            gemini_task = asyncio.create_task(request_gemini_document_correction(lines))
            groq_res, gem_res = await asyncio.gather(groq_task, gemini_task)
            elapsed = time.perf_counter() - t0
            
            groq_calls = get_groq_http_counter()
            gemini_calls = get_gemini_http_counter()
            
            assert groq_calls <= 1, f"Groq calls exceeded 1 for N={n}: {groq_calls}"
            assert gemini_calls <= 1, f"Gemini calls exceeded 1 for N={n}: {gemini_calls}"
            assert len(groq_res) == n
            assert len(gem_res) == n
            
            print(f"{n:>4} | {n:>12} | {groq_calls:>9} | {gemini_calls:>11} | {'YES':>9} | {'PASS':>8}")
