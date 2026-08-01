"""Nam tieu chi cham diem, moi tieu chi la mot doi tuong.

Vi sao la class trong khi phan con lai cua repo thuan ham: moi tieu chi co
TRONG SO + CACH TINH + CAU GIAI THICH dinh lien nhau. Gom vao mot giao dien
chung thi them tieu chi thu sau chi la them mot lop, thay vi sua mot ham if/else
phinh to va phai nho cap nhat ba noi. Do la OOP co ly do, khong phai nghi thuc.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.services.job_fit.facts import JobFacts
from app.services.job_fit.profile import Profile
from app.services.job_matcher import LEVEL_MAP

# Voi tin KHONG co ky nang cau truc, ta chi biet JD nhac toi bao nhieu ky nang
# CUA NGUOI DUNG. Bao hoa o 6 vi qua nguong do, nhac them cung khong chung to
# hop hon. Con so nay CHUA duoc hieu chinh bang du lieu nguoi dung that.
SKILL_SATURATION = 6


@dataclass(frozen=True)
class CriterionResult:
    key: str
    weight: int
    score: float | None  # None = tieu chi KHONG AP DUNG cho cap (ho so, tin) nay
    reason: str | None = None
    detail: dict = field(default_factory=dict)


class Criterion(Protocol):
    key: str
    weight: int

    def evaluate(self, profile: Profile, facts: JobFacts) -> CriterionResult: ...


@dataclass(frozen=True)
class SkillCriterion:
    key: str = "skills"
    weight: int = 45

    def evaluate(self, profile: Profile, facts: JobFacts) -> CriterionResult:
        if not profile.skills:
            return CriterionResult(self.key, self.weight, None)

        # Tin CO ky nang cau truc (~33%): dem duoc dap ung bao nhieu phan YEU CAU.
        if facts.job_skills:
            overlap = [s for s in facts.matched_skills if s in facts.job_skills]
            missing = [s for s in facts.job_skills if s not in facts.matched_skills][:6]
            total = len(facts.job_skills)
            return CriterionResult(
                self.key, self.weight, len(overlap) / total,
                reason=f"Khớp {len(overlap)}/{total} kỹ năng tin này yêu cầu",
                detail={"basis": "required", "matched": overlap,
                        "missing": missing, "hit": len(overlap), "total": total},
            )

        # Tin KHONG co ky nang cau truc (67%, gom toan bo LinkedIn): chi biet JD
        # nhac toi bao nhieu ky nang cua nguoi dung. `missing` de RONG vi ta
        # khong biet tin yeu cau gi — doan bua o day se hien thanh loi khuyen sai.
        if facts.has_text:
            hit = len(facts.matched_skills)
            return CriterionResult(
                self.key, self.weight, min(hit, SKILL_SATURATION) / SKILL_SATURATION,
                reason=(f"Mô tả công việc nhắc tới {hit} kỹ năng của bạn" if hit else None),
                detail={"basis": "mentioned", "matched": facts.matched_skills,
                        "missing": [], "hit": hit, "total": len(profile.skills)},
            )

        return CriterionResult(self.key, self.weight, None)


@dataclass(frozen=True)
class TitleCriterion:
    key: str = "title"
    weight: int = 20

    def evaluate(self, profile: Profile, facts: JobFacts) -> CriterionResult:
        if not profile.titles or not facts.title:
            return CriterionResult(self.key, self.weight, None)
        jt = facts.title.lower()
        best = 0.0
        for t in profile.titles:
            words = [w for w in t.split() if len(w) >= 2]
            if words:
                best = max(best, sum(1 for w in words if w in jt) / len(words))
        return CriterionResult(
            self.key, self.weight, best,
            reason=(f"Đúng vị trí bạn đang tìm: {facts.title}" if best > 0 else None),
        )


@dataclass(frozen=True)
class CityCriterion:
    key: str = "city"
    weight: int = 15

    def evaluate(self, profile: Profile, facts: JobFacts) -> CriterionResult:
        # 1077/6432 tin co city_canonical rong. Cham 0 cho chung la phat nguoi
        # dung vi lo hong kho du lieu, nen tra None de bi loai khoi phep chuan hoa.
        if not profile.cities or not facts.city:
            return CriterionResult(self.key, self.weight, None)
        hit = facts.city in profile.cities
        return CriterionResult(
            self.key, self.weight, 1.0 if hit else 0.0,
            reason=(f"Đúng nơi bạn muốn làm: {facts.city}" if hit else None),
        )


@dataclass(frozen=True)
class SalaryCriterion:
    key: str = "salary"
    weight: int = 12

    def evaluate(self, profile: Profile, facts: JobFacts) -> CriterionResult:
        if profile.salary_min is None and profile.salary_max is None:
            return CriterionResult(self.key, self.weight, None)

        j_lo = facts.salary_min if facts.salary_min is not None else facts.salary_avg
        j_hi = facts.salary_max if facts.salary_max is not None else facts.salary_avg
        if j_lo is None and j_hi is None:
            return CriterionResult(self.key, self.weight, None)
        j_lo = j_lo if j_lo is not None else j_hi
        j_hi = j_hi if j_hi is not None else j_lo

        want_lo = profile.salary_min if profile.salary_min is not None else 0
        want_hi = profile.salary_max if profile.salary_max is not None else float("inf")

        if j_hi >= want_lo and j_lo <= want_hi:
            score = 1.0
        elif j_hi < want_lo and want_lo > 0:
            # Tin tra thap hon muc san: giam dan theo do lech, KHONG cat thang ve
            # 0 — mot tin lech 5% khong the bi doi xu nhu tin lech 80%.
            score = max(0.0, min(1.0, j_hi / want_lo))
        else:
            # Tra CAO hon tran mong muon — day khong phai diem tru.
            score = 1.0

        reason = None
        if score == 1.0 and facts.salary_avg:
            reason = (f"Lương ~{round(facts.salary_avg / 1e6, 1)} triệu, "
                      "nằm trong mức bạn mong muốn")
        return CriterionResult(self.key, self.weight, score, reason=reason)


@dataclass(frozen=True)
class LevelCriterion:
    key: str = "level"
    weight: int = 8

    def evaluate(self, profile: Profile, facts: JobFacts) -> CriterionResult:
        if not profile.level or not facts.job_level:
            return CriterionResult(self.key, self.weight, None)
        # Dung chung LEVEL_MAP cua job_matcher lam nguon su that. Phan tu DAU la
        # khop hoan toan, cac phan tu sau la khop mot phan — hai bang rieng cho
        # cung mot kien thuc se lech nhau theo thoi gian.
        allowed = LEVEL_MAP.get(profile.level, [])
        if not allowed:
            return CriterionResult(self.key, self.weight, None)
        if facts.job_level == allowed[0]:
            score = 1.0
        elif facts.job_level in allowed:
            score = 0.5
        else:
            score = 0.0
        return CriterionResult(
            self.key, self.weight, score,
            reason=(f"Đúng cấp bậc: {facts.job_level}" if score == 1.0 else None),
        )


CRITERIA: tuple[Criterion, ...] = (
    SkillCriterion(), TitleCriterion(), CityCriterion(),
    SalaryCriterion(), LevelCriterion(),
)
