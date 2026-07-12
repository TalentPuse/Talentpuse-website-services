"""Inject user profile into agent context before each LLM call."""

from __future__ import annotations

from dataclasses import dataclass, field

from langchain.agents.middleware import Runtime, before_model
from langchain_core.messages import SystemMessage

PROFILE_MESSAGE_ID = "__user_profile__"


@dataclass(init=False)
class AgentContext:
    profile: dict = field(default_factory=dict)

    def __init__(self, profile: dict | None = None, **_ignored):
        # Legacy per-invoke path builds this as AgentContext(profile=...).
        # The AG-UI path (ag_ui_langgraph.get_stream_kwargs) merges
        # config["configurable"] — which always carries thread_id plus
        # checkpointer keys (checkpoint_ns/checkpoint_id) — into the context
        # dict LangGraph coerces via AgentContext(**context). So tolerate and
        # ignore any key other than profile; the AG-UI path supplies the
        # profile via the current_agent_profile ContextVar instead (see
        # request_user.inject_request_user).
        self.profile = profile if profile is not None else {}

    def model_dump(self) -> dict:
        # CopilotKitMiddleware.before_agent serializes runtime.context to JSON
        # for its "App Context" prompt note and only handles str/dict/pydantic;
        # a plain dataclass raises "not JSON serializable". Expose the profile
        # dict (empty on the AG-UI path, where the profile arrives via the
        # ContextVar) so the middleware skips the note instead of crashing.
        return dict(self.profile)


def _format_profile(profile: dict) -> str:
    lines = ["## Thông tin người dùng (đã có sẵn, không cần hỏi lại):\n"]
    if profile.get("full_name"):
        lines.append(f"- Họ tên: {profile['full_name']}")
    if profile.get("email"):
        lines.append(f"- Email: {profile['email']}")
    if profile.get("skills"):
        lines.append(f"- Kỹ năng hiện có: {', '.join(profile['skills'])}")
    if profile.get("desired_titles"):
        lines.append(f"- Vị trí mong muốn: {', '.join(profile['desired_titles'])}")
    if profile.get("experience_level"):
        lines.append(f"- Kinh nghiệm: {profile['experience_level']}")
    if profile.get("preferred_cities"):
        lines.append(f"- Thành phố ưu tiên: {', '.join(profile['preferred_cities'])}")
    sal_min = profile.get("desired_salary_min")
    sal_max = profile.get("desired_salary_max")
    if sal_min or sal_max:
        lines.append(
            f"- Mức lương mong muốn: {sal_min or '?'} - {sal_max or '?'}M VND"
        )
    if profile.get("university"):
        lines.append(f"- Trường: {profile['university']}")
    if profile.get("graduation_year"):
        lines.append(f"- Năm tốt nghiệp: {profile['graduation_year']}")

    lines.append(
        "\nSử dụng thông tin này để tư vấn cá nhân hóa. "
        "KHÔNG cần gọi tool để lấy profile user."
    )
    return "\n".join(lines)


@before_model
def inject_user_profile(state, runtime: Runtime):
    if not runtime.context or not runtime.context.profile:
        return None

    content = _format_profile(runtime.context.profile)
    return {
        "messages": [
            SystemMessage(content=content, id=PROFILE_MESSAGE_ID),
        ]
    }
