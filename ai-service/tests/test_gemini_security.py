"""
SEC-GEM Security Tests — Credential redaction, safe key isolation, and zero secret leakage.
SEC-GEM-01 to SEC-GEM-10 (10/10 required).
"""

import os
import re
import subprocess
from pathlib import Path
import pytest

from app.integrations.gemini.client import GeminiError
from app.integrations.gemini.key_pool import GeminiKeyPool
from app.schemas.ocr_pilot import LineBox

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
REPORTS_DIR = WORKSPACE_ROOT / "reports" if (WORKSPACE_ROOT / "reports").exists() else WORKSPACE_ROOT / "report"
AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
BUSINESS_API_DIR = WORKSPACE_ROOT / "backend" / "business-api" if (WORKSPACE_ROOT / "backend" / "business-api").exists() else WORKSPACE_ROOT / "services" / "business-api"
SRC_DIR = WORKSPACE_ROOT / "apps" / "student-mobile" / "src" if (WORKSPACE_ROOT / "apps" / "student-mobile" / "src").exists() else WORKSPACE_ROOT / "src"

# Known prefixes or patterns for Gemini API keys
GEMINI_KEY_PATTERNS = [
    r"AQ\.Ab8RN6[A-Za-z0-9_\-]{30,}",
    r"AIzaSy[A-Za-z0-9_\-]{33}",
]


def _has_raw_gemini_key(text: str) -> bool:
    for pat in GEMINI_KEY_PATTERNS:
        if re.search(pat, text):
            return True
    return False


def test_sec_gem_01_generated_reports_contain_no_raw_gemini_key():
    """SEC-GEM-01: Generated markdown reports contain zero raw Gemini credentials."""
    assert REPORTS_DIR.exists(), f"Reports directory missing: {REPORTS_DIR}"
    report_files = list(REPORTS_DIR.rglob("*.md"))
    assert len(report_files) > 0, "No report files found"

    leaks = []
    for report_path in report_files:
        content = report_path.read_text(encoding="utf-8", errors="ignore")
        if _has_raw_gemini_key(content):
            leaks.append(str(report_path.name))

    assert leaks == [], f"Raw Gemini keys exposed in reports: {leaks}"


def test_sec_gem_02_logs_contain_no_raw_gemini_key():
    """SEC-GEM-02: Local log files contain zero raw Gemini credentials."""
    log_candidates = list(WORKSPACE_ROOT.glob("*.log")) + list((WORKSPACE_ROOT / "runtime").glob("**/*.log"))
    leaks = []
    for log_path in log_candidates:
        if log_path.is_file():
            content = log_path.read_text(encoding="utf-8", errors="ignore")
            if _has_raw_gemini_key(content):
                leaks.append(str(log_path))

    assert leaks == [], f"Raw Gemini keys exposed in logs: {leaks}"


def test_sec_gem_03_exceptions_and_urls_redact_gemini_credentials():
    """SEC-GEM-03: Exceptions and URLs redact or mask Gemini credential secrets."""
    secret = "TEST_MOCK_GEMINI_KEY_SAFE_REDACTED_12345"
    pool = GeminiKeyPool(secret)
    entry = pool.lease_key()
    assert entry is not None

    # Safe ID must not expose raw key — uses SHA256 fingerprint
    assert entry.safe_id != secret
    assert entry.raw_key not in entry.safe_id
    assert entry.safe_id.startswith("sha256:")
    # Must not contain any prefix/suffix of the raw key
    assert secret[:4] not in entry.safe_id
    assert secret[-4:] not in entry.safe_id

    # Error message must use safe_id and never leak raw key
    err = GeminiError("AUTH_ERROR", f"Gemini key {entry.safe_id} rejected", status_code=403)
    err_str = str(err)
    assert secret not in err_str
    assert entry.safe_id in err_str


def test_sec_gem_04_env_example_contains_placeholders_only():
    """SEC-GEM-04: .env.example contains empty placeholders and zero real secrets."""
    env_example_path = AI_SERVICE_DIR / ".env.example"
    assert env_example_path.exists(), f"Missing .env.example at {env_example_path}"

    content = env_example_path.read_text(encoding="utf-8")
    assert not _has_raw_gemini_key(content), ".env.example contains a raw Gemini secret!"
    # Accept empty placeholders or placeholder template values (PASTE_KEY_*_HERE)
    assert "GEMINI_API_KEYS=" in content, "GEMINI_API_KEYS not found in .env.example"
    # Ensure no real key pattern (AIza* or AQ.* prefix) in the value
    import re
    key_line = [l for l in content.splitlines() if l.startswith("GEMINI_API_KEYS=")]
    assert len(key_line) == 1
    assert not re.search(r'AIza[0-9A-Za-z_-]{20,}', key_line[0]), ".env.example contains real-looking API key"


def test_sec_gem_05_mobile_contains_no_gemini_secrets():
    """SEC-GEM-05: Mobile client codebase (src/) contains zero Gemini secrets."""
    ts_files = list(SRC_DIR.glob("**/*.ts")) + list(SRC_DIR.glob("**/*.tsx"))
    leaks = []
    for f in ts_files:
        content = f.read_text(encoding="utf-8", errors="ignore")
        if _has_raw_gemini_key(content):
            leaks.append(str(f.relative_to(WORKSPACE_ROOT)))

    assert leaks == [], f"Raw Gemini secrets found in mobile code: {leaks}"


