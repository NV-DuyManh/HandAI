"""
Factory for instantiating and caching OCR providers.
"""
from typing import Optional, Dict
import logging

from app.ocr.provider import OcrProvider
from app.ocr.crnn_provider import CrnnOcrProvider
from app.ocr.noop_provider import NoopOcrProvider

logger = logging.getLogger(__name__)

_PROVIDER_CACHE: Dict[str, OcrProvider] = {}


def get_ocr_provider(
    provider_type: Optional[str] = None,
    model_dir: Optional[str] = None,
    force_new: bool = False,
) -> OcrProvider:
    """
    Get or create an OCR provider singleton.
    :param provider_type: 'crnn_vi_handwriting_v1', 'noop', or None (reads settings).
    :param model_dir: Optional custom model directory path.
    :param force_new: If True, bypass the cache and create a new instance.
    :return: An instance implementing OcrProvider.
    """
    from app.config import settings

    selected = provider_type or getattr(settings, "ocr_provider", "noop")
    selected_dir = model_dir or getattr(settings, "ocr_model_dir", None)
    cache_key = f"{selected}:{selected_dir}"

    if not force_new and cache_key in _PROVIDER_CACHE:
        return _PROVIDER_CACHE[cache_key]

    provider: OcrProvider
    if selected in ("crnn_vi_handwriting_v1", "crnn"):
        provider = CrnnOcrProvider(model_dir=selected_dir)
    elif selected in ("noop", "disabled", "none"):
        provider = NoopOcrProvider()
    else:
        raise ValueError(
            f"Unsupported OCR provider: '{selected}'. "
            f"Supported providers: ['noop', 'crnn_vi_handwriting_v1']. No silent fallback allowed."
        )

    if not force_new:
        _PROVIDER_CACHE[cache_key] = provider

    return provider


def clear_provider_cache() -> None:
    """Clear all cached OCR provider instances (useful in tests)."""
    _PROVIDER_CACHE.clear()
