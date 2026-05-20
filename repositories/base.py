from __future__ import annotations

import asyncpg

from mcp_server.db import get_pool


class BaseRepository:
    """Base class for all repositories. Provides access to the asyncpg pool."""

    async def _pool(self) -> asyncpg.Pool:
        return await get_pool()

    async def _fetch(self, query: str, *args) -> list[asyncpg.Record]:
        pool = await self._pool()
        return await pool.fetch(query, *args)

    async def _fetchrow(self, query: str, *args) -> asyncpg.Record | None:
        pool = await self._pool()
        return await pool.fetchrow(query, *args)

    async def _fetchval(self, query: str, *args):
        pool = await self._pool()
        return await pool.fetchval(query, *args)
