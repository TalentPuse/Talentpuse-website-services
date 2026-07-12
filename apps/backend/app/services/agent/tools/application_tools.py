"""Tool applications — user lấy từ ContextVar của run hiện tại.

Trước đây là closure factory (`make_list_applications_tool(user_id, …)`), dựng
lại mỗi request. Đường AG-UI build graph một lần lúc khởi động nên không dùng
được kiểu đó; cả 2 đường (SSE + AG-UI) giờ set `current_agent_user_id` rồi tool
tự đọc. Mỗi tool mở session riêng — session của request không an toàn để chia sẻ
vào tool call.
"""
from __future__ import annotations

import json
import logging

from langchain_core.tools import tool

from app.core import database as db_module
from app.services.agent.context import require_agent_user_id
from app.services.application_service import get_stats, list_applications

logger = logging.getLogger(__name__)

_NO_USER = "Loi: khong xac dinh duoc nguoi dung cho phien nay."


@tool
async def list_my_applications(status: str | None = None) -> str:
    """Liệt kê job người dùng đã lưu/ứng tuyển.

    Args:
        status: tùy chọn, một trong saved/applied/interviewing/offer/rejected.
    """
    try:
        user_id = require_agent_user_id()
    except LookupError:
        logger.error("list_my_applications gọi khi chưa set current_agent_user_id")
        return _NO_USER

    async with db_module.async_session_factory() as db:
        apps = await list_applications(db, user_id, status=status)

    if not apps:
        return "Người dùng chưa track job nào."

    return json.dumps(
        [
            {
                "id": str(a.id),
                "title": a.title,
                "company": a.company_name,
                "status": a.status,
                "source": a.source,
                "source_url": a.source_url,
                "applied_at": a.applied_at.isoformat() if a.applied_at else None,
            }
            for a in apps
        ],
        ensure_ascii=False,
    )


@tool
async def get_application_stats() -> str:
    """Thống kê job đã ứng tuyển: tổng, phân bố theo trạng thái, số job apply trong 7 ngày qua."""
    try:
        user_id = require_agent_user_id()
    except LookupError:
        logger.error("get_application_stats gọi khi chưa set current_agent_user_id")
        return _NO_USER

    async with db_module.async_session_factory() as db:
        return json.dumps(await get_stats(db, user_id), ensure_ascii=False)
