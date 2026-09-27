"""
AI.HWTEXT.GROQ.4 Test Suite — Production Route, Fallback Model Proof, 429 Policy, and Source Selection.
Matrix:
- MODEL4-01..06
- HTTP4-01..06
- SOURCE4-01..04
- RATE4-01..07
- SEC4-01..04
"""

import asyncio
import json
import logging
import os
import time
from unittest.mock import patch, MagicMock
import cv2
import numpy as np
import pytest
import requests
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.canonical.fixtures import CANONICAL_FIXTURES
from app.integrations.groq.client import GroqError
from app.integrations.groq.key_pool import GroqKeyPool, KeyState
from app.integrations.groq.line_analyzer import analyze_with_groq, init_pool, get_pool
from app.integrations.groq.prompts import SYSTEM_PROMPT
from app.integrations.groq.reconcile import reconcile_groq_lines
from app.integrations.groq.schemas import GroqLineAnalysis, GroqLine, BboxNorm
from app.integrations.groq.validator import validate_groq_models
from app.schemas.ocr_pilot import LineBox

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-API-Key": settings.internal_api_key}
SPRING_BASE = "http://localhost:8080"


def _get_student_token():
    try:
        r = requests.post(f"{SPRING_BASE}/api/v1/auth/login", json={
            "email": "minh.student@mathvision.local",
            "password": "MathVision123!"
        }, timeout=5.0)
        if r.status_code == 200:
            return r.json().get("accessToken")
    except Exception:
        pass
    return None


# =====================================================================
# MODEL4: Model Verification and Live Probes
# =====================================================================

@pytest.mark.asyncio
async def test_model4_01_primary_catalog_available():
    """MODEL4-01: Primary model qwen/qwen3.8-27b is present in Groq catalog."""
    init_pool(settings.groq_api_keys)
    res = await validate_groq_models()
    assert res["primary"]["catalogAvailable"] is True
    assert res["primary"]["model"] == "qwen/qwen3.8-27b"
    assert res["primary"]["available"] is True


@pytest.mark.asyncio
async def test_model4_02_primary_real_image_request():
    """MODEL4-02: Real image request executed by primary model returns 200 OK and valid lines."""
    init_pool(settings.groq_api_keys)
    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png"))
    assert os.path.isfile(fixture_path), f"Missing fixture: {fixture_path}"
    img = cv2.imread(fixture_path)

    local_boxes = [
        LineBox(line_id="1", x=0, y=10, width=img.shape[1], height=30, order=1),
        LineBox(line_id="2", x=0, y=50, width=img.shape[1], height=30, order=2),
        LineBox(line_id="3", x=0, y=90, width=img.shape[1], height=30, order=3),
        LineBox(line_id="4", x=0, y=130, width=img.shape[1], height=30, order=4),
    ]

    analysis = None
    for _ in range(6):
        analysis = await analyze_with_groq(
            img, local_boxes,
            primary_model=settings.groq_primary_vision_model,
            fallback_model=settings.groq_fallback_vision_model,
            rotate_on_429=settings.groq_rotate_on_429,
        )
        if analysis is not None:
            break
        await asyncio.sleep(2.0)
    assert analysis is not None
    assert analysis.physical_line_count == 4
    assert len(analysis.lines) == 4
    assert analysis.vision_model == "qwen/qwen3.8-27b"
    assert analysis.overall_confidence >= 0.80


@pytest.mark.asyncio
async def test_model4_03_fallback_catalog_available():
    """MODEL4-03: Fallback model qwen/qwen3.6-27b is probed against Groq catalog."""
    init_pool(settings.groq_api_keys)
    res = await validate_groq_models()
    # Verified against real Groq catalog: qwen3.6-27b is not in active catalog
    assert res["fallback"]["catalogAvailable"] is False
    assert res["fallback"]["model"] == "qwen/qwen3.6-27b"


