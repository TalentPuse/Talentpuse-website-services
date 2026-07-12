"""AGUI_ENABLED flag — default off, bật bằng env."""
import importlib

import pytest

import app.core.config as config


@pytest.fixture(autouse=True)
def _restore_config():
    yield
    importlib.reload(config)


def test_agui_disabled_by_default(monkeypatch):
    monkeypatch.delenv("AGUI_ENABLED", raising=False)
    importlib.reload(config)
    assert config.AGUI_ENABLED is False


def test_agui_enabled_by_env(monkeypatch):
    monkeypatch.setenv("AGUI_ENABLED", "1")
    importlib.reload(config)
    assert config.AGUI_ENABLED is True
