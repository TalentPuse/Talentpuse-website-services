"""User + cờ phụ trợ của run agent hiện tại, truyền qua ContextVar.

Đường AG-UI (api/agui.py) build graph MỘT LẦN lúc khởi động, nên tool không
thể closure over user_id như đường SSE cũ vẫn làm. Cả hai đường giờ set
ContextVar này trước khi chạy agent; tool đọc ra. contextvars được copy sang
task con, nên tool do LangGraph gọi vẫn thấy đúng giá trị.
"""
from __future__ import annotations

import uuid
from contextvars import ContextVar

current_agent_user_id: ContextVar[uuid.UUID | None] = ContextVar(
    "current_agent_user_id", default=None
)

# Đường SSE cấp dict {"updated": False}; edit_cv bật lên True để endpoint biết
# mà bắn event `cv_updated`. Đường AG-UI để None (widget tự lo refresh).
current_cv_update_flag: ContextVar[dict | None] = ContextVar(
    "current_cv_update_flag", default=None
)


def require_agent_user_id() -> uuid.UUID:
    """User của run hiện tại. LookupError nếu chưa ai set — lỗi lập trình,
    không phải lỗi người dùng."""
    uid = current_agent_user_id.get()
    if uid is None:
        raise LookupError("current_agent_user_id chưa được set cho run này")
    return uid
