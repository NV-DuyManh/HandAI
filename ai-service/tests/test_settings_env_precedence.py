"""Local provider configuration overrides base defaults; process env still wins."""
from pathlib import Path

from app.config import Settings, _ordered_env_files


def test_local_provider_keys_override_blank_base_file(tmp_path, monkeypatch):
    for key in ("GROQ_API_KEYS", "GEMINI_API_KEYS"):
        monkeypatch.delenv(key, raising=False)
    (tmp_path / ".env").write_text('GROQ_API_KEYS=""\nGEMINI_API_KEYS=""\n', encoding="utf-8")
    (tmp_path / ".env.local").write_text(
        'GROQ_API_KEYS="dummy-groq"\nGEMINI_API_KEYS="dummy-gemini"\n', encoding="utf-8")
    paths = _ordered_env_files(tmp_path, tmp_path)
    assert paths == [str((tmp_path / ".env").resolve()), str((tmp_path / ".env.local").resolve())]
    configured = Settings(_env_file=paths)
    assert configured.groq_api_keys == "dummy-groq"
    assert configured.gemini_api_keys == "dummy-gemini"
    monkeypatch.setenv("GROQ_API_KEYS", "process-override")
    assert Settings(_env_file=paths).groq_api_keys == "process-override"


def test_working_directory_local_file_has_last_priority(tmp_path):
    service_dir = tmp_path / "service"
    working_dir = tmp_path / "working"
    service_dir.mkdir()
    working_dir.mkdir()
    assert _ordered_env_files(service_dir, working_dir) == [
        str((service_dir / ".env").resolve()),
        str((working_dir / ".env").resolve()),
        str((service_dir / ".env.local").resolve()),
        str((working_dir / ".env.local").resolve()),
    ]
