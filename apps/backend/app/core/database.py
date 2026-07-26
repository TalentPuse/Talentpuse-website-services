from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import DATABASE_URL, WAREHOUSE_DATABASE_URL

engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None

# Engine RIENG toi kho phan tich dbt tren box warehouse.
#
# Hai box noi nhau qua Tailscale (xem docs/DEPLOY.md): box warehouse mo
# postgres:5432 tren tailnet, web box ket noi vao do. Day chinh la duong "goi du
# lieu tu web box sang warehouse box". Chieu nguoc lai (warehouse -> web) di
# bang HTTP — xem `dispatch_dashboard_alerts` ben pipeline_data.
#
# Chua dat WAREHOUSE_DATABASE_URL thi no bang DATABASE_URL, tuc hai engine tro
# cung mot noi va khong co gi doi. Nho vay viec tach DB chuyen dan duoc tung
# module thay vi mot cu big-bang.
warehouse_engine: AsyncEngine | None = None
warehouse_session_factory: async_sessionmaker[AsyncSession] | None = None


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


async def init_warehouse_db() -> None:
    """Mo ket noi toi kho phan tich tren box warehouse.

    Pool nho hon `init_db`: day la duong doc bao cao/thi truong, khong phai duong
    xac thuc hay ghi du lieu nguoi dung, va no di QUA MANG TAILSCALE giua hai box
    nen moi ket noi dat hon han ket noi noi bo.
    """
    global warehouse_engine, warehouse_session_factory
    warehouse_engine = create_async_engine(
        WAREHOUSE_DATABASE_URL,
        pool_size=3,
        max_overflow=0,
        pool_timeout=10,
        # Kho o box khac, duong Tailscale co the dut am tham. pool_pre_ping bo ra
        # mot lenh kiem tra truoc khi dung lai connection cu, thay vi de request
        # cua nguoi dung chet vi mot socket da hong tu bao gio.
        pool_pre_ping=True,
    )
    event.listen(warehouse_engine.sync_engine, "connect", _set_timezone)
    warehouse_session_factory = async_sessionmaker(warehouse_engine, expire_on_commit=False)


async def close_warehouse_db() -> None:
    global warehouse_engine, warehouse_session_factory
    if warehouse_engine is not None:
        await warehouse_engine.dispose()
        warehouse_engine = None
        warehouse_session_factory = None


async def get_warehouse_db() -> AsyncIterator[AsyncSession]:
    """Session doc kho dbt (dbt_dev_bronze/silver/gold) tren box warehouse.

    Dung `Depends(get_warehouse_db)` cho MOI truy van cham vao schema dbt_dev_*.
    Dung `get_db` cho du lieu cua app (schema `app`).

    Lan lon hai cai nay se khong bao loi ngay lap tuc chung nao hai bien moi truong
    con tro cung mot database — no chi vo ra dung luc tach that. Do la ly do phai
    chuyen dut diem tung module mot.
    """
    if warehouse_session_factory is None:
        raise RuntimeError("Warehouse DB not initialized")
    async with warehouse_session_factory() as session:
        yield session
