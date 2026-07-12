# Plan: AI Skill Advisor Agent (v2 — MCP Client + Chat Rooms)

## Context

Build AI Assistant chatbot recommend top skills dựa trên CV/profile user, dùng **LangChain `create_agent`**. Agent tools được kéo từ **MCP server** qua **MCP client** (không query SQL trực tiếp).

MCP server đã build xong (`mcp_server/`) — 9 tools + 3 resources, chạy HTTP/SSE port 8080.

Enrich skill pipeline data:
- `mart_skill_demand_v2` — enriched demand với category/importance
- `mart_skill_cooccurrence` — skill pairs
- `mart_skill_trend` — weekly trends

## Features

1. **Chat Rooms** — User tạo nhiều phòng chat riêng biệt
2. **Chat History** — Messages persist vào DB, load lại khi quay lại
3. **MCP Client** — Connect đến MCP server, kéo tools về cho agent
4. **Skill Advisor Agent** — LLM + MCP tools recommend skills
5. **Auto title** — Tên phòng chat tự gen từ message đầu tiên

## Architecture

```
┌─ Frontend ─────────────────────────────────────────────┐
│  Assistant Page                                        │
│  ┌──────────┐  ┌────────────────────────────────────┐  │
│  │ Room List │  │ Chat Window                        │  │
│  │          │  │                                    │  │
│  │ [+ New]  │  │  message history (from DB)         │  │
│  │ Room 1   │  │  ...                               │  │
│  │ Room 2   │  │  user: "nên học gì cho AI?"        │  │
│  │ Room 3   │  │  bot: "TOP 5 skills..."            │  │
│  │          │  │                                    │  │
│  │          │  │  [input]                    [send]  │  │
│  └──────────┘  └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
         │                    │
         │ GET /rooms         │ POST /rooms/:id/messages
         │ POST /rooms        │ GET /rooms/:id/messages
         ▼                    ▼
┌─ Backend ──────────────────────────────────────────────┐
│  api/chat.py                                           │
│    → list rooms / create room / get messages / send    │
│    → send: save user msg → agent.invoke → save reply   │
│                                                        │
│  services/agent/                                       │
│    ├── mcp_client.py → connect MCP server via SSE      │
│    ├── tools.py → @tool wrappers calling MCP client    │
│    └── agent.py → create_agent + system prompt         │
└────────────────────────────────────────────────────────┘
                        │
                        │ call_mcp_tool("query_skill_gap", {...})
                        │ HTTP/SSE
                        ▼
┌─ MCP Server (mcp_server/) ────────────────────────────┐
│  9 tools: query_skill_gap, get_user_profile, etc.     │
│  → asyncpg → PostgreSQL warehouse                     │
│  Running on port 8080                                  │
└────────────────────────────────────────────────────────┘
```

## Skeleton thư mục

```
backend/app/
├── core/
│   ├── config.py                              # EDIT: thêm MCP_SERVER_URL
│   └── ...
├── models/
│   ├── chat.py                                # NEW: ChatRoom + ChatMessage ORM
│   └── ...
├── schemas/
│   └── chat.py                                # NEW: request/response schemas
├── services/
│   └── agent/                                 # NEW — toàn bộ agent module
│       ├── __init__.py                        #    export get_agent()
│       ├── config/
│       │   ├── __init__.py                    #    load yaml + resolve env vars
│       │   └── agent.yaml                    #    model, temperature, mcp_url, history limit
│       ├── prompts/
│       │   ├── __init__.py
│       │   └── skill_advisor_prompt.py       #    SYSTEM_PROMPT template
│       ├── services/
│       │   ├── __init__.py
│       │   ├── llm.py                        #    ChatOpenAI factory
│       │   └── mcp_client.py                 #    MCP client wrapper (fastmcp.Client)
│       ├── tools/
│       │   ├── __init__.py
│       │   └── skill_tools.py                #    @tool wrappers → gọi MCP client
│       └── chains/
│           ├── __init__.py
│           └── skill_advisor_chain.py        #    create_agent() + wire everything
├── api/
│   └── chat.py                                # NEW: rooms + messages endpoints
├── alembic/versions/
│   └── 009_add_chat_tables.py                 # NEW: create tables
├── main.py                                    # EDIT: register router + lifespan
├── requirements.txt                           # EDIT: add deps
└── tests/
    ├── test_agent/
    │   ├── __init__.py
    │   ├── test_mcp_client.py                 # MCP client tests
    │   ├── test_llm.py                        # LLM factory tests
    │   ├── test_skill_tools.py                # tools tests
    │   └── test_skill_advisor_chain.py        # chain tests
    ├── test_api/
    │   ├── __init__.py
    │   └── test_chat_api.py                   # API endpoint tests
    └── conftest.py                            # EDIT: add chat + agent fixtures
```

