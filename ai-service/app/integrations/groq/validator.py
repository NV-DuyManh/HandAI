"""
Startup Groq Model Validator.
Validates configured Groq vision models at application startup.
Never crashes application if Groq is unavailable.
"""

import httpx
import logging
import time
from typing import Dict, Any, Optional
from app.config import settings
from app.integrations.groq.line_analyzer import get_pool

logger = logging.getLogger(__name__)

# Cached validation state
_validation_cache: Optional[Dict[str, Any]] = None


async def validate_groq_models(
    primary_model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    timeout_seconds: float = 10.0,
) -> Dict[str, Any]:
    """
    Validate configured models with Groq API.
    Checks availability and vision capability. Logs safe status.
    Never raises an exception.
    """
    global _validation_cache

    primary = primary_model or settings.groq_primary_vision_model
    fallback = fallback_model or settings.groq_fallback_vision_model

    result: Dict[str, Any] = {
        "primary": {
            "model": primary,
            "status": "UNAVAILABLE",
            "available": False,
            "vision_capable": False,
        },
        "fallback": {
            "model": fallback,
            "status": "UNAVAILABLE",
            "available": False,
            "vision_capable": False,
        },
        "checked_at": time.time(),
        "error": None,
    }

    if not settings.groq_enabled or not settings.groq_api_keys:
        result["primary"]["status"] = "DISABLED"
        result["fallback"]["status"] = "DISABLED"
        _validation_cache = result
        logger.info(
            f"Groq Vision Models:\n"
            f"primary:\n{primary}\nDISABLED\n"
            f"fallback:\n{fallback}\nDISABLED\n"
            f"Fallback: LOCAL_CV_CRNN"
        )
        return result

    pool = get_pool()
    entry = pool.acquire() if pool else None
    if not entry:
        result["primary"]["status"] = "NO_KEYS"
        result["fallback"]["status"] = "NO_KEYS"
        _validation_cache = result
        logger.warning(
            f"Groq Vision Models:\n"
            f"primary:\n{primary}\nNO_KEYS\n"
            f"fallback:\n{fallback}\nNO_KEYS\n"
            f"Fallback: LOCAL_CV_CRNN"
        )
        return result

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {entry.raw_key}"},
            )
            if resp.status_code == 200:
                pool.report_success(entry)
                data = resp.json().get("data", [])
                available_ids = {m.get("id") for m in data if "id" in m}

                primary_in_catalog = primary in available_ids
                fallback_in_catalog = fallback in available_ids

                result["primary"]["catalogAvailable"] = primary_in_catalog
                result["primary"]["available"] = primary_in_catalog
                result["primary"]["status"] = "AVAILABLE" if primary_in_catalog else "UNAVAILABLE"
                result["primary"]["vision_capable"] = primary_in_catalog
                result["primary"]["liveProbe"] = primary_in_catalog

                result["fallback"]["catalogAvailable"] = fallback_in_catalog
                result["fallback"]["probeKeySafeId"] = entry.safe_id
                result["fallback"]["probeTimestamp"] = time.time()

                if fallback_in_catalog:
                    result["fallback"]["status"] = "AVAILABLE"
                    result["fallback"]["available"] = True
                    result["fallback"]["vision_capable"] = True
                    result["fallback"]["liveProbe"] = True
                    result["fallback"]["lastErrorClass"] = None
                else:
                    # Probe fallback model directly to capture sanitized live error
                    try:
                        probe_resp = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {entry.raw_key}", "Content-Type": "application/json"},
                            json={"model": fallback, "messages": [{"role": "user", "content": "ping"}]},
                            timeout=5.0,
                        )
                        result["fallback"]["lastHttpStatus"] = probe_resp.status_code
                        if probe_resp.status_code == 200:
                            result["fallback"]["liveProbe"] = True
                            result["fallback"]["status"] = "AVAILABLE"
                            result["fallback"]["available"] = True
                            result["fallback"]["lastErrorClass"] = None
                        else:
                            err_body = probe_resp.json().get("error", {}) if probe_resp.headers.get("content-type", "").startswith("application/json") else {}
                            err_code = err_body.get("code") or err_body.get("type") or f"http_{probe_resp.status_code}"
                            result["fallback"]["liveProbe"] = False
                            result["fallback"]["status"] = "UNAVAILABLE"
                            result["fallback"]["available"] = False
                            result["fallback"]["lastErrorClass"] = err_code
                    except Exception as pe:
                        result["fallback"]["liveProbe"] = False
                        result["fallback"]["status"] = "UNAVAILABLE"
                        result["fallback"]["available"] = False
                        result["fallback"]["lastErrorClass"] = type(pe).__name__
            else:
                result["error"] = f"HTTP {resp.status_code}"
    except Exception as e:
        logger.warning(f"Groq model validation network error: {e}")
        result["error"] = str(e)

    _validation_cache = result

    # Log safe model status
    logger.info(
        f"Groq Vision Models:\n\n"
        f"primary:\n"
        f"{primary}\n"
        f"{result['primary']['status']} (catalog={result['primary'].get('catalogAvailable', False)}, live={result['primary'].get('liveProbe', False)})\n\n"
        f"fallback:\n"
        f"{fallback}\n"
        f"{result['fallback']['status']} (catalog={result['fallback'].get('catalogAvailable', False)}, live={result['fallback'].get('liveProbe', False)}, error={result['fallback'].get('lastErrorClass')})\n\n"
        f"Fallback:\n"
        f"LOCAL_CV_CRNN"
    )

    return result


def get_model_validation_status() -> Dict[str, Any]:
    """Return the cached validation status or a default offline status."""
    global _validation_cache
    if _validation_cache is not None:
        return _validation_cache
    return {
        "primary": {
            "model": settings.groq_primary_vision_model,
            "status": "NOT_CHECKED",
            "available": False,
            "vision_capable": False,
        },
        "fallback": {
            "model": settings.groq_fallback_vision_model,
            "status": "NOT_CHECKED",
            "available": False,
            "vision_capable": False,
        },
        "checked_at": 0.0,
        "error": None,
    }
