from __future__ import annotations

import sys
import types
from pathlib import Path

from unittest.mock import AsyncMock, MagicMock

import pytest

# Dockerfile lam `COPY . /app/mcp_server/` — package `mcp_server` CHI TON TAI
# trong image, khong co trong source repo (thu muc goc la server.py + repositories/,
# schemas/...). Test import `from mcp_server...` nen chay pytest truc tiep tren
# source (CI, local) chet ModuleNotFoundError — da vap 2026-08-07, test gate MCP
# chua bao gio xanh tu khi them vao CI.
#
# Conftest chay TRUOC khi collect test module cua thu muc nay, nen alias o day
# ap dung cho toan bo test. `__path__` tro ve thu muc goc de `mcp_server.repositories`
# giai ra <root>/repositories, `mcp_server.server` ra <root>/server.py — khop
# dung layout ben trong image. Hoat dong voi moi version pytest (importlib hay khong).
_ROOT = Path(__file__).resolve().parents[1]
if not (_ROOT / "mcp_server").exists():
    _pkg = types.ModuleType("mcp_server")
    _pkg.__path__ = [str(_ROOT)]
    sys.modules["mcp_server"] = _pkg


def make_record(data: dict) -> MagicMock:
    """Create an asyncpg.Record-like mock from a dict.
    Supports both r["key"] and r.key access."""
    rec = MagicMock()
    rec.__getitem__ = lambda _, key: data[key]
    rec.__iter__ = lambda _: iter(data.keys())
    rec.keys = lambda: data.keys()
    rec.values = lambda: data.values()
    rec.items = lambda: data.items()
    for k, v in data.items():
        setattr(rec, k, v)
    return rec


@pytest.fixture
def mock_pool():
    """Mock asyncpg.Pool with fetch/fetchrow/fetchval."""
    pool = AsyncMock()
    pool.fetch = AsyncMock(return_value=[])
    pool.fetchrow = AsyncMock(return_value=None)
    pool.fetchval = AsyncMock(return_value=None)
    pool.close = AsyncMock()
    return pool


@pytest.fixture
def mock_db(monkeypatch, mock_pool):
    """Patch get_pool where it's imported (in base.py) to return mock_pool."""
    import mcp_server.repositories.base as base_mod

    async def _get_pool():
        return mock_pool

    monkeypatch.setattr(base_mod, "get_pool", _get_pool)
    return mock_pool


@pytest.fixture
def mock_httpx_response():
    """Factory to create mock httpx.Response."""
    def _make(status_code=200, json_data=None):
        resp = MagicMock()
        resp.status_code = status_code
        resp.raise_for_status = MagicMock()
        if json_data is not None:
            resp.json.return_value = json_data
        if status_code >= 400:
            import httpx
            resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                message="error", request=MagicMock(), response=resp
            )
        return resp
    return _make
