"""Data-grounded personalized career recommendations.

Everything the user sees is backed by REAL warehouse numbers (active jobs in
dbt_dev_gold / dbt_dev_silver). The LLM only narrates the numbers we compute —
it never invents market data. If the LLM is unavailable the endpoint still
returns the full facts plus a templated narrative, so it never hard-fails.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.models.user import User

logger = logging.getLogger(__name__)

GOLD = "dbt_dev_gold"
SILVER = "dbt_dev_silver"
_SALARY_CAP = 200_000_000  # ignore obvious data outliers (VND/month)

# Tokens the extractor emits that are not real, learnable skills — keep them out
# of the "skills to learn" list so recommendations stay actionable.
_SKILL_STOPWORDS = {
    # generic non-skills
    "ai", "it", "data", "cloud", "database", "english", "software",
    "developer", "engineer", "communication", "teamwork", "analysis",
    # job titles that the extractor mislabels as skills (they are roles, not
    # things to learn) — mirrors the job_category vocabulary
    "data engineer", "data analyst", "data scientist", "ai engineer",
    "business analyst", "business development", "technical sales",
    "backend developer", "frontend developer", "qa engineer",
    "erp consultant", "supply chain analyst", "machine learning engineer",
}

# Map the free-form city vocabulary users may have to warehouse city_canonical.
_CITY_CANON = {
    "hồ chí minh": "HCMC", "ho chi minh": "HCMC", "ho chi minh city": "HCMC",
    "hcm": "HCMC", "hcmc": "HCMC", "tp.hcm": "HCMC", "sài gòn": "HCMC",
    "hà nội": "Hanoi", "ha noi": "Hanoi", "hanoi": "Hanoi",
    "đà nẵng": "Da Nang", "da nang": "Da Nang",
}


def _canon_cities(cities: list[str]) -> list[str]:
    out: list[str] = []
    for c in cities or []:
        canon = _CITY_CANON.get(c.strip().lower())
        if canon and canon not in out:
            out.append(canon)
    return out


def _m(vnd) -> float | None:
    """VND → triệu VND, rounded to 0.1."""
    if vnd is None:
        return None
    return round(float(vnd) / 1_000_000.0, 1)


def _avg_million_sql(col: str) -> str:
    """SQL fragment: average of `col` (capping outliers) → triệu VND, rounded.
    Uses the SAME qualified column in avg and filter to avoid ambiguity in joins."""
    return (
        f"round((avg({col}) filter (where {col} is not null and {col} <= {_SALARY_CAP})"
        f" / 1000000.0)::numeric, 1)::float"
    )


async def _active_categories(db: AsyncSession) -> dict[str, str]:
    rows = await db.execute(text(
        f"select distinct job_category from {GOLD}.fct_jobs_daily "
        "where is_active and job_category is not null"
    ))
    return {r[0].lower(): r[0] for r in rows.all()}


async def _resolve_targets(db: AsyncSession, user: User, cat_lookup: dict[str, str]) -> list[str]:
    """Which job categories are we recommending for? Prefer the user's desired
    titles; else infer from the categories their existing skills show up in;
    else the biggest categories on the market."""
    targets: list[str] = []
    for t in (user.desired_titles or []):
        canon = cat_lookup.get(t.strip().lower())
        if canon and canon not in targets:
            targets.append(canon)
    if targets:
        return targets[:3]

    skills = [s.strip().lower() for s in (user.skills or []) if s.strip()]
    if skills:
        rows = await db.execute(text(f"""
            select f.job_category, count(*) n
            from {SILVER}.silver_skill_long sl
            join {GOLD}.fct_jobs_daily f
              on f.source = sl.source and f.source_job_id = sl.source_job_id
            where f.is_active and f.job_category is not null
              and sl.skill_name_norm = any(:skills)
            group by 1 order by 2 desc limit 2
        """), {"skills": skills})
        inferred = [r[0] for r in rows.all()]
        if inferred:
            return inferred

    rows = await db.execute(text(
        f"select job_category from {GOLD}.fct_jobs_daily "
        "where is_active and job_category is not null "
        "group by 1 order by count(*) desc limit 2"
    ))
    return [r[0] for r in rows.all()]


async def _match_count(db: AsyncSession, cats: list[str], cities: list[str]) -> tuple[int, int]:
    """(#jobs for target roles, #of those in the user's preferred cities)."""
    total = (await db.execute(text(
        f"select count(*)::int from {GOLD}.fct_jobs_daily "
        "where is_active and job_category = any(:cats)"
    ), {"cats": cats})).scalar() or 0

    in_city = total
    if cities:
        in_city = (await db.execute(text(
            f"select count(*)::int from {GOLD}.fct_jobs_daily "
            "where is_active and job_category = any(:cats) and city_canonical = any(:cities)"
        ), {"cats": cats, "cities": cities})).scalar() or 0
    return total, in_city


async def _skill_gaps(db: AsyncSession, cats: list[str], have: list[str], limit: int = 6) -> list[dict]:
    rows = await db.execute(text(f"""
        select sl.skill_name_norm as skill,
               count(distinct (sl.source, sl.source_job_id))::int as n_jobs,
               {_avg_million_sql('f.salary_vnd_monthly_avg')} as avg_salary_million
        from {SILVER}.silver_skill_long sl
        join {GOLD}.fct_jobs_daily f
          on f.source = sl.source and f.source_job_id = sl.source_job_id
        where f.is_active
          and f.job_category = any(:cats)
          and sl.skill_name_norm is not null
          and length(sl.skill_name_norm) >= 2
          and not (sl.skill_name_norm = any(:have))
          and not (sl.skill_name_norm = any(:stop))
        group by sl.skill_name_norm
        order by n_jobs desc, avg_salary_million desc nulls last
        limit :limit
    """), {
        "cats": cats,
        "have": [s.lower() for s in have] or [""],
        "stop": list(_SKILL_STOPWORDS),
        "limit": limit,
    })
    return [dict(r) for r in rows.mappings().all()]


async def _strengths(db: AsyncSession, cats: list[str], have: list[str]) -> list[dict]:
    if not have:
        return []
    rows = await db.execute(text(f"""
        select sl.skill_name_norm as skill,
               count(distinct (sl.source, sl.source_job_id))::int as n_jobs
        from {SILVER}.silver_skill_long sl
        join {GOLD}.fct_jobs_daily f
          on f.source = sl.source and f.source_job_id = sl.source_job_id
        where f.is_active and f.job_category = any(:cats)
          and sl.skill_name_norm = any(:have)
        group by 1 order by 2 desc limit 8
    """), {"cats": cats, "have": [s.lower() for s in have]})
    return [dict(r) for r in rows.mappings().all()]


async def _salary_band(db: AsyncSession, cats: list[str]) -> dict:
    row = (await db.execute(text(f"""
        select
          percentile_cont(0.25) within group (order by salary_vnd_monthly_avg) as p25,
          percentile_cont(0.50) within group (order by salary_vnd_monthly_avg) as p50,
          percentile_cont(0.75) within group (order by salary_vnd_monthly_avg) as p75,
          count(*)::int as n
        from {GOLD}.fct_jobs_daily
        where is_active and job_category = any(:cats)
          and salary_vnd_monthly_avg is not null
          and salary_vnd_monthly_avg <= :cap
    """), {"cats": cats, "cap": _SALARY_CAP})).mappings().first()
    return {
        "p25_million": _m(row["p25"]),
        "p50_million": _m(row["p50"]),
        "p75_million": _m(row["p75"]),
        "sample_size": row["n"] or 0,
    }


async def _top_companies(db: AsyncSession, cats: list[str], limit: int = 5) -> list[dict]:
    rows = await db.execute(text(f"""
        select company_name,
               count(*)::int as n_jobs,
               {_avg_million_sql('salary_vnd_monthly_avg')} as avg_salary_million
        from {GOLD}.fct_jobs_daily
        where is_active and job_category = any(:cats) and company_name is not null
        group by company_name
        order by n_jobs desc limit :limit
    """), {"cats": cats, "limit": limit})
    return [dict(r) for r in rows.mappings().all()]


def _salary_verdict(desired_m: float | None, band: dict) -> str:
    p50 = band.get("p50_million")
    if not desired_m or not p50:
        return "unknown"
    if desired_m < p50 * 0.9:
        return "below_market"
    if desired_m > p50 * 1.1:
        return "above_market"
    return "at_market"


def _fallback_narrative(facts: dict) -> str:
    roles = ", ".join(facts["target_roles"])
    gaps = facts["skill_gaps"]
    band = facts["salary_insight"]
    parts = [
        f"Hiện có {facts['market_fit']['matching_jobs']} việc {roles} đang tuyển"
        + (f" ({facts['market_fit']['matching_jobs_in_city']} ở {', '.join(facts['market_fit']['cities']) or 'khu vực của bạn'})"
           if facts["market_fit"]["cities"] else "")
        + "."
    ]
    if facts["your_strengths"]:
        parts.append(
            "Điểm mạnh khớp thị trường của bạn: "
            + ", ".join(s["skill"] for s in facts["your_strengths"][:4]) + "."
        )
    if gaps:
        g = gaps[0]
        parts.append(
            f"Kỹ năng nên học tiếp: {g['skill']} — xuất hiện trong {g['n_jobs']} job"
            + (f", lương TB ~{g['avg_salary_million']} triệu" if g.get("avg_salary_million") else "")
            + "."
        )
    if band.get("p50_million"):
        parts.append(
            f"Lương thị trường cho vị trí này: p25 {band['p25_million']} – trung vị {band['p50_million']} – p75 {band['p75_million']} triệu/tháng."
        )
    return " ".join(parts)


async def _narrative(facts: dict) -> str:
    if not OPENAI_API_KEY:
        return _fallback_narrative(facts)

    def _call() -> str:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
        system = (
            "Bạn là AI Career Advisor của TalentPulse. Viết một đoạn tư vấn cá nhân hoá, "
            "ấm áp và cụ thể bằng tiếng Việt (~140 từ) DỰA HOÀN TOÀN vào số liệu thị trường được cung cấp "
            "(KHÔNG bịa thêm con số). Cấu trúc: (1) khẳng định điểm mạnh, (2) 1 kỹ năng nên học tiếp kèm số job + lương, "
            "(3) đối chiếu mức lương mong muốn với thị trường, (4) 3 bước hành động cụ thể. Giọng khích lệ, actionable."
        )
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": "Số liệu thị trường (JSON):\n" + json.dumps(facts, ensure_ascii=False)},
            ],
            temperature=0.5,
            timeout=60,
        )
        return (resp.choices[0].message.content or "").strip()

    try:
        text_out = await asyncio.to_thread(_call)
        return text_out or _fallback_narrative(facts)
    except Exception:
        logger.exception("Recommendation narrative LLM call failed; using fallback")
        return _fallback_narrative(facts)


