"""
Thin async HTTP client for Groq API.
Accepts a single key per call — does NOT hold a permanent key reference.
"""

import json
import logging
import time
from typing import Optional

import httpx

from app.integrations.groq.key_pool import KeyEntry, GroqKeyPool
from app.integrations.groq.schemas import GroqLineAnalysis

logger = logging.getLogger(__name__)

GROQ_API_BASE = "https://api.groq.com/openai/v1"


class GroqError(Exception):
    """Raised with error_class for the pool to classify."""
    def __init__(self, error_class: str, message: str, retry_after: Optional[float] = None):
        super().__init__(message)
        self.error_class = error_class
        self.retry_after = retry_after


async def _execute_chat_completion(
    payload: dict,
    key_entry: KeyEntry,
    timeout_seconds: float = 25.0,
    connect_timeout: float = 8.0,
) -> dict:
    """
    Execute chat completion HTTP request with rigorous error classification.
    """
    headers = {
        "Authorization": f"Bearer {key_entry.raw_key}",
        "Content-Type": "application/json",
    }

    t0 = time.time()
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout=timeout_seconds, connect=connect_timeout)
        ) as client:
            resp = await client.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers=headers,
                json=payload,
            )
    except httpx.ConnectTimeout:
        raise GroqError("TIMEOUT", "Groq connect timeout")
    except httpx.ReadTimeout:
        raise GroqError("TIMEOUT", "Groq read timeout")
    except httpx.NetworkError as e:
        raise GroqError("TRANSIENT_NETWORK", f"Groq network error: {type(e).__name__}")

    elapsed = time.time() - t0

    if resp.status_code == 401:
        raise GroqError("AUTH_INVALID", f"Groq 401 for key {key_entry.safe_id}")
    if resp.status_code == 403:
        raise GroqError("AUTH_FORBIDDEN", f"Groq 403 for key {key_entry.safe_id}")
    if resp.status_code == 429:
        retry_after = None
        ra = resp.headers.get("retry-after")
        if ra:
            try:
                retry_after = float(ra)
            except ValueError:
                pass
        raise GroqError("RATE_LIMIT", f"Groq 429 for key {key_entry.safe_id}", retry_after=retry_after)
    if resp.status_code == 400:
        raise GroqError("BAD_REQUEST", f"Groq 400: {resp.text[:200]}")
    if resp.status_code == 404:
        raise GroqError("MODEL_UNAVAILABLE", f"Groq 404 model={payload.get('model')}")
    if resp.status_code in (500, 502, 503, 504):
        raise GroqError("PROVIDER_TRANSIENT", f"Groq {resp.status_code}")
    if not resp.is_success:
        raise GroqError("TRANSIENT_NETWORK", f"Groq unexpected {resp.status_code}")

    try:
        data = resp.json()
        raw_content = data["choices"][0]["message"]["content"]
        parsed_json = json.loads(raw_content)
    except (KeyError, json.JSONDecodeError, IndexError) as e:
        raise GroqError("RESPONSE_VALIDATION_ERROR", f"Groq malformed response: {e}")

    logger.info(
        f"[GroqClient] key={key_entry.safe_id} model={payload.get('model')} elapsed={elapsed:.2f}s"
    )
    return parsed_json


async def call_groq_vision(
    model: str,
    system_prompt: str,
    user_text: str,
    image_b64: str,
    image_media_type: str,
    key_entry: KeyEntry,
    timeout_seconds: float = 25.0,
    connect_timeout: float = 8.0,
    overlay_b64: Optional[str] = None,
    overlay_media_type: str = "image/jpeg",
) -> GroqLineAnalysis:
    """
    Call Groq Chat Completions with one primary image (+ optional overlay).
    Returns validated GroqLineAnalysis.
    Raises GroqError with error_class on failure.
    """
    content = [
        {"type": "text", "text": user_text},
        {
            "type": "image_url",
            "image_url": {"url": f"data:{image_media_type};base64,{image_b64}"},
        },
    ]
    if overlay_b64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{overlay_media_type};base64,{overlay_b64}"},
        })

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }

    parsed_json = await _execute_chat_completion(
        payload, key_entry, timeout_seconds=timeout_seconds, connect_timeout=connect_timeout
    )

    try:
        analysis = GroqLineAnalysis.model_validate(parsed_json)
    except Exception as e:
        raise GroqError("RESPONSE_VALIDATION_ERROR", f"Groq schema validation failed: {e}")

    return analysis


async def call_groq_correction(
    model: str,
    system_prompt: str,
    user_text: str,
    line_crop_b64: str,
    key_entry: KeyEntry,
    timeout_seconds: float = 25.0,
    connect_timeout: float = 8.0,
) -> dict:
    """
    Call Groq Chat Completions for OCR post-correction on a line crop.
    Returns parsed JSON dict.
    Raises GroqError with error_class on failure.
    """
    content = [
        {"type": "text", "text": user_text},
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{line_crop_b64}"},
        },
    ]

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }

    return await _execute_chat_completion(
        payload, key_entry, timeout_seconds=timeout_seconds, connect_timeout=connect_timeout
    )