Tổng: **15 files mới + 4 files sửa**

---

## DB Schema

### Table: `app.chat_rooms`

```sql
CREATE TABLE app.chat_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_chat_rooms_user_id ON app.chat_rooms (user_id, updated_at DESC);
```

### Table: `app.chat_messages`

```sql
CREATE TABLE app.chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES app.chat_rooms(id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL,   -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_chat_messages_room_id ON app.chat_messages (room_id, created_at);
```

---

## Step 1 — `requirements.txt` thêm deps

```
langchain>=1.0
langchain-openai>=0.3
fastmcp>=2.0
pyyaml>=6.0
```

## Step 2 — `core/config.py` thêm 1 dòng

```python
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8080")
```

## Step 3 — Alembic migration `009_add_chat_tables.py`

```python
"""add chat_rooms and chat_messages tables

Revision ID: 009
Revises: 008
Create Date: 2026-05-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_rooms",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index("ix_chat_rooms_user_id", "chat_rooms",
                    ["user_id", "updated_at"], schema="app")

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.chat_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index("ix_chat_messages_room_id", "chat_messages",
                    ["room_id", "created_at"], schema="app")


def downgrade() -> None:
    op.drop_table("chat_messages", schema="app")
    op.drop_table("chat_rooms", schema="app")
```

## Step 4 — `models/chat.py` — ORM models

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.chat_rooms.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

## Step 5 — `schemas/chat.py` — request/response

```python
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class ChatRoomCreate(BaseModel):
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
```

## Step 6 — `services/agent/config/agent.yaml` — all config in one place

```yaml
llm:
  model: "${CHAT_MODEL}"
  base_url: "${OPENAI_BASE_URL}"
  temperature: 0.7
  max_tokens: 2048

mcp:
  server_url: "${MCP_SERVER_URL}"
  timeout: 30

agent:
  max_history_messages: 20
  tools:
    - query_skill_gap
    - get_user_profile
```

## Step 6b — `services/agent/config/__init__.py` — load yaml + resolve env vars

```python
"""Load agent config from YAML, resolve ${ENV_VAR} references."""
import os
import re
from pathlib import Path
from functools import lru_cache
import yaml

_CONFIG_PATH = Path(__file__).parent / "agent.yaml"

@lru_cache
def load_config() -> dict:
    raw = _CONFIG_PATH.read_text(encoding="utf-8")
    def _resolve(match):
        return os.getenv(match.group(1), match.group(0))
    raw = re.sub(r"\$\{(\w+)\}", _resolve, raw)
    return yaml.safe_load(raw)

cfg = load_config()
```

## Step 7 — `services/agent/prompts/skill_advisor_prompt.py` — prompt template

```python
SYSTEM_PROMPT = """Bạn là AI Career Advisor của TalentPulse, chuyên tư vấn kỹ năng \
và lộ trình nghề cho ngành AI/Data tại Việt Nam.

## Nguyên tắc
- Trả lời bằng tiếng Việt, ngắn gọn, actionable, data-driven
- Khi user hỏi về skills/nên học gì → PHẢI gọi tool `query_skill_gap` để lấy data thị trường
- Khi cần biết user profile → gọi tool `get_user_profile`
- Phân tích 2 hướng: GenAI/Applied AI vs Machine Learning thuần
- Mỗi recommend kèm: lý do, sức hút thị trường (số jobs, lương), lộ trình 2-3 bước

## Format trả lời (khi recommend skills)
1. Phân tích background user
2. Suggest hướng phù hợp (GenAI vs ML)
3. TOP 5 skills cần học, mỗi skill: lý do + market demand + learning path
4. Priority: must_have > should_have > nice_to_have
"""
```