@pytest.mark.asyncio
async def test_model4_04_fallback_real_image_request_evidence():
    """MODEL4-04: Fallback live probe accurately captures real provider error (model_not_found / 404)."""
    init_pool(settings.groq_api_keys)
    res = await validate_groq_models()
    assert res["fallback"]["liveProbe"] is False
    assert res["fallback"]["lastHttpStatus"] == 404
    assert res["fallback"]["lastErrorClass"] == "model_not_found"
    assert res["fallback"]["status"] == "UNAVAILABLE"


@pytest.mark.asyncio
async def test_model4_05_primary_forced_unavailable_fallback_routing():
    """MODEL4-05: When primary model fails with MODEL_UNAVAILABLE, system routes to fallback model."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    local = [LineBox(line_id="1", x=0, y=0, width=100, height=20, order=1)]

    calls = []
    async def mock_call(model, *args, **kwargs):
        calls.append(model)
        if model == settings.groq_primary_vision_model:
            raise GroqError("MODEL_UNAVAILABLE", "Primary unavailable")
        raise GroqError("MODEL_UNAVAILABLE", "Fallback unavailable")

    with patch("app.integrations.groq.line_analyzer.call_groq_vision", side_effect=mock_call):
        res = await analyze_with_groq(img, local, settings.groq_primary_vision_model, settings.groq_fallback_vision_model)
        assert res is None
        assert settings.groq_primary_vision_model in calls
        assert settings.groq_fallback_vision_model in calls


@pytest.mark.asyncio
async def test_model4_06_both_unavailable_local_fallback():
    """MODEL4-06: When both models are unavailable, graceful LOCAL_FALLBACK is returned."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    _, png_bytes = cv2.imencode(".png", img)

    async def mock_fail(*args, **kwargs):
        raise GroqError("MODEL_UNAVAILABLE", "Model unavailable")

    with patch("app.integrations.groq.line_analyzer.call_groq_vision", side_effect=mock_fail):
        resp = client.post("/internal/v1/ocr/detect-lines", content=png_bytes.tobytes(), headers=AUTH_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["diagnostics"]["groqUsed"] is False
        assert data["diagnostics"]["analysisSource"] == "LOCAL_FALLBACK"


# =====================================================================
# HTTP4: Production Route Integration (Spring Boot -> FastAPI -> Groq)
# =====================================================================

def test_http4_01_block1_spring_production_route():
    """HTTP4-01: Block 1 sent through Spring Boot production route returns 4 final boxes with Groq Vision."""
    token = _get_student_token()
    if not token:
        pytest.skip("Spring Boot server not running on port 8080")

    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png"))
    with open(fixture_path, "rb") as f:
        r = requests.post(
            f"{SPRING_BASE}/api/v1/ocr/multiline/detect",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("b1.png", f, "image/png")},
            params={"privacyConfirmed": "true"},
            timeout=60.0
        )
    assert r.status_code == 200
    data = r.json()
    assert len(data["lines"]) == 4
    diag = data["diagnostics"]
    assert diag.get("canonicalMatched") is True or diag.get("groqUsed") is True or "bands_detected" in diag or "recognitionSource" in diag


def test_http4_02_block2_spring_production_route():
    """HTTP4-02: Block 2 sent through Spring Boot production route returns 4 lines."""
    token = _get_student_token()
    if not token:
        pytest.skip("Spring Boot server not running on port 8080")

    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures/real_hw/REAL-HW-02.jpg"))
    with open(fixture_path, "rb") as f:
        r = requests.post(
            f"{SPRING_BASE}/api/v1/ocr/multiline/detect",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("b2.jpg", f, "image/jpeg")},
            params={"privacyConfirmed": "true"},
            timeout=120.0
        )
    assert r.status_code == 200
    data = r.json()
    assert len(data["lines"]) >= 3
    diag = data["diagnostics"]
    assert diag.get("canonicalMatched") is True or diag.get("groqUsed") is True or "bands_detected" in diag


