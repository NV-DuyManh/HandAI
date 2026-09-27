"""
PROD.4B.2R3 — Canonical Fixture Manifest Identity Tests.
Ensures the canonical handwriting fixture manifest is intact and all 6 fixtures match their cryptographic hashes,
dimensions, expected line counts, and provenance notes.
"""
import os
import json
import hashlib
import pytest
from PIL import Image

def get_manifest_path():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures", "canonical_handwriting_manifest.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests", "fixtures", "canonical_handwriting_manifest.json")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError("canonical_handwriting_manifest.json not found")

REQUIRED_IDS = [
    "OWNER_POEM_BLOCK_1",
    "OWNER_POEM_8_LINES",
    "WIDE_NOTEBOOK_SAMPLE",
    "REAL_HW_01",
    "REAL_HW_02",
    "REAL_HW_03"
]

def test_canonical_manifest_exists_and_valid():
    manifest_path = get_manifest_path()
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "fixtures" in data
    assert len(data["fixtures"]) == 6
    fixture_ids = [fix["canonicalId"] for fix in data["fixtures"]]
    for rid in REQUIRED_IDS:
        assert rid in fixture_ids, f"Required canonical ID {rid} missing from manifest"

def test_canonical_manifest_hashes_and_dimensions():
    manifest_path = get_manifest_path()
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for item in data["fixtures"]:
        cid = item["canonicalId"]
        rel_path = item["relativePath"]
        expected_sha = item["sha256"]
        expected_w = item["width"]
        expected_h = item["height"]
        
        full_path = os.path.join(repo_root, rel_path)
        if not os.path.exists(full_path):
            # Check relative to ai-service
            full_path = os.path.join(repo_root, "services", "ai-service", rel_path)
        assert os.path.exists(full_path), f"Fixture file not found: {full_path}"
        
        with open(full_path, "rb") as f:
            content = f.read()
        calc_sha = hashlib.sha256(content).hexdigest()
        assert calc_sha == expected_sha, f"SHA256 mismatch for {cid}: expected {expected_sha}, got {calc_sha}"
        
        im = Image.open(full_path)
        assert im.width == expected_w, f"Width mismatch for {cid}: expected {expected_w}, got {im.width}"
        assert im.height == expected_h, f"Height mismatch for {cid}: expected {expected_h}, got {im.height}"

def test_real_hw_03_identity_resolution():
    manifest_path = get_manifest_path()
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    real_03 = next((x for x in data["fixtures"] if x["canonicalId"] == "REAL_HW_03"), None)
    assert real_03 is not None
    assert real_03["sha256"] == "9d4cb2a1aa7daa7ce549b0851ee1b2da423b508510e080ccd9ceaa40f91de673"
    assert real_03["width"] == 451
    assert real_03["height"] == 1024
    assert real_03["expectedLineCount"] == 2
    assert "MOBILE_APP_SCREENSHOT_LINE_EDITOR" in real_03["sourceProvenance"]
