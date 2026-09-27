"""
Safe Key Pool for Google Gemini API credentials.
Enforces single comma-separated variable, credential masking, state tracking, and quota respect.
"""

import time
import logging
import threading
from enum import Enum
from typing import List, Optional, Dict, Set

logger = logging.getLogger(__name__)


class GeminiKeyState(str, Enum):
    HEALTHY = "HEALTHY"
    COOLING_DOWN = "COOLING_DOWN"
    DISABLED_AUTH = "DISABLED_AUTH"
    DEGRADED = "DEGRADED"


class GeminiKeyEntry:
    def __init__(self, raw_key: str, index: int):
        self.raw_key = raw_key
        self.index = index
        self.state = GeminiKeyState.HEALTHY
        self.cooldown_until: float = 0.0
        self.failure_count: int = 0
        self.total_calls: int = 0
        self.last_used_at: float = 0.0
        self.success_count: int = 0
        self.last_success_at: float = 0.0
        self.total_latency_ms: float = 0.0
        self.is_probed: bool = False

        # Safe ID: one-way SHA256 fingerprint, never reveals any raw key content
        import hashlib
        h = hashlib.sha256(raw_key.encode()).hexdigest()[:16]
        self.safe_id = f"sha256:{h}"

    def is_available(self) -> bool:
        if self.state == GeminiKeyState.DISABLED_AUTH:
            return False
        if self.state in (GeminiKeyState.COOLING_DOWN, GeminiKeyState.DEGRADED):
            return time.time() >= self.cooldown_until
        return True


