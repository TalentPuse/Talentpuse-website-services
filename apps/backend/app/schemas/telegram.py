from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DeepLinkResponse(BaseModel):
    deep_link: str
    expires_in_seconds: int


class TelegramStatusResponse(BaseModel):
    linked: bool
    chat_id: int | None = None
    telegram_username: str | None = None
    status: str
    linked_at: datetime | None = None
    job_alert_enabled: bool


class TelegramUser(BaseModel):
    id: int
    username: str | None = None
    first_name: str = ""


class TelegramChat(BaseModel):
    id: int


class TelegramMessage(BaseModel):
    message_id: int
    from_: TelegramUser | None = Field(None, alias="from")
    chat: TelegramChat
    text: str | None = None

    model_config = {"populate_by_name": True}


class TelegramUpdate(BaseModel):
    update_id: int
    message: TelegramMessage | None = None
