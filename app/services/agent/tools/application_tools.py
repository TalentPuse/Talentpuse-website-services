"""Factories for the per-user `list_my_applications` / `get_application_stats`
agent tools.

Built fresh per chat request so they can close over the current user's id,
mirroring `cv_edit_tool.make_edit_cv_tool`. Each tool opens its own DB session
via `session_factory` rather than sharing the request session."""
from __future__ import annotations

import json

from langchain_core.tools import StructuredTool

from app.services.application_service import get_stats, list_applications


def make_list_applications_tool(user_id, session_factory) -> StructuredTool:
    async def _list(status: str | None = None) -> str:
        async with session_factory() as db:
            apps = await list_applications(db, user_id, status=status)
        if not apps:
            return "Người dùng chưa track job nào."
        return json.dumps([
            {"title": a.title, "company": a.company_name, "status": a.status,
             "applied_at": a.applied_at.isoformat() if a.applied_at else None}
            for a in apps
        ], ensure_ascii=False)

    return StructuredTool.from_function(
        coroutine=_list, name="list_my_applications",
        description="Liệt kê job người dùng đã ứng tuyển. status tùy chọn: saved/applied/interviewing/offer/rejected.",
    )


def make_application_stats_tool(user_id, session_factory) -> StructuredTool:
    async def _stats() -> str:
        async with session_factory() as db:
            return json.dumps(await get_stats(db, user_id), ensure_ascii=False)

    return StructuredTool.from_function(
        coroutine=_stats, name="get_application_stats",
        description="Thống kê job đã ứng tuyển: tổng, phân bố theo trạng thái, số job apply trong 7 ngày qua.",
    )
