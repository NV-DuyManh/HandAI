"""
Test suite for AI.HWTEXT.PHYSICAL.2B — Acceptance Test ID Immutability Guard (ACCEPT-ID-01).
Ensures locked test IDs cannot silently change semantic meaning or disappear.
"""

import ast
import json
import os
import re
from pathlib import Path
import pytest

MANIFEST_PATH = Path(__file__).parent / "acceptance_manifest.json"

TEST_FILES = [
    Path(__file__).parent / "test_groq_stab.py",
    Path(__file__).parent / "test_groq_trace.py",
    Path(__file__).parent / "test_multiline_physical_2a.py",
    Path(__file__).parent / "test_linefix_extra_lines.py",
]


def test_accept_id_01_locked_test_ids_semantic_immutability():
    """ACCEPT-ID-01: Locked test IDs cannot silently change semantic description."""
    assert MANIFEST_PATH.exists(), f"Manifest file missing: {MANIFEST_PATH}"

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Collect all test functions and their docstrings across the test files using stdlib ast
    discovered_tests = {}

    for test_file in TEST_FILES:
        assert test_file.exists(), f"Expected test file missing: {test_file}"
        with open(test_file, "r", encoding="utf-8") as f:
            content = f.read()

        tree = ast.parse(content, filename=str(test_file))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                docstring = ast.get_docstring(node) or ""
                # Extract test ID like STAB-01, TRACE-02, SOURCE-03, NAV-04, UI-05, LINEFIX-06
                id_match = re.search(r'\b(STAB-\d+|TRACE-\d+|SOURCE-\d+|NAV-\d+|UI-\d+|LINEFIX-\d+)\b', docstring)
                if id_match:
                    test_id = id_match.group(1)
                    discovered_tests[test_id] = {
                        "file": test_file.name,
                        "func": node.name,
                        "docstring": docstring.strip(),
                    }

    # Verify all manifest IDs exist in discovered tests
    missing_ids = []
    for test_id in manifest:
        if test_id not in discovered_tests:
            missing_ids.append(test_id)

    assert not missing_ids, f"Locked test IDs missing from test suite: {missing_ids}"

    # Verify each discovered test's docstring preserves the semantic intent from the manifest
    for test_id, expected_desc in manifest.items():
        doc = discovered_tests[test_id]["docstring"].lower()
        # Ensure key descriptive words from manifest are present in the docstring
        words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{4,}\b', expected_desc)]
        matched_words = [w for w in words if w in doc]
        assert len(matched_words) >= 1, (
            f"Semantic drift detected for {test_id}! "
            f"Expected keywords from '{expected_desc}', but docstring was '{discovered_tests[test_id]['docstring']}'"
        )
