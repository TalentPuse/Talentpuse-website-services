from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    telegram_linked: int
    alerts_today: int
    alerts_this_week: int
    total_alerts: int


class AdminUserRow(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    subscription_tier: str
    skills: list[str]
    desired_titles: list[str]
    preferred_cities: list[str]
    telegram_status: str | None
    telegram_username: str | None
    alert_enabled: bool
    alerts_sent: int
    created_at: datetime


class AdminUserList(BaseModel):
    users: list[AdminUserRow]
    total: int
    page: int
    per_page: int


class AlertLogRow(BaseModel):
    id: str
    user_email: str
    user_full_name: str
    source_job_id: str
    job_title: str | None
    company_name: str | None
    channel: str
    sent_at: datetime


class AlertLogList(BaseModel):
    logs: list[AlertLogRow]
    total: int
    page: int
    per_page: int


class SystemConfig(BaseModel):
    alert_interval_seconds: int
    alert_loop_active: bool
    cors_origins: list[str]
    telegram_bot_username: str
    telegram_bot_configured: bool


class ConfigUpdate(BaseModel):
    alert_interval_seconds: int | None = None
    alert_loop_active: bool | None = None


class TierUpdate(BaseModel):
    tier: str