## Step 8 — `services/agent/services/llm.py` — LLM factory

```python
"""LLM factory — create ChatOpenAI from YAML config."""
import os
from langchain_openai import ChatOpenAI
from app.services.agent.config import cfg

def create_llm() -> ChatOpenAI:
    llm_cfg = cfg["llm"]
    return ChatOpenAI(
        model=llm_cfg["model"],
        base_url=llm_cfg["base_url"],
        api_key=os.getenv("OPENAI_API_KEY", ""),
        temperature=llm_cfg["temperature"],
        max_tokens=llm_cfg["max_tokens"],
    )
```

## Step 9 — `services/agent/services/mcp_client.py` — MCP client wrapper

```python
"""MCP Client — connect to MCP server, call tools."""
from fastmcp import Client
from app.services.agent.config import cfg

_client: Client | None = None

async def get_mcp_client() -> Client:
    global _client
    if _client is None:
        _client = Client(cfg["mcp"]["server_url"])
    return _client

async def call_mcp_tool(name: str, arguments: dict) -> str:
    client = await get_mcp_client()
    result = await client.call_tool(name, arguments)
    return result[0].text if result else ""

async def close_mcp_client() -> None:
    global _client
    if _client:
        await _client.close()
        _client = None
```

## Step 10 — `services/agent/tools/skill_tools.py` — LangChain tools

```python
"""LangChain tools — thin wrappers calling MCP client."""
from langchain_core.tools import tool
from app.services.agent.services.mcp_client import call_mcp_tool

@tool
async def query_skill_gap(user_skills: str) -> str:
    """Query top in-demand skills that the user DOES NOT already have."""
    return await call_mcp_tool("query_skill_gap", {"user_skills": user_skills})

@tool
async def get_user_profile(user_id: str) -> str:
    """Get user profile: skills, desired job titles, experience level."""
    return await call_mcp_tool("get_user_profile", {"user_id": user_id})
```

## Step 11 — `services/agent/chains/skill_advisor_chain.py` — agent creation

```python
"""Skill Advisor Chain — wire LLM + tools + prompt into agent."""
from langchain.agents import create_agent
from app.services.agent.services.llm import create_llm
from app.services.agent.tools.skill_tools import query_skill_gap, get_user_profile
from app.services.agent.prompts.skill_advisor_prompt import SYSTEM_PROMPT

_agent = None

def get_agent():
    global _agent
    if _agent is not None:
        return _agent

    llm = create_llm()
    _agent = create_agent(
        model=llm,
        tools=[query_skill_gap, get_user_profile],
        system_prompt=SYSTEM_PROMPT,
    )
    return _agent

def reset_agent():
    """For testing — reset singleton."""
    global _agent
    _agent = None
```

## Step 12 — `services/agent/__init__.py`

```python
from app.services.agent.chains.skill_advisor_chain import get_agent
__all__ = ["get_agent"]
```

## Step 13 — `api/chat.py` — API endpoints

