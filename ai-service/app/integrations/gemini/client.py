"""
Async client for Google Gemini Multimodal API.
Provides robust timeout isolation, error classification, and structured JSON parsing.
"""

import json
import logging
import re
import time
from typing import Optional, Dict, Any
import httpx

from app.integrations.gemini.key_pool import GeminiKeyEntry
from app.integrations.gemini.schemas import GeminiOcrCorrectionResponse

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiError(Exception):
    def __init__(
        self,
        error_class: str,
        message: str,
        status_code: Optional[int] = None,
        retry_after: Optional[float] = None,
    ):
        super().__init__(message)
        self.error_class = error_class
        self.status_code = status_code
        self.retry_after = retry_after


async def call_gemini_correction(
    model: str,
    system_prompt: str,
    raw_ocr_text: str,
    image_b64: str,
    key_entry: GeminiKeyEntry,
    image_media_type: str = "image/jpeg",
    timeout_seconds: float = 10.0,
    connect_timeout: float = 4.0,
) -> GeminiOcrCorrectionResponse:
    """
    Call Gemini generateContent endpoint with image and raw OCR prompt.
    Returns validated GeminiOcrCorrectionResponse.
    Raises GeminiError on failure.
    """
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent"

    user_text = (
        f"{system_prompt}\n\n"
        f"Input Raw OCR Text: \"{raw_ocr_text}\"\n"
        f"Please analyze the provided line crop and return the minimal visually justified correction JSON."
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_text},
                    {
                        "inlineData": {
                            "mimeType": image_media_type,
                            "data": image_b64,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }

    headers = {"x-goog-api-key": key_entry.raw_key}

    t0 = time.time()
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout=timeout_seconds, connect=connect_timeout)
        ) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.ConnectTimeout:
        raise GeminiError("TIMEOUT", "Gemini connect timeout")
    except httpx.ReadTimeout:
        raise GeminiError("TIMEOUT", "Gemini read timeout")
    except httpx.NetworkError as e:
        raise GeminiError("NETWORK_ERROR", f"Gemini network error: {type(e).__name__}")
    except Exception as e:
        raise GeminiError("UNKNOWN_ERROR", f"Gemini call exception: {e}")

    elapsed = time.time() - t0

    if (
        resp.status_code in (401, 403)
        or (resp.status_code == 400 and ("API_KEY_INVALID" in resp.text or "API key not valid" in resp.text))
    ):
        raise GeminiError("AUTH_ERROR", f"Gemini auth error {resp.status_code}: {resp.text[:200]}")

    if resp.status_code == 429:
        retry_after = None
        ra_hdr = resp.headers.get("Retry-After")
        if ra_hdr:
            try:
                retry_after = float(ra_hdr)
            except ValueError:
                pass
        raise GeminiError("RATE_LIMIT_429", "Gemini 429 rate limit / quota exceeded", retry_after=retry_after)

    if resp.status_code >= 500:
        raise GeminiError("SERVER_ERROR_5XX", f"Gemini server error {resp.status_code}")

    if resp.status_code == 400:
        raise GeminiError("BAD_REQUEST", f"Gemini bad request 400: {resp.text[:200]}")

    if resp.status_code == 404:
        raise GeminiError("MODEL_UNAVAILABLE", f"Gemini model {model} unavailable (404): {resp.text[:200]}")

    if not resp.is_success:
        raise GeminiError("API_ERROR", f"Gemini unexpected status {resp.status_code}: {resp.text[:200]}")

    try:
        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise GeminiError("EMPTY_RESPONSE", "Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts or "text" not in parts[0]:
            raise GeminiError("EMPTY_RESPONSE", "Gemini returned no text content in part")

        raw_json_str = parts[0]["text"].strip()
        if raw_json_str.startswith("```"):
            raw_json_str = re.sub(r"^```(?:json)?\s*", "", raw_json_str)
            raw_json_str = re.sub(r"\s*```$", "", raw_json_str)
        parsed_json = json.loads(raw_json_str)
        if not isinstance(parsed_json, dict):
            parsed_json = {"suggested_text": str(parsed_json)}

        parsed_json["provider"] = "GEMINI"
        if "raw_text" not in parsed_json:
            parsed_json["raw_text"] = raw_ocr_text

        if "suggested_text" not in parsed_json:
            parsed_json["suggested_text"] = (
                parsed_json.get("text")
                or parsed_json.get("corrected_text")
                or raw_ocr_text
            )

        if "correction_needed" not in parsed_json:
            parsed_json["correction_needed"] = (
                parsed_json.get("suggested_text") != raw_ocr_text
            )

        validated = GeminiOcrCorrectionResponse(**parsed_json)
    except (KeyError, json.JSONDecodeError, IndexError) as e:
        raise GeminiError("MALFORMED_RESPONSE", f"Gemini malformed JSON: {e}")
    except Exception as e:
        raise GeminiError("RESPONSE_VALIDATION_ERROR", f"Gemini schema validation failed: {e}")

    logger.info(
        f"[GeminiClient] key={key_entry.safe_id} model={model} elapsed={elapsed:.2f}s success=True"
    )
    return validated
