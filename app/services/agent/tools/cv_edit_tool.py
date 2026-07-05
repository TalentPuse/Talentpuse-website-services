"""Factory for the per-user `edit_cv` agent tool.

Built fresh per chat request so it can close over the current user's id and a
callback the streaming endpoint uses to signal the frontend to refresh the CV
pane. Runs in its own DB session (the request session isn't safe to share into
a background tool call)."""
from __future__ import annotations
import logging
from typing import Callable

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.models.user import User
from app.services.cv_tailor.edit import apply_edit

logger = logging.getLogger(__name__)


class _EditCvArgs(BaseModel):
    instruction: str = Field(
        description="Mô tả thay đổi cần áp dụng cho CV, bằng ngôn ngữ tự nhiên. "
        "Ví dụ: 'rút gọn summary còn 1 câu', 'thêm kỹ năng Kubernetes', "
        "'đổi tiêu đề công việc mới nhất thành Senior Data Engineer'."
    )


def make_edit_cv_tool(
    user_id,
    session_factory,
    on_update: Callable[[str], None],
) -> StructuredTool:
    async def _edit(instruction: str) -> str:
        async with session_factory() as db:
            user = await db.get(User, user_id)
            if user is None:
                return "Không tìm thấy người dùng để sửa CV."
            try:
                result = await apply_edit(db, user, instruction)
            except ValueError:
                return ("Bạn chưa có CV nào để sửa. Hãy upload CV ở trang Hồ sơ trước, "
                        "rồi mình sẽ chỉnh giúp.")
            except RuntimeError:
                logger.exception("edit_cv failed for user %s", user_id)
                return "Xin lỗi, mình chưa cập nhật được CV lúc này. Thử lại sau nhé."
        on_update(result["change_summary"])
        return "Đã cập nhật CV của bạn. " + result["change_summary"]

    return StructuredTool.from_function(
        coroutine=_edit,
        name="edit_cv",
        description=(
            "Chỉnh sửa CV đã render của người dùng theo yêu cầu (sửa summary, thêm/bớt "
            "kỹ năng, đổi tiêu đề/bullet, v.v.). Gọi tool này KHI người dùng yêu cầu sửa/"
            "cập nhật/chỉnh CV của họ. Thay đổi sẽ được áp dụng và CV render lại ngay."
        ),
        args_schema=_EditCvArgs,
    )
