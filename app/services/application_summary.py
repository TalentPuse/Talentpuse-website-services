import datetime
import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.services.agent.chains.skill_advisor_chain import _get_llm
from app.services.application_service import get_stats, list_applications

_SYSTEM = (
    "Bạn là trợ lý sự nghiệp. Tóm tắt danh sách job người dùng đã ứng tuyển bằng tiếng Việt, "
    "ngắn gọn (tối đa 180 từ), thân thiện. Nêu: tổng quan (bao nhiêu job, vai trò/thành phố nổi bật), "
    "phân bố trạng thái, và ĐÁNH DẤU job status='applied' đã quá 7 ngày chưa cập nhật (gợi ý follow-up). "
    "Kết bằng 1-2 gợi ý hành động. Trả markdown, không rào đón."
)
_INVITE = "Bạn chưa track job nào. Bấm **Đã apply** trên trang Việc làm/Alerts hoặc **Thêm job đã apply** để bắt đầu nhé!"


async def build_summary(db, user_id) -> dict:
    apps = await list_applications(db, user_id)
    now = datetime.datetime.utcnow()
    if not apps:
        return {"summary_md": _INVITE, "generated_at": now}
    stats = await get_stats(db, user_id)
    today = datetime.date.today()
    payload = {
        "stats": stats, "today": today.isoformat(),
        "applications": [
            {"title": a.title, "company": a.company_name, "city": a.city, "status": a.status,
             "applied_at": a.applied_at.isoformat() if a.applied_at else None,
             "days_since_applied": (today - a.applied_at).days if a.applied_at else None}
            for a in apps
        ],
    }
    llm = _get_llm()
    resp = await llm.ainvoke([SystemMessage(content=_SYSTEM), HumanMessage(content=json.dumps(payload, ensure_ascii=False))])
    return {"summary_md": resp.content, "generated_at": now}
