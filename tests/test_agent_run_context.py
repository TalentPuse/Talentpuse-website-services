"""ContextVar giữ user của run agent hiện tại (thay closure factory)."""
import asyncio
import uuid

import pytest

from app.services.agent.context import (
    current_agent_user_id,
    require_agent_user_id,
)


def test_require_raises_when_unset():
    token = current_agent_user_id.set(None)
    try:
        with pytest.raises(LookupError):
            require_agent_user_id()
    finally:
        current_agent_user_id.reset(token)


def test_require_returns_the_set_user():
    uid = uuid.uuid4()
    token = current_agent_user_id.set(uid)
    try:
        assert require_agent_user_id() == uid
    finally:
        current_agent_user_id.reset(token)


async def _read_in_task():
    return require_agent_user_id()


@pytest.mark.asyncio
async def test_value_propagates_into_child_task():
    """Tool chạy trong task con do LangGraph tạo — contextvar phải nhìn thấy."""
    uid = uuid.uuid4()
    token = current_agent_user_id.set(uid)
    try:
        seen = await asyncio.create_task(_read_in_task())
        assert seen == uid
    finally:
        current_agent_user_id.reset(token)