```python
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.chat import ChatRoom, ChatMessage
from app.schemas.chat import (
    ChatRoomCreate, ChatRoomResponse,
    ChatMessageSend, ChatMessageResponse, ChatReplyResponse,
)
from app.services.agent import get_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ─── Rooms ──────────────────────────────────────────────

@router.get("/rooms", response_model=list[ChatRoomResponse])
async def list_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.user_id == current_user.id)
        .order_by(ChatRoom.updated_at.desc())
    )
    rooms = rows.scalars().all()

    result = []
    for room in rooms:
        last = await db.execute(
            select(ChatMessage.content)
            .where(ChatMessage.room_id == room.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        preview = last.scalar_one_or_none()
        result.append(ChatRoomResponse(
            id=str(room.id),
            title=room.title,
            created_at=room.created_at,
            updated_at=room.updated_at,
            last_message=(preview[:80] + "...") if preview and len(preview) > 80 else preview,
        ))
    return result


@router.post("/rooms", response_model=ChatRoomResponse, status_code=201)
async def create_room(
    body: ChatRoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = ChatRoom(user_id=current_user.id, title=body.title or "Cuộc trò chuyện mới")
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return ChatRoomResponse(
        id=str(room.id), title=room.title,
        created_at=room.created_at, updated_at=room.updated_at,
    )


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")
    await db.delete(room)
    await db.commit()


# ─── Messages ───────────────────────────────────────────

@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    room_id: str,
    limit: int = 50,
    before: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")

    q = (
        select(ChatMessage)
        .where(ChatMessage.room_id == uuid.UUID(room_id))
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    if before:
        from datetime import datetime
        q = q.where(ChatMessage.created_at < datetime.fromisoformat(before))

    rows = await db.execute(q)
    messages = rows.scalars().all()
    return [
        ChatMessageResponse(
            id=str(m.id), role=m.role, content=m.content, created_at=m.created_at
        )
        for m in messages
    ]


@router.post("/rooms/{room_id}/messages", response_model=ChatReplyResponse)
async def send_message(
    room_id: str,
    body: ChatMessageSend,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")

    # 1. Save user message
    user_msg = ChatMessage(
        room_id=uuid.UUID(room_id),
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    # 2. Auto-generate room title from first message
    if room.title == "Cuộc trò chuyện mới":
        room.title = body.content[:60] + ("..." if len(body.content) > 60 else "")

    await db.commit()
    await db.refresh(user_msg)

    # 3. Load recent history for context
    history = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.room_id == uuid.UUID(room_id))
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    past_msgs = list(reversed(history.scalars().all()))
    agent_messages = [
        {"role": m.role, "content": m.content}
        for m in past_msgs
    ]

    # 4. Call agent
    agent = get_agent()
    result = await agent.ainvoke({"messages": agent_messages})

    # 5. Extract reply
    last_msg = result["messages"][-1]
    reply_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    # 6. Save assistant message
    bot_msg = ChatMessage(
        room_id=uuid.UUID(room_id),
        role="assistant",
        content=reply_text,
    )
    db.add(bot_msg)

    # 7. Update room timestamp
    room.updated_at = func.now()

    await db.commit()
    await db.refresh(bot_msg)

    return ChatReplyResponse(
        user_message=ChatMessageResponse(
            id=str(user_msg.id), role=user_msg.role,
            content=user_msg.content, created_at=user_msg.created_at,
        ),
        assistant_message=ChatMessageResponse(
            id=str(bot_msg.id), role=bot_msg.role,
            content=bot_msg.content, created_at=bot_msg.created_at,
        ),
    )
```

## Step 14 — `main.py` — thêm router + lifespan

```python
from app.api import chat                    # add import
app.include_router(chat.router)             # add this line
```

Lifespan thêm close MCP client:
```python
from app.services.agent.services.mcp_client import close_mcp_client

# trong lifespan, phần cleanup sau yield:
await close_mcp_client()
```

## Step 15 — Tests

### `tests/conftest.py` — thêm fixtures

```python
@pytest.fixture
def mock_mcp_client(monkeypatch):
    """Mock call_mcp_tool to return preset data."""
    mock = AsyncMock(return_value="mocked mcp result")
    monkeypatch.setattr("app.services.agent.services.mcp_client.call_mcp_tool", mock)
    return mock

@pytest.fixture
def mock_agent(monkeypatch):
    """Mock get_agent to return a fake agent."""
    fake_result = {"messages": [MagicMock(content="AI reply from mock")]}
    mock = AsyncMock(return_value=fake_result)
    monkeypatch.setattr("app.services.agent.chains.skill_advisor_chain.get_agent", lambda: mock)
    return mock
```

