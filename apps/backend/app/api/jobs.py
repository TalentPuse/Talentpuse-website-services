from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.jobs import (
    FilterOptions,
    JobDetail,
    JobMatch,
    MyAlertList,
    MyAlertRow,
    PublicJobList,
    PublicJobRow,
)
from app.services.job_fit import score_jobs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

# Anh MAC DINH cua tung trang, khong phai logo cong ty. Tra chung ve cho UI se
# lam hang loat dong hien Y HET mot icon xam — te hon Monogram chu cai vi
# Monogram it nhat con phan biet duoc cong ty nay voi cong ty kia.
#
# Do do tren prod: linkedin co 2693 tin CO logo nhung chi DUNG MOT url
# (static.licdn.com/aero-v1/... — anh tinh cua LinkedIn, khong phai logo). Do la
# 61% toan bo tin. vietnamworks co them 17 tin dung company-default-logo.svg.
#
# Loc theo MAU URL chu khong theo tan suat: mot cong ty lon dang 50 tin cung
# dung chung mot logo THAT, loc theo tan suat se xoa nham chinh no.
_LOGO_MAC_DINH = r'(static\.licdn\.com|company-default-logo)'


def _logo_sql(alias: str) -> str:
    """Cot logo da loc anh mac dinh, tra NULL de frontend roi ve Monogram."""
    return (f"CASE WHEN {alias}.company_logo_url ~ '{_LOGO_MAC_DINH}' THEN NULL "
            f"ELSE {alias}.company_logo_url END AS company_logo_url")


# Chan kich thuoc shortlist truoc khi cham diem. Quet bien tu ton ~250ms cho MOI
# ky nang tren 6432 tin; 300 tin voi 30 ky nang la ~350ms — chap nhan duoc cho
# mot request. Cham ca kho se mat hang chuc giay.
#
# Gioi han nay PHAI duoc noi ro tren UI (truong `scored_pool`). Cat bot am tham
# se doc thanh "da xet het kho" trong khi khong phai.
RERANK_POOL = 300


# Escape LIKE wildcard tu dau vao nguoi dung (JA-45): `%`/`_` trong query
# phai la ky tu thuong, khong duoc thanh wildcard SQL.
_SEARCH_ESC = str.maketrans({"\\": "\\\\", "%": "\\%", "_": "\\_"})


def _build_search_score(search: str, params: dict) -> tuple[str, str]:
    """Tokenize query roi xay (where_sql, score_sql) tim kiem theo do lien quan.

    WHERE: BAT KY token nao xuat hien o title / job_category / company_name.
    Diem (cao hon = lien quan hon):
      - token trong title = 30, job_category = 20, company_name = 10
      - ca cau lien mach (phrase) trong title = +60

    Token dai (>=4 ky tu) hoac chua ky tu dac biet: ILIKE %token% — de khop
    "engineer" voi "engineers". Token ngan (2-3 chu cai, vd "ai", "ml"): regex
    bien tu (\mai\M) — de "ai" khong khop nham "email"/"training" (cung van de
    job_fit da gap trong facts.py).

    Tra ve (where_sql, score_sql); params duoc do day bang cac gia tri token.
    """
    tokens = [t for t in re.split(r"\s+", search.strip().lower()) if len(t) >= 2]
    where_parts: list[str] = []
    score_parts: list[str] = []
    cols = (("f.title", 30), ("f.job_category", 20), ("f.company_name", 10))
    for i, tok in enumerate(tokens):
        if len(tok) >= 4 or not tok.isalpha():
            params[f"tok{i}"] = f"%{tok.translate(_SEARCH_ESC)}%"
            match = f"ILIKE :tok{i}"
        else:
            params[f"tok{i}"] = f"\\m{tok}\\M"
            match = f"~* :tok{i}"
        where_parts.append("(" + " OR ".join(f"{col} {match}" for col, _ in cols) + ")")
        score_parts.extend(
            f"(CASE WHEN {col} {match} THEN {w} ELSE 0 END)" for col, w in cols
        )
    if len(tokens) > 1:
        params["phrase"] = f"%{search.strip().lower().translate(_SEARCH_ESC)}%"
        score_parts.append("(CASE WHEN f.title ILIKE :phrase THEN 60 ELSE 0 END)")
    if not score_parts:
        return "(1=0)", "0"
    return "(" + " OR ".join(where_parts) + ")", "(" + " + ".join(score_parts) + ")"


