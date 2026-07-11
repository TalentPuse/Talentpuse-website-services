"""Tool `edit_cv` — user lấy từ ContextVar của run hiện tại.

Trước đây là closure factory nhận (user_id, session_factory, on_update). Đường
AG-UI build graph một lần lúc khởi động nên không dùng được. Nay: user đọc từ
`current_agent_user_id`; việc "CV vừa đổi" báo qua `current_cv_update_flag`
(đường SSE cấp dict để bắn event `cv_updated`; đường AG-UI để None và widget tự
refresh). Tool mở session riêng — session của request không an toàn để chia sẻ
vào tool call.
"""
from __future__ import annotations

import logging

from langchain_core.tools import tool

from app.core import database as db_module
from app.models.user import User
from app.services.agent.context import current_cv_update_flag, require_agent_user_id
from app.services.cv_tailor.edit import apply_edit

logger = logging.getLogger(__name__)

_NO_USER = "Loi: khong xac dinh duoc nguoi dung cho phien nay."
_NO_CV = (
    "Bạn chưa có CV nào để sửa. Hãy upload CV ở trang Hồ sơ trước, "
    "rồi mình sẽ chỉnh giúp."
)
_FAILED = "Xin lỗi, mình chưa cập nhật được CV lúc này. Thử lại sau nhé."


@tool
async def edit_cv(instruction: str) -> str:
    """Chỉnh sửa CV đã render của người dùng theo yêu cầu (sửa summary, thêm/bớt
    kỹ năng, đổi tiêu đề/bullet, v.v.). Gọi tool này KHI người dùng yêu cầu sửa/
    cập nhật/chỉnh CV của họ. Thay đổi sẽ được áp dụng và CV render lại ngay.

    Args:
        instruction: Mô tả thay đổi cần áp dụng cho CV, bằng ngôn ngữ tự nhiên.
            Ví dụ: 'rút gọn summary còn 1 câu', 'thêm kỹ năng Kubernetes'.
    """
    try:
        user_id = require_agent_user_id()
    except LookupError:
        logger.error("edit_cv gọi khi chưa set current_agent_user_id")
        return _NO_USER

    async with db_module.async_session_factory() as db:
        user = await db.get(User, user_id)
        if user is None:
            return "Không tìm thấy người dùng để sửa CV."
        try:
            result = await apply_edit(db, user, instruction)
        except ValueError:
            return _NO_CV
        except RuntimeError:
            logger.exception("edit_cv failed for user %s", user_id)
            return _FAILED

    flag = current_cv_update_flag.get()
    if flag is not None:
        flag["updated"] = True

    return "Đã cập nhật CV của bạn. " + result["change_summary"]