async def build_recommendations(db: AsyncSession, user: User) -> dict:
    cat_lookup = await _active_categories(db)
    targets = await _resolve_targets(db, user, cat_lookup)
    cities = _canon_cities(list(user.preferred_cities or []))
    have = [s.strip() for s in (user.skills or []) if s.strip()]

    if not targets:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "has_enough_data": False,
            "message": "Chưa đủ dữ liệu thị trường để gợi ý. Hãy cập nhật vị trí mong muốn trong hồ sơ.",
        }

    total, in_city = await _match_count(db, targets, cities)
    gaps = await _skill_gaps(db, targets, have)
    strengths = await _strengths(db, targets, have)
    band = await _salary_band(db, targets)
    companies = await _top_companies(db, targets)

    desired_m = _m(user.desired_salary_min) if user.desired_salary_min else None

    facts = {
        "target_roles": targets,
        "market_fit": {
            "matching_jobs": total,
            "matching_jobs_in_city": in_city,
            "cities": cities,
        },
        "your_strengths": strengths,
        "skill_gaps": gaps,
        "salary_insight": {
            **band,
            "your_desired_million": desired_m,
            "verdict": _salary_verdict(desired_m, band),
        },
        "top_companies": companies,
    }

    narrative = await _narrative(facts)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "has_enough_data": True,
        "profile_used": {
            "skills": have,
            "desired_titles": list(user.desired_titles or []),
            "experience_level": user.experience_level,
            "preferred_cities": list(user.preferred_cities or []),
        },
        **facts,
        "narrative": narrative,
        "data_note": f"Dựa trên {total} tin tuyển đang mở cho {', '.join(targets)} trong kho dữ liệu TalentPulse.",
    }
