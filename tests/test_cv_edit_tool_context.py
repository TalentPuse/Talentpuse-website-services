"""edit_cv đọc user từ ContextVar và báo 'đã đổi CV' qua current_cv_update_flag."""
import pytest

from app.services.agent.context import current_agent_user_id, current_cv_update_flag
from app.services.agent.tools import cv_edit_tool as mod


@pytest.mark.asyncio
async def test_no_user_context_returns_friendly_error():
    token = current_agent_user_id.set(None)
    try:
        out = await mod.edit_cv.coroutine(instruction="rút gọn summary")
        assert out.startswith("Loi")
    finally:
        current_agent_user_id.reset(token)


@pytest.mark.asyncio
async def test_no_cv_returns_guidance(seed_user, monkeypatch):
    """User chưa có CV → ValueError('no_cv') → câu hướng dẫn, không phải traceback."""

    async def _boom(db, user, instruction):
        raise ValueError("no_cv")

    monkeypatch.setattr(mod, "apply_edit", _boom)
    token = current_agent_user_id.set(seed_user.id)
    try:
        out = await mod.edit_cv.coroutine(instruction="thêm Kubernetes")
        assert "upload CV" in out
    finally:
        current_agent_user_id.reset(token)


@pytest.mark.asyncio
async def test_sets_cv_update_flag_for_sse_path(seed_user, monkeypatch):
    async def _ok(db, user, instruction):
        return {"change_summary": "Đã thêm Kubernetes."}

    monkeypatch.setattr(mod, "apply_edit", _ok)
    flag = {"updated": False}
    t1 = current_agent_user_id.set(seed_user.id)
    t2 = current_cv_update_flag.set(flag)
    try:
        out = await mod.edit_cv.coroutine(instruction="thêm Kubernetes")
        assert "Đã thêm Kubernetes." in out
        assert flag["updated"] is True
    finally:
        current_cv_update_flag.reset(t2)
        current_agent_user_id.reset(t1)


@pytest.mark.asyncio
async def test_works_without_flag_agui_path(seed_user, monkeypatch):
    """Đường AG-UI không cấp flag — tool vẫn phải chạy, không nổ."""

    async def _ok(db, user, instruction):
        return {"change_summary": "Đã sửa."}

    monkeypatch.setattr(mod, "apply_edit", _ok)
    t1 = current_agent_user_id.set(seed_user.id)
    t2 = current_cv_update_flag.set(None)
    try:
        out = await mod.edit_cv.coroutine(instruction="sửa gì đó")
        assert "Đã sửa." in out
    finally:
        current_cv_update_flag.reset(t2)
        current_agent_user_id.reset(t1)
