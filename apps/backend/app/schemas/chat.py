from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ChatRoomCreate(BaseModel):
    # Client cấp id để dùng làm threadId của CopilotKit (CopilotChat sở hữu ô
    # nhập nên FE không hook được lúc gửi tin đầu để xin id từ server).
    id: uuid.UUID | None = None
    title: str | None = None


class ChatRoomResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    last_message: str | None = None

    model_config = {"from_attributes": True}


class ChatMessageSend(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatReplyResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
