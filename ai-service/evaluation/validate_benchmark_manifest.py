"""
PROD.4B.2R5 — Locked Benchmark Manifest Validator
Validates the cryptographic integrity, schema, and completeness of
report/HANDWRITING_OCR_LOCKED_BENCHMARK_MANIFEST.json.
"""
import os
import sys
import json
import hashlib

def validate_manifest(manifest_path: str = None) -> int:
    if manifest_path is None:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        manifest_path = os.path.join(repo_root, "report", "HANDWRITING_OCR_LOCKED_BENCHMARK_MANIFEST.json")
    
    if not os.path.exists(manifest_path):
        print(f"FAIL: Manifest not found at {manifest_path}")
        return 1
        
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    required_keys = ["manifestVersion", "benchmarkScope", "totalLines", "totalCharacters", "totalWords", "benchmarkLines"]
    for k in required_keys:
        if k not in data:
            print(f"FAIL: Missing root key '{k}' in manifest")
            return 1
            
    lines = data["benchmarkLines"]
    if len(lines) != 33:
        print(f"FAIL: Expected 33 benchmark lines, found {len(lines)}")
        return 1
        
    if data["totalLines"] != 33:
        print(f"FAIL: totalLines declared as {data['totalLines']}, expected 33")
        return 1
        
    calc_chars = sum(len(l["groundTruthText"]) for l in lines)
    if calc_chars != 534 or data["totalCharacters"] != 534:
        print(f"FAIL: Character count mismatch: calc={calc_chars}, declared={data['totalCharacters']}, expected=534")
        return 1
        
    calc_words = sum(len(l["groundTruthText"].split()) for l in lines)
    if calc_words != 132 or data["totalWords"] != 132:
        print(f"FAIL: Word count mismatch: calc={calc_words}, declared={data['totalWords']}, expected=132")
        return 1
        
    required_line_fields = [
        "benchmarkLineId",
        "lineIndex",
        "sourceFixtureId",
        "sourceImageSHA256",
        "cropCoordinates",
        "cropSHA256",
        "groundTruthText",
        "provenance",
        "sourcePath",
        "splitMembership",
        "isPhysical",
        "seenDuringModelTraining",
        "eligibleForHoldoutClaims"
    ]
    
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    
    for idx, line in enumerate(lines, start=1):
        for field in required_line_fields:
            if field not in line:
                print(f"FAIL: Line {idx} ({line.get('benchmarkLineId', 'UNKNOWN')}) missing required field '{field}'")
                return 1
                
        # Validate source image SHA256
        src_path = os.path.join(repo_root, line["sourcePath"])
        if not os.path.exists(src_path):
            print(f"FAIL: Source image not found: {src_path}")
            return 1
            
        with open(src_path, "rb") as f:
            computed_sha = hashlib.sha256(f.read()).hexdigest()
        if computed_sha != line["sourceImageSHA256"]:
            print(f"FAIL: Source SHA256 mismatch for line {line['benchmarkLineId']}: declared={line['sourceImageSHA256']}, computed={computed_sha}")
            return 1
            
    print(f"PASS: Locked benchmark manifest '{manifest_path}' is cryptographically valid and complete (33 lines, 534 chars, 132 words).")
    return 0

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(validate_manifest(path))
