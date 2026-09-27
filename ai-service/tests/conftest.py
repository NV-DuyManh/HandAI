import pytest
from app.config import settings

@pytest.fixture(autouse=True)
def default_fixture_mode(monkeypatch):
    """Ensure unit/regression tests run in FIXTURE mode by default unless explicitly overridden by model tests."""
    monkeypatch.setattr(settings, "runtime_mode", "FIXTURE")