### `tests/test_agent/test_mcp_client.py` — 3 tests
- `test_call_tool_success` — mock Client.call_tool returns data
- `test_call_tool_empty_result` — returns empty string
- `test_close_client` — verify close clears singleton

### `tests/test_agent/test_llm.py` — 2 tests
- `test_create_llm_from_config` — verify ChatOpenAI created with yaml values
- `test_create_llm_custom_params` — verify different config loads

### `tests/test_agent/test_skill_tools.py` — 4 tests
- `test_query_skill_gap` — verify calls MCP with correct args
- `test_get_user_profile` — verify calls MCP with correct args
- `test_query_skill_gap_empty` — empty input handling
- `test_get_user_profile_not_found` — user not found handling

### `tests/test_agent/test_skill_advisor_chain.py` — 3 tests
- `test_get_agent_singleton` — verify returns same instance
- `test_reset_agent` — verify reset clears singleton
- `test_agent_has_tools` — verify tools wired correctly

### `tests/test_api/test_chat_api.py` — 6 tests
- `test_list_rooms` — returns user rooms
- `test_create_room` — creates with auto title
- `test_delete_room` — deletes room
- `test_get_messages` — returns message history
- `test_send_message` — saves user msg, agent reply, returns both
- `test_send_message_room_not_found` — 404 error

---

## Flow tổng

```
User sends message
    → POST /api/chat/rooms/{id}/messages
    → Save user message to DB
    → Load recent 20 messages from DB
    → agent.ainvoke({messages: history})
        → Agent decides to call tool
        → query_skill_gap("python,sql")
            → call_mcp_tool("query_skill_gap", {...})
                → MCP Client → HTTP/SSE → MCP Server
                → MCP Server → asyncpg → PostgreSQL warehouse
                ← return skill gap JSON
            ← formatted skill gap data
        → Agent generates recommendation
    ← Save assistant message to DB
    ← Return {user_message, assistant_message}
```

## Key design decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Agent module structure | Separated by concern (config/prompts/services/tools/chains) | Production pattern, dễ maintain + extend |
| Config format | YAML + env var interpolation | All agent config 1 chỗ, không scatter across code |
| MCP transport | SSE (HTTP) | MCP server runs as HTTP service |
| Tool integration | `@tool` wrappers calling MCP client | Thin layer, easy to test, decoupled |
| History | Chat messages table | Framework-agnostic, full SQL control |
| Agent memory | Pass history from DB | No LangGraph checkpointer, simpler |
| MCP client lifecycle | Singleton + lifespan close | One connection, cleaned up on shutdown |

## Thứ tự implement

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Add deps | `requirements.txt` | 1 min |
| 2 | Add config env | `core/config.py` | 1 min |
| 3 | Alembic migration | `alembic/versions/009_add_chat_tables.py` | 5 min |
| 4 | ORM models | `models/chat.py` | 5 min |
| 5 | Schemas | `schemas/chat.py` | 5 min |
| 6 | Agent YAML config | `services/agent/config/agent.yaml` + `__init__.py` | 5 min |
| 7 | Prompt template | `services/agent/prompts/skill_advisor_prompt.py` | 3 min |
| 8 | LLM factory | `services/agent/services/llm.py` | 5 min |
| 9 | MCP client | `services/agent/services/mcp_client.py` | 10 min |
| 10 | LangChain tools | `services/agent/tools/skill_tools.py` | 5 min |
| 11 | Agent chain | `services/agent/chains/skill_advisor_chain.py` + `__init__.py` | 10 min |
| 12 | API endpoints | `api/chat.py` | 15 min |
| 13 | Register router + lifespan | `main.py` | 2 min |
| 14 | Unit tests | `tests/` | 25 min |
| 15 | Run migration + verify | | 5 min |

**Total: ~100 min**

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/chat/rooms` | List user's rooms |
| POST | `/api/chat/rooms` | Create new room |
| DELETE | `/api/chat/rooms/{id}` | Delete room + messages |
| GET | `/api/chat/rooms/{id}/messages` | Get message history |
| POST | `/api/chat/rooms/{id}/messages` | Send message → get AI reply |
