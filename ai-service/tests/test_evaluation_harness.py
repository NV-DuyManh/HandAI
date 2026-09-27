"""
Unit tests for the Phase 4.3 Evaluation Harness pre-execution gates.
Verifies gating semantics:
1. Missing manifest -> BLOCKED_DATASET
2. Empty dataset -> BLOCKED_DATASET
3. Invalid schema -> BLOCKED_DATASET
4. Known leakage sample -> BLOCKED_DATASET
5. Positive harness smoke -> READY_FOR_BENCHMARK (pre-execution pass, proposal metrics NOT evaluated)
"""
import json
import pytest
from pathlib import Path

from evaluation.run_evaluation import GoldEvaluationHarness


def test_harness_missing_manifest_blocked(tmp_path):
    """Test gate 1: missing manifest path or nonexistent file blocks execution."""
    # Sub-case A: None manifest path
    harness_none = GoldEvaluationHarness(manifest_path=None, output_dir=tmp_path)
    is_valid, reason = harness_none.validate_manifest()
    assert is_valid is False
    assert reason == "MANIFEST_NOT_SPECIFIED"
    results = harness_none.run()
    assert results["status"] == "BLOCKED_DATASET"
    assert results["gold_image_count"] == 0

    # Sub-case B: Non-existent manifest file
    non_existent = tmp_path / "does_not_exist.json"
    harness_missing = GoldEvaluationHarness(manifest_path=non_existent, output_dir=tmp_path)
    is_valid, reason = harness_missing.validate_manifest()
    assert is_valid is False
    assert reason == "MANIFEST_NOT_FOUND"
    results_missing = harness_missing.run()
    assert results_missing["status"] == "BLOCKED_DATASET"


def test_harness_empty_dataset_blocked(tmp_path):
    """Test gate 2: empty dataset manifest blocks execution."""
    manifest_file = tmp_path / "empty_manifest.json"
    manifest_file.write_text(json.dumps({"images": []}), encoding="utf-8")

    harness = GoldEvaluationHarness(manifest_path=manifest_file, output_dir=tmp_path)
    is_valid, reason = harness.validate_manifest()
    assert is_valid is False
    assert reason == "EMPTY_DATASET"

    results = harness.run()
    assert results["status"] == "BLOCKED_DATASET"
    assert results["gate_validation"] == "EMPTY_DATASET"


def test_harness_invalid_schema_blocked(tmp_path):
    """Test gate 3: schema missing required fields blocks execution."""
    invalid_manifest = tmp_path / "invalid_schema.json"
    invalid_manifest.write_text(
        json.dumps({
            "images": [
                {
                    "image_id": "test_001",
                    "filepath": "some/path.jpg",
                    # Missing operation, is_supported, ground_truth_expression, is_mathematically_correct
                }
            ]
        }),
        encoding="utf-8"
    )

    harness = GoldEvaluationHarness(manifest_path=invalid_manifest, output_dir=tmp_path)
    is_valid, reason = harness.validate_manifest()
    assert is_valid is False
    assert "MISSING_SCHEMA_FIELDS" in reason

    results = harness.run()
    assert results["status"] == "BLOCKED_DATASET"
    assert "MISSING_SCHEMA_FIELDS" in results["gate_validation"]


def test_harness_known_leakage_sample_blocked(tmp_path):
    """Test gate 4: manifest containing known training/val/integration sample blocks execution."""
    leakage_manifest = tmp_path / "leakage_manifest.json"
    leakage_manifest.write_text(
        json.dumps({
            "images": [
                {
                    "image_id": "leakage_sample_001",
                    "filepath": "images/sample_input_synthetic.jpg",  # Known training handoff fixture
                    "operation": "VERTICAL_ADDITION",
                    "is_supported": True,
                    "ground_truth_expression": {
                        "operand1": "38",
                        "operand2": "47",
                        "operator": "+",
                        "student_result": "85"
                    },
                    "is_mathematically_correct": True
                }
            ]
        }),
        encoding="utf-8"
    )

    harness = GoldEvaluationHarness(manifest_path=leakage_manifest, output_dir=tmp_path)
    is_valid, reason = harness.validate_manifest()
    assert is_valid is False
    assert "DATA_LEAKAGE_DETECTED" in reason

    results = harness.run()
    assert results["status"] == "BLOCKED_DATASET"
    assert results["leakage_guard_status"] == "BLOCKED"


def test_harness_positive_smoke_gate(tmp_path):
    """Test positive smoke: structurally valid synthetic test manifest passes schema gate."""
    smoke_fixture = Path(__file__).resolve().parent / "fixtures" / "test_manifest_smoke.json"
    assert smoke_fixture.exists(), "Smoke test fixture must exist"

    harness = GoldEvaluationHarness(manifest_path=smoke_fixture, output_dir=tmp_path)
    is_valid, reason = harness.validate_manifest()
    assert is_valid is True
    assert reason == "VALID_MANIFEST"

    results = harness.run()
    # Smoke manifest passes pre-execution gate
    assert results["status"] == "READY_FOR_BENCHMARK"
    assert results["gate_validation"] == "VALID_MANIFEST"
    assert results["leakage_guard_status"] == "NO_KNOWN_OVERLAP_DETECTED"
    assert results["dataset_independence"] == "NOT_VERIFIED"
    assert results["gold_image_count"] == 1

    # Crucial: Proposal metrics MUST NOT be calculated or published from smoke
    proposal_targets = results["proposal_targets"]
    assert proposal_targets["critical_token_recognition"]["status"] == "NOT_EVALUATED"
    assert proposal_targets["first_error_precision"]["status"] == "NOT_EVALUATED"
    assert proposal_targets["over_correction_rate"]["status"] == "NOT_EVALUATED"
    assert proposal_targets["p95_ai_latency"]["status"] == "NOT_EVALUATED"

    # Provenance checksums must be recorded independently
    checksums = results["provenance_checksums"]
    assert "modelArtifactSha256" in checksums
    assert "artifactChecksumDeclaredByManifest" in checksums
    assert "normalizedManifestSha256" in checksums
    assert "labelMapSha256" in checksums
    assert "evaluationConfigSha256" in checksums
