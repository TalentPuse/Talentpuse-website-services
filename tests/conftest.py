from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


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
