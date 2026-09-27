"""
Safe health status for Groq key pool — internal use only.
Never returns raw keys or env string.
"""

import time
from typing import Optional
from app.integrations.groq.line_analyzer import get_pool
from app.config import settings


def groq_health() -> dict:
    pool = get_pool()
    if pool is None or not settings.groq_enabled:
        return {
            "enabled": False,
            "configured_key_count": 0,
            "healthy_key_count": 0,
            "cooldown_key_count": 0,
            "disabled_key_count": 0,
            "degraded_key_count": 0,
            "primary_model": settings.groq_primary_vision_model,
            "fallback_model": settings.groq_fallback_vision_model,
        }

    from app.integrations.groq.validator import get_model_validation_status
    status = pool.status()
    return {
        "enabled": True,
        "configured_key_count": status["configured_key_count"],
        "healthy_key_count": status["healthy_key_count"],
        "cooldown_key_count": status["cooldown_key_count"],
        "disabled_key_count": status["disabled_key_count"],
        "degraded_key_count": status["degraded_key_count"],
        "primary_model": settings.groq_primary_vision_model,
        "fallback_model": settings.groq_fallback_vision_model,
        "models": get_model_validation_status(),
    }
