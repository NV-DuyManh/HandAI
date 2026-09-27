"""
MathVision Kids — Phase 4.3 Gold Model Evaluation Harness
Author: Antigravity (Pair Programmer)
Frozen Pipeline: YOLOv8n (v1.0.0) -> StructuredParser -> Arithmetic Validators -> Policies
"""
import os
import sys
import time
import json
import argparse
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.config import settings
from app.recognition.model_engine import ModelRecognitionEngine
from app.recognition.manifest import ModelManifestLoader
from app.parsing.parser import StructuredParser
from app.validation.addition import VerticalAdditionValidator
from app.validation.subtraction import VerticalSubtractionValidator
from app.policy.student_policy import generate_student_feedback
from app.policy.teacher_policy import generate_teacher_feedback


class GoldEvaluationHarness:
    """Reproducible evaluation harness for independent gold benchmark gating."""

    # Disallowed training / validation filenames to prevent data leakage
    LEAKAGE_FILENAMES = {
        "sample_input_synthetic.jpg",
        "synthetic_addition.jpg",
        "synthetic_addition_carry.jpg",
        "synthetic_subtraction.jpg"
    }

    REQUIRED_IMAGE_FIELDS = {
        "image_id", "filepath", "operation", "is_supported",
        "ground_truth_expression", "is_mathematically_correct"
    }

    def __init__(self, manifest_path: Optional[Path] = None, output_dir: Optional[Path] = None):
        self.manifest_path = manifest_path
        self.output_dir = output_dir or (Path("e:/MathVisionKid/report/evidence/phase_4_3"))
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.results: Dict[str, Any] = {}

    def validate_manifest(self) -> tuple[bool, str]:
        """
        Verifies if a valid, populated independent gold dataset manifest exists,
        conforms to schema, and contains zero train/val leakage.
        """
        if not self.manifest_path:
            return False, "MANIFEST_NOT_SPECIFIED"
        if not self.manifest_path.exists():
            return False, "MANIFEST_NOT_FOUND"

        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            return False, f"INVALID_JSON: {e}"

        images = data.get("images")
        if not isinstance(images, list) or len(images) == 0:
            return False, "EMPTY_DATASET"

        # Schema and leakage verification
        for idx, item in enumerate(images):
            if not isinstance(item, dict):
                return False, f"INVALID_SCHEMA_ENTRY_AT_INDEX_{idx}"
            missing_fields = self.REQUIRED_IMAGE_FIELDS - set(item.keys())
            if missing_fields:
                return False, f"MISSING_SCHEMA_FIELDS_AT_INDEX_{idx}: {missing_fields}"

            # Leakage check
            fp = Path(item.get("filepath", "")).name.lower()
            if fp in self.LEAKAGE_FILENAMES:
                return False, f"DATA_LEAKAGE_DETECTED: {fp} was used in integration or training/val."

        return True, "VALID_MANIFEST"

    def run(self) -> Dict[str, Any]:
        """Executes evaluation or generates gate audit if dataset is missing/invalid."""
        is_valid, validation_reason = self.validate_manifest()
        
        # Dynamically compute actual file SHA-256 checksums to avoid conflation
        model_path = BASE_DIR / "models" / "yolov8n_mathvision_det_v1.pt"
        model_sha = hashlib.sha256(model_path.read_bytes()).hexdigest().upper() if model_path.exists() else "MISSING"

        manifest_file = BASE_DIR / "models" / "model_manifest.json"
        manifest_sha = hashlib.sha256(manifest_file.read_bytes()).hexdigest().upper() if manifest_file.exists() else "MISSING"

        label_map_file = BASE_DIR / "models" / "label_map_detection.json"
        label_map_sha = hashlib.sha256(label_map_file.read_bytes()).hexdigest().upper() if label_map_file.exists() else "MISSING"

        eval_config_file = BASE_DIR / "evaluation" / "evaluation_config_v1.json"
        eval_config_sha = hashlib.sha256(eval_config_file.read_bytes()).hexdigest().upper() if eval_config_file.exists() else "MISSING"

        # Load declared artifact checksum from manifest for explicit semantic distinction
        declared_artifact_sha = "UNKNOWN"
        if manifest_file.exists():
            try:
                manifest_json = json.loads(manifest_file.read_text(encoding="utf-8"))
                declared_artifact_sha = manifest_json.get("sha256", "UNKNOWN")
            except Exception:
                pass

        status = "READY_FOR_BENCHMARK" if is_valid else "BLOCKED_DATASET"

        self.results = {
            "evaluation_phase": "4.3.0.1",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "status": status,
            "gate_validation": validation_reason,
            "leakage_guard_status": "NO_KNOWN_OVERLAP_DETECTED" if is_valid else "BLOCKED",
            "dataset_independence": "NOT_VERIFIED",
            "dataset_manifest": str(self.manifest_path) if self.manifest_path else "NONE",
            "dataset_present": is_valid,
            "gold_image_count": 0 if not is_valid else len(json.load(open(self.manifest_path))["images"]),
            "model_identity": "MathVision-Kids-Detection v1.0.0 (YOLOv8n)",
            "provenance_checksums": {
                "modelArtifactSha256": model_sha,
                "artifactChecksumDeclaredByManifest": declared_artifact_sha,
                "normalizedManifestSha256": manifest_sha,
                "labelMapSha256": label_map_sha,
                "evaluationConfigSha256": eval_config_sha
            },
            "provenance_freeze": {
                "model_version": "1.0.0",
                "python_version": "3.12.13",
                "ultralytics_version": "8.4.143",
                "confidence_threshold": 0.25,
                "nms_threshold": 0.50,
                "ambiguity_threshold": 0.50,
                "high_confidence_threshold": 0.85
            },
            "model_sha256": model_sha,
            "model_sha_expected": "E78F8FA5A2FC8BE581B8624FA510CD2C429C40CDBD0930DBB2F1C2D870338985",
            "model_sha_verified": (model_sha == "E78F8FA5A2FC8BE581B8624FA510CD2C429C40CDBD0930DBB2F1C2D870338985"),
            "proposal_targets": {
                "critical_token_recognition": {"target": ">= 90%", "status": "NOT_EVALUATED"},
                "first_error_precision": {"target": ">= 85%", "status": "NOT_EVALUATED"},
                "first_error_recall": {"target": "report_separately", "status": "NOT_EVALUATED"},
                "first_error_coverage": {"target": "report_separately", "status": "NOT_EVALUATED"},
                "over_correction_rate": {"target": "<= 5%", "status": "NOT_EVALUATED"},
                "p95_ai_latency": {
                    "target": "<= 12.0s",
                    "status": "NOT_EVALUATED",
                    "local_smoke_timing": "0.0854s warm on local CPU (N=10 on synthetic sample, non-benchmark)"
                },
                "hint_quality": {"target": ">= 4.0/5", "status": "REQUIRES_HUMAN_EVALUATION"},
                "student_usability": {"target": ">= 80%", "status": "NOT_EVALUATED"},
                "teacher_usability": {"target": "100% reviewable", "status": "NOT_EVALUATED"}
            },
            "blocker_summary": [
                f"Evaluation Gate Status: {validation_reason}.",
                "No independent gold test dataset found in repository (ai-training/data/splits/test/ is empty).",
                "ai-training/annotations/ contains no adjudicated gold annotations.",
                "AI team DATASET_CARD.md confirms: 'Test set: No separate held-out test set in this version'.",
                "Formal benchmark requires >= 500 de-identified gold images (target 700, >= 20% double-annotated)."
            ]
        }

        # Write machine-readable evaluation report
        out_file = self.output_dir / "evaluation_results.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        print(f"[EvaluationHarness] Results written to: {out_file}")
        return self.results


def main():
    parser = argparse.ArgumentParser(description="MathVision Kids Gold Evaluation Harness")
    parser.add_argument("--manifest", type=str, default="", help="Path to gold dataset manifest")
    parser.add_argument("--outdir", type=str, default="e:/MathVisionKid/report/evidence/phase_4_3", help="Output evidence directory")
    args = parser.parse_args()

    manifest_p = Path(args.manifest) if args.manifest else None
    harness = GoldEvaluationHarness(manifest_path=manifest_p, output_dir=Path(args.outdir))
    res = harness.run()
    print(f"[EvaluationHarness] Status: {res['status']}")


if __name__ == "__main__":
    main()
