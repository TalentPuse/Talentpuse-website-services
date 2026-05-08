from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import DATABASE_URL

engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None


def _set_timezone(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("SET TIME ZONE 'Asia/Ho_Chi_Minh'")
    cursor.close()


async def init_db() -> None:
    global engine, async_session_factory
    engine = create_async_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=0,
        pool_timeout=10,
    )
    event.listen(engine.sync_engine, "connect", _set_timezone)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def close_db() -> None:
    global engine, async_session_factory
    if engine is not None:
        await engine.dispose()
        engine = None
        async_session_factory = None


async def get_db() -> AsyncIterator[AsyncSession]:
    if async_session_factory is None:
        raise RuntimeError("DB not initialized")
    async with async_session_factory() as session:
        yield session
