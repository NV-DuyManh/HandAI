"""
Groq line analyzer — orchestrates the full Groq vision call with:
  - image preprocessing (resize, JPEG encode, base64)
  - candidate overlay generation
  - key pool acquire/report
  - retry with fallback model
  - SHA-based request deduplication cache
  - local fallback on all failures
"""

import asyncio
import base64
import hashlib
import io
import json
import logging
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from app.integrations.groq.client import call_groq_vision, GroqError
from app.integrations.groq.key_pool import GroqKeyPool
from app.integrations.groq.prompts import SYSTEM_PROMPT, GROQ_LINE_PROMPT_VERSION, build_user_message
from app.integrations.groq.schemas import GroqLineAnalysis
from app.schemas.ocr_pilot import LineBox

logger = logging.getLogger(__name__)

# Module-level pool — initialized once from settings
_pool: Optional[GroqKeyPool] = None
# Simple in-memory dedup cache: sha → (result, expire_at)
_cache: dict = {}
_cache_lock = asyncio.Lock()


def init_pool(raw_keys_string: str, cooldown_seconds: int = 60, auth_disable_seconds: int = 1800) -> None:
    global _pool
    _pool = GroqKeyPool(raw_keys_string, cooldown_seconds, auth_disable_seconds)


_last_failure_reason: str = ""


def get_last_failure_reason() -> str:
    global _last_failure_reason
    return _last_failure_reason


def get_pool() -> Optional[GroqKeyPool]:
    return _pool


def _cache_key(image_bytes: bytes, model: str, config_version: str) -> str:
    h = hashlib.sha256(image_bytes + model.encode() + config_version.encode()).hexdigest()
    return h


