"""Tong hop ket qua cua cac tieu chi thanh mot diem duy nhat."""
from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.job_fit.criteria import CRITERIA
from app.services.job_fit.facts import JobFacts, fetch_facts
from app.services.job_fit.profile import Profile, build_profile


@dataclass(frozen=True)
class FitScore:
    score: int
    reasons: list[str] = field(default_factory=list)
    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    skill_basis: str = "none"
    skills_matched: int = 0
    skills_total: int = 0
    # Tieu chi nao THUC SU duoc dung. UI phai noi ro dieu nay, de nguoi dung
    # khong tuong moi diem so deu cung mot do tin cay.
    criteria_used: list[str] = field(default_factory=list)


def combine(profile: Profile, facts: JobFacts) -> FitScore | None:
    """None = khong cham duoc (ho so rong, hoac tin khong co du lieu nao dung)."""
    if profile.is_empty:
        return None

    results = [c.evaluate(profile, facts) for c in CRITERIA]
    used = [r for r in results if r.score is not None]
    if not used:
        return None

    # Trung binh co trong so tren nhung tieu chi CO du lieu.
    #
    # Vi sao phai chuan hoa lai thay vi coi tieu chi thieu du lieu la 0: mot tin
    # khong ghi luong se bi tru 12 diem du dieu do chang noi gi ve do phu hop —
    # do la phat nguoi dung vi lo hong cua kho du lieu. Chuan hoa lai giu moi
    # diem so tren cung mot thang bat ke tin do co bao nhieu truong.
    num = sum(r.weight * r.score for r in used)
    den = sum(r.weight for r in used)
    score = round(100 * num / den)

    skill = next(r for r in results if r.key == "skills")
    d = skill.detail
    return FitScore(
        score=score,
        reasons=[r.reason for r in results if r.reason],
        matched_skills=d.get("matched", []),
        missing_skills=d.get("missing", []),
        skill_basis=d.get("basis", "none"),
        skills_matched=d.get("hit", 0),
        skills_total=d.get("total", 0),
        criteria_used=sorted(r.key for r in used),
    )


async def score_jobs(
    db: AsyncSession, user: User, keys: list[tuple[str, str]]
) -> dict[tuple[str, str], FitScore]:
    """Cham diem mot DANH SACH job cu the. Khoa tra ve la (source, source_job_id).

    Job khong ton tai / da het han se khong xuat hien trong ket qua — caller tu
    xu ly key thieu.
    """
    profile = build_profile(user)
    if not keys or profile.is_empty:
        return {}

    out: dict[tuple[str, str], FitScore] = {}
    for facts in await fetch_facts(db, profile.skills, keys):
        fit = combine(profile, facts)
        if fit is not None:
            out[(facts.source, facts.source_job_id)] = fit
    return out
