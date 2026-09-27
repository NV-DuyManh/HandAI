"""
MODEL tests — model failover behavior (all mocked, no real API calls).
5/5 required.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.integrations.groq.key_pool import GroqKeyPool, KeyEntry
from app.integrations.groq.client import GroqError


@pytest.mark.asyncio
async def test_model_01_primary_works():
    """MODEL-01: primary model succeeds"""
    from app.integrations.groq import line_analyzer
    pool = GroqKeyPool("testkey")
    line_analyzer._pool = pool

    mock_analysis = MagicMock()
    mock_analysis.overall_confidence = 0.92
    mock_analysis.needs_second_pass = False
    mock_analysis.physical_line_count = 4

    with patch("app.integrations.groq.line_analyzer.call_groq_vision", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = mock_analysis
        import numpy as np
        img = np.zeros((200, 400, 3), dtype=np.uint8)
        result = await line_analyzer.analyze_with_groq(
            bgr_image=img,
            local_boxes=[],
            primary_model="model-primary",
            fallback_model="model-fallback",
            max_attempts=1,
        )
        assert result is mock_analysis
        assert mock_call.call_args[1]["model"] == "model-primary"


@pytest.mark.asyncio
async def test_model_02_primary_missing_uses_fallback():
    """MODEL-02: primary 404 -> fallback model"""
    from app.integrations.groq import line_analyzer
    pool = GroqKeyPool("testkey")
    line_analyzer._pool = pool

    mock_analysis = MagicMock()
    mock_analysis.overall_confidence = 0.85
    mock_analysis.needs_second_pass = False

    call_count = [0]
    async def side_effect(*args, **kwargs):
        call_count[0] += 1
        if kwargs.get("model") == "model-primary":
            raise GroqError("MODEL_UNAVAILABLE", "404 model not found")
        return mock_analysis

    with patch("app.integrations.groq.line_analyzer.call_groq_vision", side_effect=side_effect):
        import numpy as np
        img = np.zeros((200, 400, 3), dtype=np.uint8)
        result = await line_analyzer.analyze_with_groq(
            bgr_image=img,
            local_boxes=[],
            primary_model="model-primary",
            fallback_model="model-fallback",
            max_attempts=1,
        )
    assert result is not None


@pytest.mark.asyncio
async def test_model_03_both_unavailable_returns_none():
    """MODEL-03: both models fail -> None (local fallback)"""
    from app.integrations.groq import line_analyzer
    pool = GroqKeyPool("testkey")
    line_analyzer._pool = pool
    line_analyzer._cache.clear()  # prevent stale cache from prior test

    async def always_fail(*args, **kwargs):
        raise GroqError("MODEL_UNAVAILABLE", "no model")

    with patch("app.integrations.groq.line_analyzer.call_groq_vision", side_effect=always_fail):
        import numpy as np
        img = np.zeros((200, 400, 3), dtype=np.uint8)
        result = await line_analyzer.analyze_with_groq(
            bgr_image=img,
            local_boxes=[],
            primary_model="model-primary",
            fallback_model="model-fallback",
            max_attempts=1,
        )
    assert result is None


@pytest.mark.asyncio
async def test_model_04_bad_request_does_not_rotate_keys():
    """MODEL-04: BAD_REQUEST does not cycle through all keys"""
    from app.integrations.groq import line_analyzer
    pool = GroqKeyPool("K1,K2,K3")
    line_analyzer._pool = pool

    acquire_count = [0]
    orig_acquire = pool.acquire
    def counting_acquire():
        acquire_count[0] += 1
        return orig_acquire()
    pool.acquire = counting_acquire

    async def bad_request(**kwargs):
        raise GroqError("BAD_REQUEST", "invalid payload")

    with patch("app.integrations.groq.line_analyzer.call_groq_vision", side_effect=bad_request):
        import numpy as np
        img = np.zeros((200, 400, 3), dtype=np.uint8)
        await line_analyzer.analyze_with_groq(
            bgr_image=img,
            local_boxes=[],
            primary_model="model-primary",
            fallback_model="model-fallback",
            max_attempts=2,
        )
    # BAD_REQUEST should break inner loop; key count should be small (1 per model attempt)
    assert acquire_count[0] <= 4  # not 3*max_attempts for each key


def test_model_05_model_discovery_not_per_request():
    """MODEL-05: pool init is called once, not on every request"""
    from app.integrations.groq import line_analyzer
    init_count = [0]
    orig_init = line_analyzer.init_pool
    def counting_init(*a, **kw):
        init_count[0] += 1
        orig_init(*a, **kw)
    line_analyzer.init_pool = counting_init
    line_analyzer.init_pool("keyA,keyB")
    # Simulate multiple get_pool() calls
    for _ in range(10):
        p = line_analyzer.get_pool()
        assert p is not None
    assert init_count[0] == 1
    line_analyzer.init_pool = orig_init