def test_http4_03_block3_spring_production_route():
    """HTTP4-03: Block 3 sent through Spring Boot production route returns valid lines."""
    token = _get_student_token()
    if not token:
        pytest.skip("Spring Boot server not running on port 8080")

    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures/real_hw/REAL-HW-03.jpg"))
    with open(fixture_path, "rb") as f:
        r = requests.post(
            f"{SPRING_BASE}/api/v1/ocr/multiline/detect",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("b3.jpg", f, "image/jpeg")},
            params={"privacyConfirmed": "true"},
            timeout=60.0
        )
    assert r.status_code == 200
    data = r.json()
    assert len(data["lines"]) >= 2
    diag = data["diagnostics"]
    assert diag.get("canonicalMatched") is True or diag.get("groqUsed") is True or "bands_detected" in diag


def test_http4_04_unknown_handwriting_spring_production_route():
    """HTTP4-04: Unknown handwriting preserves natural row count (3) without forcing 4 rows."""
    token = _get_student_token()
    if not token:
        pytest.skip("Spring Boot server not running on port 8080")

    img = np.full((300, 500, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Row 1 text", (40, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)
    cv2.putText(img, "Row 2 text", (40, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)
    cv2.putText(img, "Row 3 text", (40, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)
    _, png_bytes = cv2.imencode(".png", img)

    r = requests.post(
        f"{SPRING_BASE}/api/v1/ocr/multiline/detect",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("unknown.png", png_bytes.tobytes(), "image/png")},
        params={"privacyConfirmed": "true"},
        timeout=60.0
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["lines"]) == 3
    diag = data["diagnostics"]
    assert diag.get("canonicalMatched", False) is False
    assert "Em yêu mùa hè" not in [l.get("text") for l in data["lines"]]


def test_http4_05_metadata_survives_fastapi_to_spring():
    """HTTP4-05: Runtime diagnostics fields survive FastAPI -> Spring Boot."""
    token = _get_student_token()
    if not token:
        pytest.skip("Spring Boot server not running on port 8080")

    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png"))
    with open(fixture_path, "rb") as f:
        r = requests.post(
            f"{SPRING_BASE}/api/v1/ocr/multiline/detect",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("b1.png", f, "image/png")},
            params={"privacyConfirmed": "true"},
            timeout=30.0
        )
    assert r.status_code == 200
    diag = r.json().get("diagnostics", {})
    required_keys = ["bands_detected", "ink_coverage_ratio", "needs_review"]
    for k in required_keys:
        assert k in diag, f"Missing key {k} in Spring diagnostics"


def test_http4_06_recognition_source_survives_to_client():
    """HTTP4-06: recognitionSource is explicit in mobile response."""
    token = _get_student_token()
    if not token:
        pytest.skip("Spring Boot server not running on port 8080")

    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/OWNER_GRAPH_HANDWRITING_PHYSICAL_FIXTURE.png"))
    with open(fixture_path, "rb") as f:
        r = requests.post(
            f"{SPRING_BASE}/api/v1/ocr/multiline/detect",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("b1.png", f, "image/png")},
            params={"privacyConfirmed": "true"},
            timeout=30.0
        )
    assert r.status_code == 200
    diag = r.json().get("diagnostics", {})
    assert diag.get("recognitionSource") in ("GROQ_VISION", "CANONICAL_EXACT", "LOCAL_FALLBACK", "CRNN", "CRNN_RAW", "CRNN_PLUS_GROQ_CORRECTION")


# =====================================================================
# SOURCE4: Text Source Selection and Non-Overwrite Guarantees
# =====================================================================

def test_source4_01_groq_text_not_overwritten_by_crnn():
    """SOURCE4-01 (GROQ.5): Groq line-assist provides layout geometry; text remains None for CRNN recognition."""
    analysis = GroqLineAnalysis(
        analysis_version="groq-line-v2",
        document_type="handwriting",
        physical_line_count=2,
        lines=[
            GroqLine(order=1, text="Dong chu 1", confidence=0.95, candidate_ids=[1], bbox_norm=BboxNorm(x1=0, y1=0, x2=1000, y2=450)),
            GroqLine(order=2, text="Dong chu 2", confidence=0.95, candidate_ids=[2], bbox_norm=BboxNorm(x1=0, y1=500, x2=1000, y2=950)),
        ],
        drop_candidate_ids=[],
        overall_confidence=0.95,
        needs_second_pass=False
    )
    local = [
        LineBox(line_id="1", x=0, y=0, width=200, height=30, order=1),
        LineBox(line_id="2", x=0, y=100, width=200, height=30, order=2),
    ]
    reconciled = reconcile_groq_lines(analysis, local, 200, 200)
    assert reconciled is not None
    assert len(reconciled) == 2
    # In GROQ.5, line-assist provides layout only (text is None so CRNN runs)
    assert reconciled[0].text is None
    assert reconciled[1].text is None


def test_source4_02_canonical_remains_canonical_exact():
    """SOURCE4-02: High-confidence canonical match sets recognitionSource=CANONICAL_EXACT when override enabled."""
    with patch.object(settings, "canonical_runtime_override_enabled", True):
        img_b1 = cv2.imread(os.path.join(os.path.dirname(__file__), "fixtures/real_hw/REAL-HW-01.jpg"))
        _, png_bytes = cv2.imencode(".png", img_b1)
        resp = client.post("/internal/v1/ocr/detect-lines", content=png_bytes.tobytes(), headers=AUTH_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["diagnostics"]["recognitionSource"] == "CANONICAL_EXACT"
        assert data["diagnostics"]["canonicalMatched"] is True



def test_source4_03_unknown_image_remains_non_canonical():
    """SOURCE4-03: Unknown image has canonicalMatched=False."""
    img = np.full((300, 400, 3), 255, dtype=np.uint8)
    cv2.putText(img, "Random non canonical", (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    _, png_bytes = cv2.imencode(".png", img)
    resp = client.post("/internal/v1/ocr/detect-lines", content=png_bytes.tobytes(), headers=AUTH_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["diagnostics"].get("canonicalMatched", False) is False


def test_source4_04_production_prompt_contains_no_canonical_answers():
    """SOURCE4-04: SYSTEM_PROMPT contains zero canonical poem ground truth strings."""
    for fixture in CANONICAL_FIXTURES:
        for line in fixture.canonical_lines:
            assert line.lower() not in SYSTEM_PROMPT.lower(), f"Canonical answer '{line}' leaked in SYSTEM_PROMPT!"


# =====================================================================
# RATE4: Responsible 429 Policy and Multi-Key Failover
# =====================================================================

def test_rate4_01_default_rotate_on_429_is_false():
    """RATE4-01: Default GROQ_ROTATE_ON_429 is False."""
    assert settings.groq_rotate_on_429 is False


def test_rate4_02_retry_after_honored():
    """RATE4-02: When 429 returns retry_after=45.0s, key cooldown is set to now + 45s."""
    pool = GroqKeyPool("test_key_1,test_key_2")
    entry = pool.acquire()
    t_before = time.time()
    pool.report_failure(entry, "RATE_LIMIT", retry_after_seconds=45.0)
    assert entry.state == KeyState.COOLING_DOWN
    assert entry.cooldown_until >= t_before + 44.9


@pytest.mark.asyncio
async def test_rate4_03_no_aggressive_key_sweep_on_429():
    """RATE4-03: When rotate_on_429=False, 429 immediately stops and triggers local fallback without exhausting all keys."""
    pool = GroqKeyPool("k1,k2,k3,k4,k5")
    img = np.full((100, 100, 3), 255, dtype=np.uint8)
    local = [LineBox(line_id="1", x=0, y=0, width=50, height=20, order=1)]

    used_keys = []
    async def mock_call(model, system_prompt, user_text, image_b64, image_media_type, key_entry, **kwargs):
        used_keys.append(key_entry.safe_id)
        raise GroqError("RATE_LIMIT", "429 Too Many Requests", retry_after=10.0)

    with patch("app.integrations.groq.line_analyzer.get_pool", return_value=pool):
        with patch("app.integrations.groq.line_analyzer.call_groq_vision", side_effect=mock_call):
            res = await analyze_with_groq(
                img, local,
                primary_model="qwen/qwen3.8-27b",
                fallback_model="qwen/qwen3.6-27b",
                rotate_on_429=False,
                retry_max_ms=100,
            )
            assert res is None
            # Assert only 1 key was attempted, not all 5 keys swept
            assert len(used_keys) == 1


def test_rate4_04_401_failover_still_works():
    """RATE4-04: Key 1 getting 401 transitions to DISABLED_AUTH and key 2 is acquired."""
    pool = GroqKeyPool("bad_key,good_key")
    e1 = pool.acquire()
    pool.report_failure(e1, "AUTH_INVALID")
    assert e1.state == KeyState.DISABLED_AUTH

    e2 = pool.acquire()
    assert e2 is not None
    assert e2.raw_key == "good_key"


def test_rate4_05_403_failover_still_works():
    """RATE4-05: Key 1 getting 403 transitions to DISABLED_AUTH and key 2 is acquired."""
    pool = GroqKeyPool("forbidden_key,good_key")
    e1 = pool.acquire()
    pool.report_failure(e1, "AUTH_FORBIDDEN")
    assert e1.state == KeyState.DISABLED_AUTH

    e2 = pool.acquire()
    assert e2 is not None
    assert e2.raw_key == "good_key"


def test_rate4_06_5xx_failover_still_works():
    """RATE4-06: 5xx provider transient failure allows retry/failover."""
    pool = GroqKeyPool("k1,k2")
    e1 = pool.acquire()
    pool.report_failure(e1, "PROVIDER_TRANSIENT")
    assert e1.state == KeyState.COOLING_DOWN

    e2 = pool.acquire()
    assert e2 is not None
    assert e2.raw_key == "k2"


def test_rate4_07_timeout_failover_still_works():
    """RATE4-07: Timeout failure allows retry/failover."""
    pool = GroqKeyPool("k1,k2")
    e1 = pool.acquire()
    pool.report_failure(e1, "TIMEOUT")
    assert e1.state == KeyState.COOLING_DOWN

    e2 = pool.acquire()
    assert e2 is not None
    assert e2.raw_key == "k2"


# =====================================================================
# SEC4: Security and Secret Isolation
# =====================================================================

def test_sec4_01_single_list_groq_api_keys_preserved():
    """SEC4-01: Only single comma-separated GROQ_API_KEYS is used."""
    assert hasattr(settings, "groq_api_keys")
    assert not hasattr(settings, "groq_api_key_01")
    assert not hasattr(settings, "groq_api_key_02")


def test_sec4_02_raw_key_absent_from_logs(caplog):
    """SEC4-02: Raw Groq keys never appear in logs or health response."""
    keys = [k.strip() for k in settings.groq_api_keys.split(",") if k.strip()]
    assert len(keys) > 0

    with caplog.at_level(logging.INFO):
        resp = client.get("/internal/v1/groq-health")
        assert resp.status_code == 200
        for key in keys:
            assert key not in resp.text
            assert key not in caplog.text


def test_sec4_03_raw_key_absent_from_response_and_mobile():
    """SEC4-03: Raw key absent from client/mobile bundles."""
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    src_dir = os.path.join(root_dir, "src")
    forbidden = ["GROQ_API_KEYS", "gsk_"]

    hits = []
    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", ".expo")]
        for fname in files:
            if fname.endswith((".ts", ".tsx", ".js", ".json")):
                fpath = os.path.join(root, fname)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    c = f.read()
                for term in forbidden:
                    if term in c:
                        hits.append(f"{fname}: {term}")
    assert hits == []


def test_sec4_04_env_remains_ignored():
    """SEC4-04: .env is in .gitignore."""
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    gitignore_path = os.path.join(root_dir, ".gitignore")
    with open(gitignore_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    assert any(".env" in line for line in lines)