@router.get("", response_model=PublicJobList)
async def list_jobs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    search: str | None = Query(None),
    city: str | None = Query(None),
    level: str | None = Query(None),
    source: str | None = Query(None),
    has_salary: bool | None = Query(None),
    category: str | None = Query(None),
    sort: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublicJobList:
    conditions: list[str] = []
    params: dict = {}
    # Diem tim kiem (search_score) — chi khac 0 khi co query, mac dinh 0 de
    # cau SQL giu nguyen cau truc (sap theo posted_at nhu cu).
    search_score = "0"

    if search:
        where_search, search_score = _build_search_score(search, params)
        conditions.append(where_search)

    if city:
        conditions.append("f.city_canonical = :city")
        params["city"] = city
    if level:
        conditions.append("f.job_level = :level")
        params["level"] = level
    if source:
        conditions.append("f.source = :source")
        params["source"] = source
    if has_salary is True:
        conditions.append("f.salary_vnd_monthly_avg IS NOT NULL")
    elif has_salary is False:
        conditions.append("f.salary_vnd_monthly_avg IS NULL")
    if category:
        conditions.append("f.job_category = :category")
        params["category"] = category

    where_extra = (" AND " + " AND ".join(conditions)) if conditions else ""

    count_result = await db.execute(
        text(f"""
            SELECT count(DISTINCT (f.source, f.source_job_id))
            FROM dbt_dev_gold.fct_jobs_daily f
            WHERE f.is_active {where_extra}
        """),
        params,
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    # `silver_skill_long` nằm ở kho dbt, không phải schema app, nên nó có thể CHƯA
    # được build (dbt chạy thiếu model) trong khi `fct_jobs_daily` đã đầy dữ liệu.
    # LEFT JOIN vào một bảng không tồn tại làm hỏng CẢ câu lệnh ⇒ trang Việc làm
    # trả 500 và trắng trơn, dù 900+ job vẫn nằm sẵn trong kho.
    #
    # Ở đây skill chỉ là phần làm giàu — LEFT JOIN kèm COALESCE về mảng rỗng đã tự
    # tuyên bố nó là tùy chọn. Nên thiếu bảng thì hiện job KHÔNG có tag skill, đúng
    # như khi job không có skill nào, chứ không phải sập cả trang.
    #
    # `to_regclass` chỉ tra catalog nên rẻ, và CỐ Ý không cache: dbt build bảng đó
    # giữa chừng thì request kế tiếp tự có skill trở lại, không cần restart.
    has_skill_table = bool(
        (
            await db.execute(text("SELECT to_regclass('dbt_dev_silver.silver_skill_long') IS NOT NULL"))
        ).scalar()
    )
    if has_skill_table:
        skills_select = """COALESCE(
                array_agg(DISTINCT sk.skill_name_norm)
                    FILTER (WHERE sk.skill_name_norm IS NOT NULL),
                ARRAY[]::text[]
            ) AS skills"""
        skills_join = """LEFT JOIN dbt_dev_silver.silver_skill_long sk
            ON sk.source = f.source AND sk.source_job_id = f.source_job_id"""
    else:
        logger.warning("silver_skill_long missing; serving jobs without skill tags")
        skills_select = "ARRAY[]::text[] AS skills"
        skills_join = ""

    if sort == "match":
        # Rerank theo do phu hop: KHONG BAO GIO cham ca kho (spec §2.4). Lay
        # mot pool gioi han cac tin MOI NHAT khop bo loc, cham diem shortlist
        # do, roi sap xep + cat trang trong Python — Postgres khong biet diem
        # phu hop, chi SQL engine job_fit moi tinh duoc.
        #
        # DISTINCT ON (source, source_job_id) BAT BUOC: fct_jobs_daily la bang
        # SNAPSHOT HANG NGAY, mot tin co the co NHIEU dong is_active=true (moi
        # dong mot snapshot_date). Khong khu trung truoc khi LIMIT :pool thi
        # cung mot tin chiem nhieu cho trong pool, lam scored_pool bi phong dai
        # va mot tin co the xuat hien hai lan trong ket qua rerank. Cung cach
        # da ap dung o job_fit/facts.py va _DETAIL_SQL ben tren.
        pool_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
        pool_params["pool"] = RERANK_POOL
        pool_result = await db.execute(text(f"""
            WITH pool AS (
                SELECT DISTINCT ON (f.source, f.source_job_id) f.*
                FROM dbt_dev_gold.fct_jobs_daily f
                WHERE f.is_active {where_extra}
                ORDER BY f.source, f.source_job_id, f.snapshot_date DESC
            )
            SELECT
                f.source,
                f.source_job_id,
                f.title,
                f.company_name,
                f.city_canonical,
                f.job_level,
                f.job_category,
                round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
                sd.source_url,
                {_logo_sql("sd")},
                f.posted_at,
                {skills_select}
            FROM pool f
            LEFT JOIN dbt_dev_silver.silver_job_detail sd
                ON sd.source = f.source AND sd.source_job_id = f.source_job_id
            {skills_join}
            GROUP BY f.source, f.source_job_id, f.title, f.company_name,
                     f.city_canonical, f.job_level, f.job_category,
                     f.salary_vnd_monthly_avg, sd.source_url, sd.company_logo_url,
                     f.posted_at
            ORDER BY f.posted_at DESC NULLS LAST
            LIMIT :pool
        """), pool_params)
        pool_rows = list(pool_result.mappings())

        keys = [(r["source"], r["source_job_id"]) for r in pool_rows]
        scores = await score_jobs(db, user, keys)

        # Sap xep giam dan theo diem; tin KHONG cham duoc (score is None) xep
        # cuoi thay vi bi coi la 0, va giu nguyen thu tu tuong doi ban dau
        # (posted_at DESC, tu truy van tren) lam tie-break — enumerate() bao
        # toan on dinh cho ca hai nhom.
        def _sort_key(item: tuple[int, object]) -> tuple[bool, int, int]:
            idx, row = item
            fit = scores.get((row["source"], row["source_job_id"]))
            return (fit is None, -(fit.score if fit else 0), idx)

        ordered_rows = [row for _, row in sorted(enumerate(pool_rows), key=_sort_key)]
        # Dem so tin THUC SU cham duoc, khong phai kich thuoc pool. Truoc day gan
        # bang len(ordered_rows), nen ho so con rong van tra scored_pool = 300 va
        # UI hien "Đã chấm 300 tin mới nhất khớp bộ lọc" trong khi score_jobs tra
        # ve rong va MOI match_score deu null — tuc la cham 0 tin. Nguoi dung bam
        # "Phù hợp nhất", nhan lai dung thu tu cu, kem mot cau khong dung su that.
        # None => UI khong hien dong do (app/jobs/page.tsx da guard `!= null`).
        scored_pool = len(scores) or None
        page_rows = ordered_rows[offset: offset + per_page]

        jobs = [
            PublicJobRow(
                source=row["source"],
                source_job_id=row["source_job_id"],
                title=row["title"],
                company_name=row["company_name"],
                city_canonical=row["city_canonical"],
                job_level=row["job_level"],
                job_category=row["job_category"],
                salary_million=row["salary_million"],
                source_url=row["source_url"],
                posted_at=row["posted_at"],
                skills=row["skills"] or [],
                match_score=(
                    fit.score
                    if (fit := scores.get((row["source"], row["source_job_id"])))
                    else None
                ),
            )
            for row in page_rows
        ]

        return PublicJobList(
            jobs=jobs, total=total, page=page, per_page=per_page, scored_pool=scored_pool,
        )

    # DISTINCT ON (source, source_job_id) BAT BUOC — cung ly do da ap o nhanh
    # rerank va o _DETAIL_SQL, nhung nhanh nay truoc day bi bo sot.
    #
    # `fct_jobs_daily` la bang SNAPSHOT HANG NGAY va mot tin giu NHIEU dong
    # is_active cung luc (do duoc: 4301/4383 tin tren prod). Truoc day khong
    # sinh ban trung vi moi snapshot cua mot tin deu mang Y HET gia tri, nen
    # GROUP BY gop chung lai — mot su may man, khong phai mot bao dam.
    #
    # May man do vo NGAY khi seed phan loai doi: `dbt run` chi dung lai snapshot
    # cua HOM NAY, nen mot tin chuyen tu 'Other' sang 'Cyber Security' se co
    # snapshot hom qua mang nhan cu va hom nay mang nhan moi — hai gia tri khac
    # nhau, GROUP BY khong gop duoc nua, va tin do hien HAI LAN tren trang.
    # Cau count o tren dung count(DISTINCT ...) nen tong so cung khong con khop
    # voi so dong tra ve.
    #
    # Lay snapshot MOI NHAT cua moi tin, truoc khi join va gop.
    result = await db.execute(text(f"""
        WITH moi_nhat AS (
            SELECT DISTINCT ON (f.source, f.source_job_id) f.*,
                   {search_score} AS search_score
            FROM dbt_dev_gold.fct_jobs_daily f
            WHERE f.is_active {where_extra}
            ORDER BY f.source, f.source_job_id, f.snapshot_date DESC
        )
        SELECT
            f.source,
            f.source_job_id,
            f.title,
            f.company_name,
            f.city_canonical,
            f.job_level,
            f.job_category,
            round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
            sd.source_url,
            {_logo_sql("sd")},
            f.posted_at,
            f.search_score,
            {skills_select}
        FROM moi_nhat f
        LEFT JOIN dbt_dev_silver.silver_job_detail sd
            ON sd.source = f.source AND sd.source_job_id = f.source_job_id
        {skills_join}
        GROUP BY f.source, f.source_job_id, f.title, f.company_name,
                 f.city_canonical, f.job_level, f.job_category,
                 f.salary_vnd_monthly_avg, sd.source_url, sd.company_logo_url,
                 f.posted_at, f.search_score
        ORDER BY f.search_score DESC, f.posted_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), params)

    jobs = [
        PublicJobRow(
            source=row["source"],
            source_job_id=row["source_job_id"],
            title=row["title"],
            company_name=row["company_name"],
            company_logo_url=row["company_logo_url"],
            city_canonical=row["city_canonical"],
            job_level=row["job_level"],
            job_category=row["job_category"],
            salary_million=row["salary_million"],
            source_url=row["source_url"],
            posted_at=row["posted_at"],
            skills=row["skills"] or [],
        )
        for row in result.mappings()
    ]

    return PublicJobList(jobs=jobs, total=total, page=page, per_page=per_page)


@router.get("/filters", response_model=FilterOptions)
async def get_filters(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FilterOptions:
    result = await db.execute(text("""
        SELECT
            array_agg(DISTINCT f.city_canonical ORDER BY f.city_canonical)
                FILTER (WHERE f.city_canonical IS NOT NULL) AS cities,
            array_agg(DISTINCT f.job_level ORDER BY f.job_level)
                FILTER (WHERE f.job_level IS NOT NULL) AS levels,
            array_agg(DISTINCT f.source ORDER BY f.source)
                FILTER (WHERE f.source IS NOT NULL) AS sources,
            array_agg(DISTINCT f.job_category ORDER BY f.job_category)
                FILTER (WHERE f.job_category IS NOT NULL) AS categories
        FROM dbt_dev_gold.fct_jobs_daily f
        WHERE f.is_active
    """))
    row = result.mappings().first()
    return FilterOptions(
        cities=row["cities"] or [],
        levels=row["levels"] or [],
        sources=row["sources"] or [],
        categories=row["categories"] or [],
    )


@router.get("/my-alerts", response_model=MyAlertList)
async def my_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyAlertList:
    uid = str(user.id)

    count_result = await db.execute(
        text(
            "SELECT count(*) FROM ("
            "  SELECT 1 FROM app.alert_logs WHERE user_id = :uid"
            "  GROUP BY job_source, source_job_id"
            ") t"
        ),
        {"uid": uid},
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    # Gom theo (job_source, source_job_id) roi phan trang theo THOI GIAN.
    #
    # Ban cu `DISTINCT ON (al.source_job_id) ... ORDER BY al.source_job_id`
    # phan trang theo id job — thu tu chuoi cua mot id ky thuat, khong lien
    # quan gi toi thoi gian. Trang 1 khong phai alert moi nhat, va badge
    # "Mới nhất" o AlertTimeline gan vao dong dau tien cung sai theo (JA-12,
    # JA-47).
    #
    # `array_agg` thay cho viec chon MOT dong: dong 'website' va 'telegram'
    # duoc ghi trong CUNG MOT transaction, ma `now()` cua Postgres la timestamp
    # cua transaction — `sent_at` BANG NHAU TUYET DOI, khong co tiebreak nao,
    # nen Postgres tra dong nao la tuy y (thuong la 'website'). UI doc mot
    # channel duy nhat do roi gan nhan "Gửi qua Email" cho gan nhu moi alert
    # (JA-29, JA-54).
    #
    # Loc bo 'website' khoi danh sach kenh hien thi: no la dau moc dedup, khong
    # phai mot kenh da gui di dau ca.
    result = await db.execute(text("""
        WITH goc AS (
            SELECT
                al.job_source,
                al.source_job_id,
                max(al.sent_at) AS sent_at,
                coalesce(
                    array_agg(DISTINCT al.channel)
                        FILTER (WHERE al.channel <> 'website' AND al.status IS DISTINCT FROM 'failed'),
                    ARRAY[]::varchar[]
                ) AS channels
            FROM app.alert_logs al
            WHERE al.user_id = :uid
            GROUP BY al.job_source, al.source_job_id
            ORDER BY max(al.sent_at) DESC, al.source_job_id
            LIMIT :limit OFFSET :offset
        ),
        job AS (
            SELECT DISTINCT ON (f.source, f.source_job_id)
                f.source, f.source_job_id, f.title, f.company_name,
                f.city_canonical, f.is_active, f.salary_vnd_monthly_avg
            FROM dbt_dev_gold.fct_jobs_daily f
            WHERE f.source_job_id IN (SELECT source_job_id FROM goc)
            ORDER BY f.source, f.source_job_id, f.snapshot_date DESC
        )
        SELECT
            g.source_job_id,
            coalesce(j.source, g.job_source) AS source,
            j.title,
            j.company_name,
            j.city_canonical,
            round((j.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
            sd.source_url,
            g.sent_at,
            g.channels,
            coalesce(j.is_active, false) AS is_active
        FROM goc g
        -- Join PHAI xet ca nguon: id cua warehouse chi duy nhat trong mot
        -- nguon, nen join theo id khong thoi se keo ve tieu de/cong ty/link
        -- cua mot job HOAN TOAN KHAC (JA-30). Dong cu co job_source = NULL
        -- thi danh chap nhan join theo id — do la tat ca thong tin con lai.
        LEFT JOIN job j
            ON j.source_job_id = g.source_job_id
            AND (g.job_source IS NULL OR j.source = g.job_source)
        LEFT JOIN dbt_dev_silver.silver_job_detail sd
            ON sd.source = j.source AND sd.source_job_id = j.source_job_id
        -- Khong loc `is_active`: tin da het han VAN phai hien duoc. Ban cu loc
        -- trong dieu kien JOIN nen alert cua tin het han render thanh dong
        -- trang "Không rõ" + ba dau gach — nguoi dung khong biet do la job gi
        -- (JA-31). Gio tra `is_active` de UI danh dau "đã hết hạn".
        ORDER BY g.sent_at DESC, g.source_job_id
    """), {"uid": uid, "limit": per_page, "offset": offset})

    alerts = [
        MyAlertRow(
            source_job_id=row["source_job_id"],
            source=row["source"],
            title=row["title"],
            company_name=row["company_name"],
            city_canonical=row["city_canonical"],
            salary_million=row["salary_million"],
            source_url=row["source_url"],
            sent_at=row["sent_at"],
            channels=list(row["channels"] or []),
            is_active=row["is_active"],
        )
        for row in result.mappings()
    ]

    return MyAlertList(alerts=alerts, total=total, page=page, per_page=per_page)


# DISTINCT ON BAT BUOC: fct_jobs_daily la bang SNAPSHOT HANG NGAY, mot tin co the
# co NHIEU dong is_active=true (mot dong moi snapshot_date). WHERE source+sjid da
# loc dung MOT tin, nhung neu khong khu trung theo snapshot_date thi LIMIT 1 lay
# mot dong BAT KY trong so do — khong xac dinh, va co the la ban CU neu luong/cap
# bac giua cac snapshot khac nhau. Cung cach da ap dung o job_fit/facts.py.
_DETAIL_SQL = text(f"""
    WITH job AS (
        SELECT DISTINCT ON (f.source, f.source_job_id) f.*
        FROM dbt_dev_gold.fct_jobs_daily f
        WHERE f.source = :source AND f.source_job_id = :sjid AND f.is_active
        ORDER BY f.source, f.source_job_id, f.snapshot_date DESC
    )
    SELECT
        job.source, job.source_job_id, job.title, job.company_name,
        job.city_canonical, job.job_level, job.job_category, job.degree_label,
        job.posted_at, job.expired_at, job.num_of_views, job.num_of_applications,
        round((job.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
        round((job.salary_vnd_monthly_min / 1000000.0)::numeric, 1)::float AS salary_min_million,
        round((job.salary_vnd_monthly_max / 1000000.0)::numeric, 1)::float AS salary_max_million,
        {_logo_sql("d")}, d.company_size_label, d.primary_address,
        d.employment_type, d.years_of_experience, d.working_days,
        d.job_description_text, d.job_requirement_text,
        d.benefits, d.skills, d.source_url
    FROM job
    LEFT JOIN dbt_dev_silver.silver_job_detail d
        ON d.source = job.source AND d.source_job_id = job.source_job_id
    LIMIT 1
""")


def _json_labels(raw) -> list[str]:
    """`benefits`/`skills` la jsonb voi hinh dang khong dong nhat giua cac nguon:
    co cho la ["a","b"], co cho la [{"name":"a"}]. Lay nhan doc duoc va bo qua
    phan con lai, thay vi de mot nguon la khien ca panel 500."""
    out: list[str] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            for key in ("name", "label", "title", "vi", "en"):
                v = item.get(key)
                if isinstance(v, str) and v.strip():
                    out.append(v.strip())
                    break
    return out[:20]


@router.get("/{source}/{source_job_id}", response_model=JobDetail)
async def get_job_detail(
    source: str,
    source_job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobDetail:
    row = (await db.execute(
        _DETAIL_SQL, {"source": source, "sjid": source_job_id}
    )).mappings().first()
    if row is None:
        raise HTTPException(404, "Job not found")

    scores = await score_jobs(db, user, [(source, source_job_id)])
    fit = scores.get((source, source_job_id))

    return JobDetail(
        source=row["source"],
        source_job_id=row["source_job_id"],
        title=row["title"],
        company_name=row["company_name"],
        company_logo_url=row["company_logo_url"],
        company_size_label=row["company_size_label"],
        city_canonical=row["city_canonical"],
        primary_address=row["primary_address"],
        job_level=row["job_level"],
        job_category=row["job_category"],
        employment_type=row["employment_type"],
        years_of_experience=row["years_of_experience"],
        working_days=row["working_days"],
        degree_label=row["degree_label"],
        salary_million=row["salary_million"],
        salary_min_million=row["salary_min_million"],
        salary_max_million=row["salary_max_million"],
        description=row["job_description_text"],
        requirement=row["job_requirement_text"],
        benefits=_json_labels(row["benefits"]),
        skills=_json_labels(row["skills"]),
        source_url=row["source_url"],
        posted_at=row["posted_at"],
        expired_at=row["expired_at"],
        num_of_views=row["num_of_views"],
        num_of_applications=row["num_of_applications"],
        match=JobMatch(**fit.__dict__) if fit else None,
    )
