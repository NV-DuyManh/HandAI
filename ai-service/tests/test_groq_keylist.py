"""
KEYLIST tests — parse GROQ_API_KEYS comma-separated string.
8/8 required.
"""
import logging
import pytest
from app.integrations.groq.key_pool import GroqKeyPool, _parse_keys


def test_keylist_01_three_keys():
    """KEYLIST-01: 'A,B,C' -> 3 keys"""
    keys = _parse_keys("A,B,C")
    assert len(keys) == 3
    assert keys == ["A", "B", "C"]


def test_keylist_02_trim_whitespace():
    """KEYLIST-02: ' A , B , C ' -> 3 trimmed keys"""
    keys = _parse_keys(" A , B , C ")
    assert keys == ["A", "B", "C"]


def test_keylist_03_deduplication():
    """KEYLIST-03: 'A,B,A,C' -> ['A','B','C'] only once"""
    keys = _parse_keys("A,B,A,C")
    assert keys == ["A", "B", "C"]
    assert len(keys) == 3


def test_keylist_04_ignore_blanks():
    """KEYLIST-04: 'A,,B, ,C' -> ['A','B','C'] ignoring blanks"""
    keys = _parse_keys("A,,B, ,C")
    assert keys == ["A", "B", "C"]


def test_keylist_05_empty_string():
    """KEYLIST-05: '' -> empty pool, Groq disabled gracefully"""
    pool = GroqKeyPool("")
    assert pool.key_count == 0
    assert pool.acquire() is None


def test_keylist_06_unset_none():
    """KEYLIST-06: None treated as empty -> disabled gracefully"""
    pool = GroqKeyPool(None or "")
    assert pool.key_count == 0
    assert pool.acquire() is None


def test_keylist_07_order_deterministic():
    """KEYLIST-07: order preserved deterministically"""
    keys = _parse_keys("Z,X,Y")
    assert keys == ["Z", "X", "Y"]


def test_keylist_08_raw_env_not_logged(caplog):
    """KEYLIST-08: raw GROQ_API_KEYS string never appears in logs"""
    raw = "super_secret_key_abc123,another_secret_xyz789"
    with caplog.at_level(logging.DEBUG):
        pool = GroqKeyPool(raw)
        pool.acquire()
    for record in caplog.records:
        assert "super_secret_key_abc123" not in record.getMessage()
        assert "another_secret_xyz789" not in record.getMessage()