class GeminiKeyPool:
    def __init__(
        self,
        raw_keys_str: str = "",
        cooldown_seconds: float = 60.0,
        rotate_on_429: bool = False,
    ):
        self.cooldown_seconds = cooldown_seconds
        self.rotate_on_429 = rotate_on_429
        self.entries: List[GeminiKeyEntry] = []
        self._current_index = 0
        self.configured_entries_count = 0
        self.duplicates_removed = 0
        self._lock = threading.Lock()
        self._parse_and_init(raw_keys_str)

    def _parse_and_init(self, raw_keys_str: str):
        if not raw_keys_str or not isinstance(raw_keys_str, str):
            self.entries = []
            return

        # Split comma, trim whitespace, discard blanks, dedup preserving order
        raw_parts = [p.strip() for p in raw_keys_str.split(",") if p.strip()]
        self.configured_entries_count = len(raw_parts)
        seen = set()
        deduped = []
        for cleaned in raw_parts:
            if cleaned not in seen:
                seen.add(cleaned)
                deduped.append(cleaned)
        self.duplicates_removed = self.configured_entries_count - len(deduped)

        self.entries = [GeminiKeyEntry(k, idx) for idx, k in enumerate(deduped)]
        logger.info(
            f"[GeminiKeyPool] Initialized with {len(self.entries)} unique key(s) "
            f"(configured={self.configured_entries_count}, duplicatesRemoved={self.duplicates_removed})"
        )

    @property
    def total_keys(self) -> int:
        return len(self.entries)

    @property
    def unique_keys_count(self) -> int:
        return len(self.entries)

    @property
    def duplicates_removed_count(self) -> int:
        return self.duplicates_removed

    @property
    def active_keys(self) -> int:
        with self._lock:
            return sum(1 for e in self.entries if e.is_available())

    @property
    def provider_status(self) -> str:
        with self._lock:
            if not self.entries:
                return "NOT_CONFIGURED"
            if all(e.state == GeminiKeyState.DISABLED_AUTH for e in self.entries):
                return "DISABLED_AUTH"
            if not any(e.is_available() for e in self.entries):
                return "COOLING_DOWN"
            if any(e.is_probed and e.state == GeminiKeyState.HEALTHY for e in self.entries):
                return "HEALTHY"
            return "UNPROBED"

    def lease_key(self, exclude_safe_ids: Optional[Set[str]] = None) -> Optional[GeminiKeyEntry]:
        with self._lock:
            if not self.entries:
                return None

            now = time.time()
            exclude_set = exclude_safe_ids or set()

            # Recover expired cooldowns
            for e in self.entries:
                if e.state == GeminiKeyState.COOLING_DOWN and now >= e.cooldown_until:
                    # Transition expired cooldown to DEGRADED until next success confirms healthy
                    e.state = GeminiKeyState.DEGRADED
                elif e.state == GeminiKeyState.DEGRADED and now >= e.cooldown_until:
                    pass

            # Partition available entries excluding already attempted keys
            healthy_candidates = []
            degraded_candidates = []

            for entry in self.entries:
                if entry.safe_id in exclude_set:
                    continue
                if not entry.is_available():
                    continue
                if entry.state == GeminiKeyState.HEALTHY:
                    healthy_candidates.append(entry)
                elif entry.state == GeminiKeyState.DEGRADED and now >= entry.cooldown_until:
                    degraded_candidates.append(entry)

            # Preference: HEALTHY first, then DEGRADED
            candidates = healthy_candidates if healthy_candidates else degraded_candidates
            if not candidates:
                return None

            # Round-robin selection among candidates using self._current_index to prevent starvation
            chosen = None
            for c in candidates:
                if c.index >= self._current_index:
                    chosen = c
                    break
            if chosen is None:
                chosen = candidates[0]

            self._current_index = (chosen.index + 1) % len(self.entries)
            chosen.last_used_at = now
            chosen.total_calls += 1
            return chosen

    def mark_success(self, entry: GeminiKeyEntry, latency_ms: float = 0.0):
        with self._lock:
            if entry.state != GeminiKeyState.DISABLED_AUTH:
                entry.state = GeminiKeyState.HEALTHY
                entry.failure_count = 0
                entry.is_probed = True
                entry.success_count += 1
                entry.last_success_at = time.time()
                entry.total_latency_ms += latency_ms

    def mark_failure(self, entry: GeminiKeyEntry, error_type: str, retry_after: Optional[float] = None):
        with self._lock:
            now = time.time()
            entry.failure_count += 1

            if error_type in ("AUTH_ERROR", "401", "403"):
                entry.state = GeminiKeyState.DISABLED_AUTH
                logger.warning(f"[GeminiKeyPool] Key {entry.safe_id} DISABLED_AUTH due to {error_type}")
            elif error_type in ("RATE_LIMIT_429", "429"):
                if not self.rotate_on_429:
                    cooldown = retry_after if (retry_after and retry_after > 0) else self.cooldown_seconds
                    entry.state = GeminiKeyState.COOLING_DOWN
                    entry.cooldown_until = now + cooldown
                    logger.warning(f"[GeminiKeyPool] Key {entry.safe_id} 429 backoff for {cooldown:.1f}s (no sweep)")
                else:
                    entry.state = GeminiKeyState.COOLING_DOWN
                    entry.cooldown_until = now + (retry_after or self.cooldown_seconds)
            elif error_type in ("MODEL_UNAVAILABLE", "404"):
                entry.state = GeminiKeyState.DEGRADED
                entry.cooldown_until = now + self.cooldown_seconds
                logger.warning(f"[GeminiKeyPool] Key {entry.safe_id} model unavailable (404), state=DEGRADED")
            else:
                # 5xx or transient timeout
                entry.state = GeminiKeyState.COOLING_DOWN
                entry.cooldown_until = now + self.cooldown_seconds
                logger.warning(f"[GeminiKeyPool] Key {entry.safe_id} transient error {error_type}, cooling down")


# Module-level singleton
_gemini_pool: Optional[GeminiKeyPool] = None


def init_gemini_pool(raw_keys_str: str = "", rotate_on_429: bool = False, cooldown_seconds: float = 60.0) -> GeminiKeyPool:
    global _gemini_pool
    _gemini_pool = GeminiKeyPool(raw_keys_str=raw_keys_str, rotate_on_429=rotate_on_429, cooldown_seconds=cooldown_seconds)
    return _gemini_pool


def get_gemini_pool() -> Optional[GeminiKeyPool]:
    return _gemini_pool