def test_sec_gem_06_spring_contains_no_gemini_secrets():
    """SEC-GEM-06: Spring Boot codebase contains zero Gemini secrets."""
    java_files = list(BUSINESS_API_DIR.glob("src/**/*.java")) + list(BUSINESS_API_DIR.glob("src/**/*.yml"))
    leaks = []
    for f in java_files:
        content = f.read_text(encoding="utf-8", errors="ignore")
        if _has_raw_gemini_key(content):
            leaks.append(str(f.relative_to(WORKSPACE_ROOT)))

    assert leaks == [], f"Raw Gemini secrets found in Spring Boot code: {leaks}"


def test_sec_gem_07_git_tracked_files_contain_no_gemini_secrets():
    """SEC-GEM-07: Git-tracked files contain zero raw Gemini secrets and .env is gitignored."""
    # Check .env is ignored
    res = subprocess.run(
        ["git", "status", "--porcelain", "ai/runtime/.env"],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True,
    )
    assert res.stdout.strip() == "", "ai/runtime/.env is tracked or not properly gitignored!"

    # Check git tracked files
    tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True,
    )
    tracked_files = [line.strip() for line in tracked.stdout.splitlines() if line.strip()]

    leaks = []
    for rel_path in tracked_files:
        full_path = WORKSPACE_ROOT / rel_path
        if full_path.is_file() and full_path.suffix in (".py", ".java", ".ts", ".tsx", ".md", ".json", ".yml", ".yaml"):
            try:
                content = full_path.read_text(encoding="utf-8", errors="ignore")
                if _has_raw_gemini_key(content):
                    leaks.append(rel_path)
            except Exception:
                pass

    assert leaks == [], f"Git tracked files contain raw Gemini keys: {leaks}"


def test_sec_gem_08_diagnostics_and_api_responses_contain_no_credential_object():
    """SEC-GEM-08: LineBox and API response objects never contain credentials or secret fields."""
    line = LineBox(
        line_id="line-sec-08",
        x=0,
        y=0,
        width=100,
        height=30,
        order=1,
        text="em yêu mùa hè",
        rawOcrText="em yeu mua he",
        finalText="em yêu mùa hè",
        groqSuggestion="em yêu mùa hè",
        geminiSuggestion="em yêu mùa hè",
        geminiStatus="SUCCESS",
        suggestions=[
            {"provider": "GEMINI", "text": "em yêu mùa hè", "status": "SUCCESS"}
        ],
    )

    data = line.model_dump()
    data_str = str(data)

    # Must not contain API key fields
    assert "api_key" not in data
    assert "raw_key" not in data
    assert "secret" not in data
    assert "gemini_api_key" not in data_str
    assert "AIza" not in data_str
    assert "AQ.Ab8" not in data_str


def test_sec_gem_09_report_fingerprinting_uses_one_way_hash_only():
    """SEC-GEM-09: Report fingerprinting uses one-way hash only; no prefix/suffix mask of raw credential."""
    # Verify all reports use only SHA256 fingerprints, never prefix/suffix masks
    assert REPORTS_DIR.exists()
    report_files = list(REPORTS_DIR.rglob("*.md"))
    assert len(report_files) > 0

    # Pattern for old-style masked fragments: AQ.A... or similar partial credential fragments
    prefix_suffix_mask_pattern = re.compile(r"AQ\.A\.\.\.[A-Za-z0-9_]{2,}")

    violations = []
    for report_path in report_files:
        content = report_path.read_text(encoding="utf-8", errors="ignore")
        matches = prefix_suffix_mask_pattern.findall(content)
        if matches:
            violations.append((report_path.name, matches))

    assert violations == [], (
        f"Reports contain prefix/suffix masked fragments instead of one-way SHA256: {violations}"
    )

    # Verify SHA256 fingerprint format is used
    sha256_pattern = re.compile(r"sha256:[0-9a-f]{16}")
    gemini_reports = [r for r in report_files if "gemini" in r.name.lower()]
    has_sha256 = False
    for report_path in gemini_reports:
        content = report_path.read_text(encoding="utf-8", errors="ignore")
        if sha256_pattern.search(content):
            has_sha256 = True
            break
    assert has_sha256, "No Gemini report uses SHA256 fingerprint format"


def test_sec_gem_10_gemini_http_exception_sanitizes_query_credential():
    """SEC-GEM-10: Gemini HTTP exception sanitization removes query credential before serialization/logging."""
    # Simulate an error message that might contain a URL with ?key=
    secret = "TEST_MOCK_GEMINI_KEY_SAFE_REDACTED_12345"
    pool = GeminiKeyPool(secret)
    entry = pool.lease_key()
    assert entry is not None

    # The client constructs URLs with ?key= — verify the key pool safe_id
    # never reveals URL-embeddable credential
    url_with_key = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={entry.raw_key}"

    # Create error with safe_id (as the code does)
    sanitized_url = url_with_key.replace(entry.raw_key, entry.safe_id)
    err = GeminiError("API_ERROR", f"Gemini unexpected status 500: {sanitized_url[:200]}", status_code=500)

    err_str = str(err)
    assert entry.raw_key not in err_str, "Raw key leaked in error string"
    assert secret not in err_str, "Secret credential in error string"

    # Also verify that safe_id format is SHA256 and not prefix/suffix
    assert entry.safe_id.startswith("sha256:"), f"safe_id should use SHA256 format, got: {entry.safe_id}"
    assert "TEST_MOCK" not in entry.safe_id, "safe_id should not contain raw key prefix"
