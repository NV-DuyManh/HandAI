"""
GEMCFG tests — Verify Gemini configuration, parsing, safe pooling, and credential protection.
GEMCFG-01 to GEMCFG-08 (8/8 required).
"""
import os
import logging
import pytest
from app.config import Settings
from app.integrations.gemini.key_pool import GeminiKeyPool, GeminiKeyEntry, GeminiKeyState


def test_gemcfg_01_comma_list_parses():
    """GEMCFG-01: Comma-separated list correctly parses into entries."""
    pool = GeminiKeyPool("AIzaSyA123,AIzaSyB456,AIzaSyC789")
    assert pool.total_keys == 3
    assert pool.entries[0].raw_key == "AIzaSyA123"
    assert pool.entries[1].raw_key == "AIzaSyB456"
    assert pool.entries[2].raw_key == "AIzaSyC789"


def test_gemcfg_02_whitespace_trimmed():
    """GEMCFG-02: Whitespace around commas/keys is trimmed."""
    pool = GeminiKeyPool("  AIzaSyA123  ,   AIzaSyB456   , AIzaSyC789 \n ")
    assert pool.total_keys == 3
    assert pool.entries[0].raw_key == "AIzaSyA123"
    assert pool.entries[1].raw_key == "AIzaSyB456"
    assert pool.entries[2].raw_key == "AIzaSyC789"


def test_gemcfg_03_blanks_ignored():
    """GEMCFG-03: Empty and blank parts are discarded."""
    pool = GeminiKeyPool("AIzaSyA123, , ,,AIzaSyB456,,  ,")
    assert pool.total_keys == 2
    assert pool.entries[0].raw_key == "AIzaSyA123"
    assert pool.entries[1].raw_key == "AIzaSyB456"


def test_gemcfg_04_duplicates_deduped():
    """GEMCFG-04: Duplicate keys are deduped preserving initial order."""
    pool = GeminiKeyPool("AIzaSyA123,AIzaSyB456,AIzaSyA123,AIzaSyC789,AIzaSyB456")
    assert pool.total_keys == 3
    assert [e.raw_key for e in pool.entries] == ["AIzaSyA123", "AIzaSyB456", "AIzaSyC789"]


def test_gemcfg_05_one_key_works():
    """GEMCFG-05: Single key works normally without errors."""
    single_key = "".join(["AIza", "Sy", "SingleKeyOnly"])
    pool = GeminiKeyPool(single_key)
    assert pool.total_keys == 1
    leased = pool.lease_key()
    assert leased is not None
    assert leased.raw_key == single_key


def test_gemcfg_06_missing_keys_disables_safely():
    """GEMCFG-06: Empty, blank, or missing key string safely produces empty pool with no crash."""
    for empty_val in ("", "   ", ",,,", None):
        pool = GeminiKeyPool(empty_val or "")
        assert pool.total_keys == 0
        assert pool.active_keys == 0
        assert pool.lease_key() is None


def test_gemcfg_07_no_numbered_gemini_env_vars():
    """GEMCFG-07: Mandatory single comma-list rule; no numbered GEMINI_API_KEY_01 vars."""
    s = Settings()
    # Check that settings does NOT define numbered variables
    for i in range(1, 10):
        attr_name = f"gemini_api_key_{i:02d}"
        assert not hasattr(s, attr_name), f"Forbidden numbered setting found: {attr_name}"
    # Must have single gemini_api_keys
    assert hasattr(s, "gemini_api_keys")


def test_gemcfg_08_no_raw_key_logs(caplog):
    """GEMCFG-08: Raw secret keys never appear in logs or safe identifiers."""
    raw_secret_1 = "".join(["AIza", "Sy", "SecretKeyOneAlpha99"])
    raw_secret_2 = "".join(["AIza", "Sy", "SecretKeyTwoBeta88"])
    raw_list = f"{raw_secret_1},{raw_secret_2}"

    with caplog.at_level(logging.DEBUG):
        pool = GeminiKeyPool(raw_list)
        k1 = pool.lease_key()
        pool.mark_failure(k1, "401")
        k2 = pool.lease_key()
        pool.mark_success(k2)

    # Safe IDs must mask keys
    assert raw_secret_1 not in k1.safe_id
    assert raw_secret_2 not in k2.safe_id
    assert "sha256:" in k1.safe_id

    # Caplog must not contain the raw key strings
    for record in caplog.records:
        msg = record.getMessage()
        assert raw_secret_1 not in msg
        assert raw_secret_2 not in msg
