"""
GroqKeyPool — parses GROQ_API_KEYS comma-separated string into a
managed pool with per-key health states.

States: HEALTHY → COOLING_DOWN → HEALTHY (transient)
                → DISABLED_AUTH (401/403, permanent until restart)
                → DEGRADED (3 consecutive transients)
"""

import hashlib
import logging
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

logger = logging.getLogger(__name__)


class KeyState(str, Enum):
    HEALTHY = "HEALTHY"
    COOLING_DOWN = "COOLING_DOWN"
    DISABLED_AUTH = "DISABLED_AUTH"
    DEGRADED = "DEGRADED"


@dataclass
class KeyEntry:
    raw_key: str
    safe_id: str
    state: KeyState = KeyState.HEALTHY
    last_used_at: float = 0.0
    last_success_at: float = 0.0
    consecutive_failures: int = 0
    cooldown_until: float = 0.0
    disabled_until: float = 0.0
    last_error_class: str = ""
    success_count: int = 0
    failure_count: int = 0

    def is_available(self, now: float) -> bool:
        if self.state == KeyState.DISABLED_AUTH:
            return False
        if self.state == KeyState.COOLING_DOWN:
            if now >= self.cooldown_until:
                self.state = KeyState.HEALTHY
                self.consecutive_failures = 0
                return True
            return False
        return True  # HEALTHY or DEGRADED


def _parse_keys(raw: str) -> List[str]:
    """Parse GROQ_API_KEYS string: split, trim, remove blanks, deduplicate preserving order."""
    seen = set()
    result = []
    for item in raw.split(","):
        key = item.strip()
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result


def _safe_id(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()[:8]


class GroqKeyPool:
    """Thread-safe key pool for Groq API keys parsed from a single comma-separated string."""

    def __init__(self, raw_keys_string: str, cooldown_seconds: int = 60, auth_disable_seconds: int = 1800):
        keys = _parse_keys(raw_keys_string)
        self._entries: List[KeyEntry] = [
            KeyEntry(raw_key=k, safe_id=_safe_id(k)) for k in keys
        ]
        self._cooldown_seconds = cooldown_seconds
        self._auth_disable_seconds = auth_disable_seconds
        self._lock = threading.Lock()
        logger.info(f"[GroqKeyPool] Initialized with {len(self._entries)} unique key(s)")

    @property
    def key_count(self) -> int:
        return len(self._entries)

    def acquire(self) -> Optional[KeyEntry]:
        """Return the least-recently-used HEALTHY key, or a DEGRADED key if no healthy available."""
        with self._lock:
            now = time.time()
            healthy = [e for e in self._entries if e.state in (KeyState.HEALTHY, KeyState.COOLING_DOWN) and e.is_available(now)]
            if not healthy:
                degraded = [e for e in self._entries if e.state == KeyState.DEGRADED]
                if degraded:
                    degraded.sort(key=lambda e: e.last_used_at)
                    entry = degraded[0]
                    entry.last_used_at = now
                    return entry
                return None  # All keys exhausted
            # LRU selection
            healthy.sort(key=lambda e: e.last_used_at)
            entry = healthy[0]
            entry.last_used_at = now
            return entry

    def report_success(self, entry: KeyEntry) -> None:
        with self._lock:
            entry.state = KeyState.HEALTHY
            entry.consecutive_failures = 0
            entry.last_success_at = time.time()
            entry.last_error_class = ""
            entry.success_count += 1

    def report_failure(self, entry: KeyEntry, error_class: str, retry_after_seconds: Optional[float] = None) -> None:
        """Update key state based on error class."""
        with self._lock:
            now = time.time()
            entry.failure_count += 1
            entry.last_error_class = error_class

            if error_class in ("AUTH_INVALID", "AUTH_FORBIDDEN"):
                entry.state = KeyState.DISABLED_AUTH
                logger.warning(f"[GroqKeyPool] Key {entry.safe_id} DISABLED_AUTH ({error_class})")

            elif error_class == "RATE_LIMIT":
                # Respect Retry-After; do NOT chain to next key by default
                cooldown = retry_after_seconds if retry_after_seconds else self._cooldown_seconds
                entry.state = KeyState.COOLING_DOWN
                entry.cooldown_until = now + cooldown
                entry.consecutive_failures += 1
                logger.info(f"[GroqKeyPool] Key {entry.safe_id} COOLING_DOWN for {cooldown}s (429)")

            elif error_class in ("TRANSIENT_NETWORK", "PROVIDER_TRANSIENT", "TIMEOUT"):
                entry.consecutive_failures += 1
                if entry.consecutive_failures >= 3:
                    entry.state = KeyState.DEGRADED
                    entry.cooldown_until = now + self._cooldown_seconds
                    logger.warning(f"[GroqKeyPool] Key {entry.safe_id} DEGRADED after {entry.consecutive_failures} failures")
                else:
                    # short cooldown before retry
                    entry.state = KeyState.COOLING_DOWN
                    entry.cooldown_until = now + min(self._cooldown_seconds, entry.consecutive_failures * 10)

            else:
                # BAD_REQUEST, RESPONSE_VALIDATION_ERROR, MODEL_UNAVAILABLE — do not penalize key
                entry.consecutive_failures += 1

    def status(self) -> dict:
        """Safe status dict — never exposes raw keys."""
        with self._lock:
            now = time.time()
            counts = {s: 0 for s in KeyState}
            for e in self._entries:
                # Refresh COOLING_DOWN that have expired
                if e.state == KeyState.COOLING_DOWN and now >= e.cooldown_until:
                    e.state = KeyState.HEALTHY
                counts[e.state] += 1
            return {
                "configured_key_count": len(self._entries),
                "healthy_key_count": counts[KeyState.HEALTHY],
                "cooldown_key_count": counts[KeyState.COOLING_DOWN],
                "disabled_key_count": counts[KeyState.DISABLED_AUTH],
                "degraded_key_count": counts[KeyState.DEGRADED],
            }
