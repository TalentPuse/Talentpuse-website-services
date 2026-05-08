#!/usr/bin/env python3
"""Tạo hoặc promote một user thành admin.

Usage (trong Docker container):
    docker exec -it tp-backend python scripts/create_admin.py \\
        admin@talentpulse.vn "StrongP@ss123" "Admin TalentPuse"

Nếu email đã tồn tại → promote lên admin (không đổi password).
Nếu email chưa tồn tại → tạo user mới với is_admin=True.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models.user import User


def get_db_url() -> str:
    raw = os.getenv(
        "DATABASE_URL",
        "postgresql://admin:password@localhost:5432/warehouse",
    )
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw


async def create_or_promote_admin(email: str, password: str, full_name: str) -> None:
    engine = create_async_engine(get_db_url(), pool_size=1)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            if existing.is_admin:
                print(f"✓ {email} đã là admin rồi.")
            else:
                existing.is_admin = True
                await db.commit()
                print(f"✓ Đã promote {email} thành admin.")
        else:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=full_name,
                is_admin=True,
                skills=[],
                preferred_cities=[],
                desired_titles=[],
            )
            db.add(user)
            await db.commit()
            print(f"✓ Đã tạo admin mới: {email} ({full_name})")

    await engine.dispose()


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python scripts/create_admin.py <email> <password> <full_name>")
        print('Ví dụ: python scripts/create_admin.py admin@tp.vn "P@ss123!" "Admin TP"')
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]
    full_name = sys.argv[3]

    if len(password) < 8:
        print("✗ Mật khẩu phải có ít nhất 8 ký tự.")
        sys.exit(1)

    asyncio.run(create_or_promote_admin(email, password, full_name))


if __name__ == "__main__":
    main()