def _preprocess_image(bgr_image: np.ndarray, max_long_edge: int = 2200, jpeg_quality: int = 92) -> Tuple[bytes, str]:
    """Resize if needed, encode to JPEG, return (bytes, media_type)."""
    h, w = bgr_image.shape[:2]
    if max(h, w) > max_long_edge:
        scale = max_long_edge / max(h, w)
        bgr_image = cv2.resize(bgr_image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    ok, enc = cv2.imencode(".jpg", bgr_image, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    if not ok:
        raise ValueError("Failed to encode image for Groq")
    return enc.tobytes(), "image/jpeg"


def _build_overlay(bgr_image: np.ndarray, local_boxes: List[LineBox], jpeg_quality: int = 92) -> bytes:
    """Draw thin candidate rectangles with IDs on a copy of the image."""
    overlay = bgr_image.copy()
    for i, b in enumerate(local_boxes, 1):
        cv2.rectangle(overlay, (b.x, b.y), (b.x + b.width, b.y + b.height), (0, 100, 255), 1)
        cv2.putText(overlay, str(i), (b.x + 2, b.y + 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 100, 255), 1, cv2.LINE_AA)
    ok, enc = cv2.imencode(".jpg", overlay, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    if not ok:
        raise ValueError("Failed to encode overlay for Groq")
    return enc.tobytes()


def _build_candidate_metadata(local_boxes: List[LineBox], img_w: int, img_h: int) -> list:
    meta = []
    for i, b in enumerate(local_boxes, 1):
        meta.append({
            "id": i,
            "x": b.x, "y": b.y, "w": b.width, "h": b.height,
            "rel_w": b.width / max(1, img_w),
            "rel_h": b.height / max(1, img_h),
            "hint": "body" if b.height > img_h * 0.05 else "accent",
        })
    return meta


async def analyze_with_groq(
    bgr_image: np.ndarray,
    local_boxes: List[LineBox],
    primary_model: str,
    fallback_model: str,
    accept_threshold: float = 0.80,
    second_pass_threshold: float = 0.82,
    timeout_seconds: float = 25.0,
    connect_timeout: float = 8.0,
    max_attempts: int = 3,
    retry_base_ms: int = 400,
    retry_max_ms: int = 4000,
    rotate_on_429: bool = False,
    max_long_edge: int = 2200,
    jpeg_quality: int = 92,
    cache_ttl: int = 300,
) -> Optional[GroqLineAnalysis]:
    """
    Main entry point. Returns GroqLineAnalysis or None (local fallback).
    All retry/key logic is here. Does NOT log raw keys or image bytes.
    """
    pool = get_pool()
    if pool is None or pool.key_count == 0:
        logger.info("[GroqAnalyzer] No keys configured, skipping Groq")
        return None

    img_h, img_w = bgr_image.shape[:2]

    # Preprocess
    try:
        img_bytes, media_type = _preprocess_image(bgr_image, max_long_edge, jpeg_quality)
        overlay_bytes = _build_overlay(bgr_image, local_boxes, jpeg_quality)
    except Exception as e:
        logger.warning(f"[GroqAnalyzer] Image preprocessing failed: {e}")
        return None

    # Cache check
    ck = _cache_key(img_bytes, primary_model, GROQ_LINE_PROMPT_VERSION)
    async with _cache_lock:
        cached = _cache.get(ck)
        if cached and time.time() < cached[1]:
            logger.info("[GroqAnalyzer] Cache hit")
            return cached[0]

    img_b64 = base64.b64encode(img_bytes).decode()
    overlay_b64 = base64.b64encode(overlay_bytes).decode()
    candidate_meta = _build_candidate_metadata(local_boxes, img_w, img_h)
    user_text = build_user_message(candidate_meta)

    req_id = hashlib.sha256(f"{time.time()}_{img_w}_{img_h}".encode()).hexdigest()[:12]
    last_err_class = "UNKNOWN"
    t_start = time.time()

    for model in [primary_model, fallback_model]:
        for attempt in range(max_attempts):
            entry = pool.acquire()
            if entry is None:
                global _last_failure_reason
                _last_failure_reason = "KEYS_EXHAUSTED"
                latency_ms = int((time.time() - t_start) * 1000)
                logger.info(
                    f"[HW-GROQ]\n"
                    f"status: KEYS_EXHAUSTED\n"
                    f"latency: {latency_ms}ms\n"
                    f"groqUsed: false\n"
                    f"analysisSource: LOCAL_FALLBACK\n"
                    f"lineCount: {len(local_boxes)}"
                )
                logger.warning("[GroqAnalyzer] All keys exhausted, using local fallback")
                return None

            logger.info(
                f"[HW-GROQ]\n"
                f"requestId: {req_id}\n"
                f"model: {model}\n"
                f"attempt: {attempt + 1}\n"
                f"keySafeId: {entry.safe_id}\n"
                f"imageWidth: {img_w}\n"
                f"imageHeight: {img_h}"
            )

            try:
                call_t0 = time.time()
                analysis = await call_groq_vision(
                    model=model,
                    system_prompt=SYSTEM_PROMPT,
                    user_text=user_text,
                    image_b64=img_b64,
                    image_media_type=media_type,
                    key_entry=entry,
                    timeout_seconds=timeout_seconds,
                    connect_timeout=connect_timeout,
                    overlay_b64=overlay_b64,
                )
                pool.report_success(entry)
                latency_ms = int((time.time() - call_t0) * 1000)

                # Second pass if needed
                fallback_used = (model == fallback_model)
                if analysis.needs_second_pass or analysis.overall_confidence < second_pass_threshold:
                    logger.info(f"[GroqAnalyzer] Second pass needed (conf={analysis.overall_confidence:.2f})")
                    second_entry = pool.acquire()
                    if second_entry:
                        try:
                            second = await call_groq_vision(
                                model=fallback_model,
                                system_prompt=SYSTEM_PROMPT,
                                user_text=user_text,
                                image_b64=img_b64,
                                image_media_type=media_type,
                                key_entry=second_entry,
                                timeout_seconds=timeout_seconds,
                                connect_timeout=connect_timeout,
                            )
                            pool.report_success(second_entry)
                            if second.overall_confidence > analysis.overall_confidence:
                                analysis = second
                                fallback_used = True
                        except GroqError as se:
                            pool.report_failure(second_entry, se.error_class, getattr(se, "retry_after", None))

                analysis.vision_model = model
                analysis.fallback_used = fallback_used
                analysis.latency_ms = latency_ms
                analysis.request_id = req_id

                logger.info(
                    f"[HW-GROQ]\n"
                    f"status: 200\n"
                    f"latency: {latency_ms}ms\n"
                    f"groqUsed: true\n"
                    f"analysisSource: GROQ_VISION\n"
                    f"lineCount: {analysis.physical_line_count}"
                )

                # Cache result
                async with _cache_lock:
                    _cache[ck] = (analysis, time.time() + cache_ttl)

                return analysis

            except GroqError as e:
                last_err_class = e.error_class
                pool.report_failure(entry, e.error_class, getattr(e, "retry_after", None))
                logger.info(
                    f"[GroqAnalyzer] key={entry.safe_id} model={model} attempt={attempt + 1} "
                    f"error_class={e.error_class}"
                )

                if e.error_class == "MODEL_UNAVAILABLE":
                    break  # try fallback model, not next key

                if e.error_class == "RATE_LIMIT" and not rotate_on_429:
                    wait = getattr(e, "retry_after", None) or (retry_base_ms / 1000.0)
                    logger.info(f"[GroqAnalyzer] 429 cooldown {wait:.1f}s (rotate_on_429=false)")
                    await asyncio.sleep(min(wait, retry_max_ms / 1000.0))
                    _last_failure_reason = "RATE_LIMIT"
                    return None  # Give up this request; local fallback

                if e.error_class in ("BAD_REQUEST", "RESPONSE_VALIDATION_ERROR"):
                    break

                if e.error_class in ("AUTH_INVALID", "AUTH_FORBIDDEN"):
                    continue

                delay = min(retry_base_ms * (2 ** attempt), retry_max_ms) / 1000.0
                await asyncio.sleep(delay)

    _last_failure_reason = last_err_class
    total_latency_ms = int((time.time() - t_start) * 1000)
    logger.info(
        f"[HW-GROQ]\n"
        f"status: {last_err_class}\n"
        f"latency: {total_latency_ms}ms\n"
        f"groqUsed: false\n"
        f"analysisSource: LOCAL_FALLBACK\n"
        f"lineCount: {len(local_boxes)}"
    )
    logger.warning(f"[GroqAnalyzer] All attempts exhausted ({last_err_class}), using local fallback")
    return None
