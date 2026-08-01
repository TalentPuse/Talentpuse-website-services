"""Truy van kho du lieu de lay cac su that can cho viec cham diem.

TOAN BO SQL cua engine nam o file nay. Cac tieu chi (criteria.py) chi lam viec
voi JobFacts thuan Python nen test duoc ma khong can DB.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

GOLD = "dbt_dev_gold"
SILVER = "dbt_dev_silver"

# Bieu thuc sinh regex khop mot ky nang theo BIEN TU.
#
# Vi sao khong dung ILIKE '%x%': da do tren 6432 tin that — ILIKE '%ai%' khop
# 5974 tin (93%) vi no an trong "email", "training", "maintain". Bien tu
# ~* '\mai\M' chi khop 2702 (42%), la con so hop ly.
#
# Vi sao \m va \M phai CO DIEU KIEN: chung la bien TU, doi ky tu canh no phai la
# ky tu chu. Ky nang 'c++' ket thuc bang '+' nen '\M' khong bao gio thoa; '.net'
# bat dau bang '.' nen '\m' khong bao gio thoa. Gan vo dieu kien thi c++, c#,
# f#, .net KHONG BAO GIO khop — ma regex van hop le nen khong nem loi, chi lang
# le tra false mai mai. Da kiem chung 17/17 ca sau khi sua.
#
# regexp_replace escape metachar vi ky nang that chua '/', '+', '.', '-', '#'.
SKILL_REGEX_SQL = (
    r"(CASE WHEN {skill} ~ '^\w' THEN '\m' ELSE '' END)"
    r" || regexp_replace({skill}, '([.^$*+?()\[\]{{}}|\\-])', '\\\1', 'g')"
    r" || (CASE WHEN {skill} ~ '\w$' THEN '\M' ELSE '' END)"
)


@dataclass(frozen=True)
class JobFacts:
    """Su that ve mot tin tuyen dung, du de cham diem ma khong cham DB nua."""

    source: str
    source_job_id: str
    title: str | None
    company_name: str | None
    city: str | None
    job_level: str | None
    job_category: str | None
    salary_min: float | None
    salary_max: float | None
    salary_avg: float | None
    matched_skills: list[str]
    job_skills: list[str]
    has_text: bool


_FACTS_SQL = rf"""
    WITH sk AS (SELECT unnest(CAST(:skills AS text[])) AS s)
    -- DISTINCT ON BAT BUOC: fct_jobs_daily la bang SNAPSHOT HANG NGAY, mot tin co
    -- NHIEU dong is_active=true (mot dong moi snapshot_date). Do duoc tren kho
    -- local: 6432 dong active nhung chi 3056 tin phan biet — 3376 dong la ban sao.
    -- Khong khu trung thi truyen 1 khoa co the nhan ve 2-3 JobFacts: quet regex
    -- lap thua, va scoring.score_jobs ghi vao dict theo (source, source_job_id)
    -- nen ban sau LANG LE de ban truoc — khong ai biet snapshot nao thang neu
    -- luong/cap bac giua chung khac nhau. Lay ban MOI NHAT cho xac dinh.
    SELECT DISTINCT ON (f.source, f.source_job_id)
        f.source, f.source_job_id, f.title, f.company_name,
        f.city_canonical, f.job_level, f.job_category,
        f.salary_vnd_monthly_min, f.salary_vnd_monthly_max, f.salary_vnd_monthly_avg,
        -- Ky nang CUA NGUOI DUNG ma tin nay nhac toi. Kiem tra CA HAI nguon vi
        -- chung bu tru nhau: silver_skill_long phu 99% VietnamWorks nhung 0%
        -- LinkedIn (4130 tin), con JD text thi nguoc lai. Chi dung mot nguon se
        -- dim han mot nha cung cap vi lo hong ETL chu khong phai vi do phu hop.
        COALESCE(ARRAY(
            SELECT sk.s FROM sk
            WHERE EXISTS (
                SELECT 1 FROM {SILVER}.silver_skill_long sl
                WHERE sl.source = f.source AND sl.source_job_id = f.source_job_id
                  AND sl.skill_name_norm = sk.s
            )
            OR (coalesce(d.job_description_text, '') || ' ' || coalesce(d.job_requirement_text, ''))
               ~* ({SKILL_REGEX_SQL.format(skill='sk.s')})
        ), ARRAY[]::text[]) AS matched_skills,
        -- Ky nang tin nay YEU CAU. Chi ~33% tin co, nen rong KHONG dong nghia
        -- "tin khong yeu cau gi" — xem cach criteria.py phan biet hai co so.
        COALESCE(ARRAY(
            SELECT DISTINCT sl.skill_name_norm
            FROM {SILVER}.silver_skill_long sl
            WHERE sl.source = f.source AND sl.source_job_id = f.source_job_id
              AND sl.skill_name_norm IS NOT NULL
        ), ARRAY[]::text[]) AS job_skills,
        (d.source IS NOT NULL) AS has_text
    FROM unnest(CAST(:sources AS text[]), CAST(:sjids AS text[])) AS t(source, source_job_id)
    JOIN {GOLD}.fct_jobs_daily f
      ON f.source = t.source AND f.source_job_id = t.source_job_id
    LEFT JOIN {SILVER}.silver_job_detail d
      ON d.source = f.source AND d.source_job_id = f.source_job_id
    WHERE f.is_active
    -- ORDER BY phai BAT DAU bang dung cac cot cua DISTINCT ON (rang buoc cua
    -- Postgres); snapshot_date DESC quyet dinh ban nao thang.
    ORDER BY f.source, f.source_job_id, f.snapshot_date DESC
"""


async def fetch_facts(
    db: AsyncSession, skills: list[str], keys: list[tuple[str, str]]
) -> list[JobFacts]:
    """Lay su that cho MOT DANH SACH job cu the.

    KHONG BAO GIO goi ham nay cho ca kho: quet bien tu ton ~250ms cho moi ky nang
    tren 6432 tin. Caller phai loc shortlist truoc.
    """
    if not keys:
        return []

    rows = (await db.execute(text(_FACTS_SQL), {
        "skills": skills or [""],
        "sources": [k[0] for k in keys],
        "sjids": [k[1] for k in keys],
    })).mappings().all()

    return [
        JobFacts(
            source=r["source"],
            source_job_id=r["source_job_id"],
            title=r["title"],
            company_name=r["company_name"],
            city=r["city_canonical"],
            job_level=r["job_level"],
            job_category=r["job_category"],
            salary_min=r["salary_vnd_monthly_min"],
            salary_max=r["salary_vnd_monthly_max"],
            salary_avg=r["salary_vnd_monthly_avg"],
            matched_skills=list(r["matched_skills"] or []),
            job_skills=list(r["job_skills"] or []),
            has_text=bool(r["has_text"]),
        )
        for r in rows
    ]
