"""Chuan hoa ho so nguoi dung thanh dang cham diem duoc."""
from __future__ import annotations

from dataclasses import dataclass

from app.models.user import User
from app.services.recommendations import _CITY_CANON

# Quet bien tu ton ~250ms cho MOI ky nang tren 6432 tin, tuyen tinh theo so ky
# nang. 30 da vuot xa ho so that (trung vi < 15). Nguoi nhap 80 ky nang thi 30
# cai DAI NHAT van la 30 cai dac trung nhat.
MAX_SKILLS_SCANNED = 30

# Ky nang qua chung chung: xuat hien o gan nhu moi JD nen khong phan biet duoc
# job nao hop hon. Do la NHIEU chu khong phai tin hieu — "ai" khop 42% tong so
# tin ngay ca khi da dung bien tu.
#
# CO Y hep hon `recommendations._SKILL_STOPWORDS`: danh sach ben do con loai ca
# ten vi tri ("data engineer", "backend developer") vi no tra loi "nen hoc gi",
# ma ten vi tri thi khong hoc duoc. O day nguoc lai — ho so ghi "data engineer"
# va JD cung ghi "data engineer" la tin hieu khop RAT manh, phai giu.
_MATCH_NOISE = frozenset({
    "ai", "it", "data", "cloud", "database", "english", "software",
    "communication", "teamwork",
})


@dataclass(frozen=True)
class Profile:
    """Phan ho so da chuan hoa. Frozen vi khong tieu chi nao duoc sua no."""

    skills: list[str]
    titles: list[str]
    cities: list[str]
    salary_min: int | None
    salary_max: int | None
    level: str | None

    @property
    def is_empty(self) -> bool:
        """Khong co tieu chi nao => khong cham diem duoc.

        Caller PHAI kiem tra co nay va tra null cho UI, thay vi de engine tra 0.
        Mot con so bia cho ho so trong day nguoi dung ket luan rang diem nay
        khong co y nghia gi.
        """
        return not (
            self.skills or self.titles or self.cities
            or self.level or self.salary_min or self.salary_max
        )


def build_profile(user: User) -> Profile:
    skills: list[str] = []
    for raw in (user.skills or []):
        s = (raw or "").strip().lower()
        if s and s not in _MATCH_NOISE and len(s) >= 2 and s not in skills:
            skills.append(s)
    # Uu tien ky nang DAI khi phai cat bot — xem MAX_SKILLS_SCANNED.
    skills.sort(key=len, reverse=True)

    cities: list[str] = []
    for raw in (user.preferred_cities or []):
        canon = _CITY_CANON.get((raw or "").strip().lower())
        if canon and canon not in cities:
            cities.append(canon)

    titles = [t.strip().lower() for t in (user.desired_titles or []) if (t or "").strip()]

    # Form chua chan duoc min > max, va du lieu that da co ca nay. Doi cho thay
    # vi bo qua, de khong am tham danh rot tieu chi luong cua nguoi dung.
    lo, hi = user.desired_salary_min, user.desired_salary_max
    if lo is not None and hi is not None and lo > hi:
        lo, hi = hi, lo

    return Profile(
        skills=skills[:MAX_SKILLS_SCANNED],
        titles=titles,
        cities=cities,
        salary_min=lo,
        salary_max=hi,
        level=(user.experience_level or None),
    )
