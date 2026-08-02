"""users: them cot last_active_at

Revision ID: 018
Revises: 017
Create Date: 2026-08-02

DAU/WAU/MAU khong tinh duoc tu du lieu hien co vi User khong luu lan hoat dong
gan nhat. Cot nay duoc ghi toi da 1 lan/user/gio (throttle bang Redis) nen chi
phi ghi khong dang ke.

timezone=True BAT BUOC: repo da tung dinh loi vi ghi naive datetime vao cot
timestamp (JA-T1) — gia tri bi dien giai theo TimeZone cua session, khong phai
UTC. Neu sai o day thi moi con so DAU/WAU/retention deu lech 7 tieng, va lech
im lang: khong co test nao ngoai tang analytics phat hien ra.

Index tren cot nay la bat buoc chu khong phai toi uu som: cau hoi duy nhat ta
hoi cot nay la "co bao nhieu user co last_active_at > X", tuc la range scan tren
toan bo bang users.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        schema="app",
    )
    op.create_index(
        "ix_users_last_active_at", "users", ["last_active_at"], schema="app"
    )


def downgrade() -> None:
    op.drop_index("ix_users_last_active_at", table_name="users", schema="app")
    op.drop_column("users", "last_active_at", schema="app")
