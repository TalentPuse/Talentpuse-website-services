from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TimeSeriesPoint(BaseModel):
    date: str
    value: int


class TierBreakdown(BaseModel):
    tier: str
    count: int


class ChannelBreakdown(BaseModel):
    channel: str
    count: int


class SessionModeBreakdown(BaseModel):
    mode: str
    status: str
    count: int


class AdminStats(BaseModel):
    # KPIs
    total_users: int
    active_users: int
    telegram_linked: int
    alerts_today: int
    alerts_this_week: int
    total_alerts: int
    total_interview_sessions: int
    total_interview_answers: int
    total_chat_rooms: int
    total_chat_messages: int
    active_jobs: int
    alert_subscribers: int

    # Charts
    user_signups_daily: list[TimeSeriesPoint]
    alerts_daily: list[TimeSeriesPoint]
    tier_breakdown: list[TierBreakdown]
    alert_channel_breakdown: list[ChannelBreakdown]
    session_mode_breakdown: list[SessionModeBreakdown]


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


class EmailAlertUpdate(BaseModel):
    enabled: bool


class AdminUserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    subscription_tier: str
    experience_level: str | None = None
    university: str | None = None
    graduation_year: int | None = None
    open_to_internship: bool = False
    part_time_ok: bool = False
    skills: list[str] = []
    desired_titles: list[str] = []
    preferred_cities: list[str] = []
    desired_salary_min: int | None = None
    desired_salary_max: int | None = None
    cv_file_url: str | None = None
    telegram_status: str | None = None
    telegram_username: str | None = None
    alert_enabled: bool = False
    alerts_sent: int = 0
    created_at: datetime
    updated_at: datetime | None = None


class AdminJobRow(BaseModel):
    source: str
    source_job_id: str
    title: str | None
    company_name: str | None
    company_size_bucket: str | None
    job_category: str | None
    city_canonical: str | None
    region: str | None
    job_level: str | None
    degree_label: str | None
    salary_million: float | None
    is_active: bool
    posted_at: datetime | None
    expired_at: datetime | None
    num_of_views: int | None
    num_of_applications: int | None
    source_url: str | None
    address: str | None
    skills: list[str]


class AdminJobList(BaseModel):
    jobs: list[AdminJobRow]
    total: int
    page: int
    per_page: int
