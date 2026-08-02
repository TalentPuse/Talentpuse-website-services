from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AlertLog(Base):
    __tablename__ = "alert_logs"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_job_id: Mapped[str] = mapped_column(String, nullable=False)
    # Khoa thuc the cua warehouse la `(source, source_job_id)` — id chi duy nhat
    # TRONG MOT NGUON. Thieu cot nay, job VietnamWorks `123` va job ITviec `123`
    # bi coi la mot: cai sau bi dedup chan vinh vien, va neu ca hai vao cung mot
    # batch thi UniqueViolation nem ra SAU KHI tin da gui di (JA-05).
    #
    # nullable: cac dong cu (truoc migration 017) khong suy nguoc duoc nguon.
    job_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # timezone=True (migration 016): luu thoi diem tuyet doi. Truoc day la naive
    # UTC, ma lich alert lai tinh theo gio VN — Pydantic phat ra chuoi khong co
    # mui gio nen JavaScript hieu nham la gio dia phuong va hien lech 7 tieng.
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    channel: Mapped[str] = mapped_column(String(20), server_default="telegram")
    status: Mapped[str] = mapped_column(String(20), server_default="sent", nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    last_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # timezone=True nhu `sent_at`: do tre "gui -> bam" tinh bang hieu hai cot
    # nay, nen ca hai phai cung la thoi diem tuyet doi. Mot cot naive o day cho
    # ra do tre lech 7 tieng (co the am) ma khong bao loi gi.
    #
    # `clicked_at` giu lan bam DAU TIEN, `click_count` dem tat ca. Gop hai thu
    # vao mot cot thi mat vinh vien mot trong hai chi so.
    clicked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    click_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)
