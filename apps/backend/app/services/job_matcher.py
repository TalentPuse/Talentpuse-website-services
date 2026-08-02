"""Job matching logic for alert dispatch.

JobMatcher finds jobs matching a user's profile and manages dedup via alert_logs.
All queries use SQLAlchemy Core for type safety — no raw SQL strings.
"""
from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    any_,
    case,
    func,
    literal_column,
    select,
    and_,
    not_,
    tuple_,
    exists,
    cast,
    Float,
    Numeric,
    String,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.models.analytics import fct_jobs_daily, silver_job_detail, silver_skill_long
from app.models.user import User
from app.services.recommendations import _canon_cities

logger = logging.getLogger(__name__)

# ─── Canonical level taxonomy ──────────────────────────────────────

LEVEL_MAP: dict[str, list[str]] = {
    "student": ["Intern/Student", "Fresher/Entry level"],
    "fresher": ["Fresher/Entry level", "Mid-level"],
    "experienced": ["Mid-level", "Senior"],
    "manager": ["Senior", "Manager", "Director+"],
}

ALERT_LIMIT = 3
STUDENT_ALERT_LIMIT = 50


# ─── Result type ───────────────────────────────────────────────────

@dataclass
class MatchedJob:
    source: str
    source_job_id: str
    title: str | None = None
    company_name: str | None = None
    city_canonical: str | None = None
    job_level: str | None = None
    job_category: str | None = None
    salary_m: float | None = None
    source_url: str | None = None
    posted_at: datetime | None = None
    score: float | None = None
    address: str | None = None
    city_raw_vi: str | None = None


def _row_to_job(row, score: float | None = None) -> MatchedJob:
    mapping = row._mapping
    return MatchedJob(
        source=mapping["source"],
        source_job_id=mapping["source_job_id"],
        title=mapping["title"],
        company_name=mapping["company_name"],
        city_canonical=mapping["city_canonical"],
        job_level=mapping["job_level"],
        job_category=mapping["job_category"],
        salary_m=mapping["salary_m"],
        source_url=mapping.get("source_url"),
        posted_at=mapping.get("posted_at"),
        score=score,
        address=mapping.get("primary_address"),
        city_raw_vi=mapping.get("city_raw_vi"),
    )


# ─── Shared column expressions ─────────────────────────────────────

_salary_m = func.round(
    cast(fct_jobs_daily.c.salary_vnd_monthly_avg / 1000000.0, Numeric(10, 1))
).label("salary_m")


def _base_columns():
    return [
        fct_jobs_daily.c.source,
        fct_jobs_daily.c.source_job_id,
        fct_jobs_daily.c.title,
        fct_jobs_daily.c.company_name,
        fct_jobs_daily.c.city_canonical,
        fct_jobs_daily.c.job_level,
        fct_jobs_daily.c.job_category,
        _salary_m,
        fct_jobs_daily.c.posted_at,
        silver_job_detail.c.source_url,
        silver_job_detail.c.primary_address,
        silver_job_detail.c.city_raw_vi,
    ]


# Kenh `website` la DAU MOC DEDUP, khong phai mot kenh gui.
#
# `log_and_send` ghi dung MOT dong `website` cho moi (user, job) khi that su co
# kenh gui — no tra loi cau hoi "job nay da duoc bao cho user chua". Dedup phai
# dem DUNG kenh nay, khong dem tat ca:
#
#   - Dem tat ca thi nut "Email tat ca" cua admin (chi ghi dong `email`, va co
#     tinh bo qua dedup bang `include_alerted=True`) se NUOT LUON hang doi
#     Telegram: 3 job vua email xong bi loai vinh vien khoi Telegram cua user
#     do. Mot cu click cua admin lam giam vinh vien chat luong kenh Telegram
#     cua toan bo user (JA-53).
#   - Dem thieu (khong dem gi) thi gui trung moi slot.
DEDUP_CHANNEL = "website"


def _alerted_subquery(user_id: UUID):
    """Cac (nguon, job) da bao cho user nay — dung de loai khoi lan tim ke tiep.

    So theo TUPLE `(source, source_job_id)` chu khong chi theo id: id cua
    warehouse chi duy nhat trong mot nguon, nen so theo id khong thoi se chan
    nham job ITviec `123` chi vi user da nhan job VietnamWorks `123` (JA-05).

    Dong cu (truoc migration 017) co `job_source = NULL`; chung khong khop
    tuple nao nen khong con chan gi ca. Danh doi co chu dich: tha gui trung
    mot lan con hon chan vinh vien mot job that su chua gui.
    """
    return select(AlertLog.job_source, AlertLog.source_job_id).where(
        AlertLog.user_id == user_id,
        AlertLog.channel == DEDUP_CHANNEL,
    )


_ILIKE_DAC_BIET = str.maketrans({"\\": "\\\\", "%": "\\%", "_": "\\_"})


def _mau_chua(v: str) -> str:
    """Bien mot chuoi nguoi dung nhap thanh mau ILIKE "chua chuoi nay".

    `%` va `_` la wildcard cua LIKE. Noi thang chuoi nguoi dung vao mau nghia
    la mot title kieu `Senior_Engineer` khop ca `SeniorXEngineer`, con mot
    title chi co `%` khop MOI job — nguoi dung khong he yeu cau dieu do, va
    ket qua alert sai ma khong co dau hieu gi (JA-45).

    Postgres mac dinh dung dau cheo nguoc lam ky tu thoat cua LIKE nen khong
    can menh de ESCAPE rieng.
    """
    return f"%{v.translate(_ILIKE_DAC_BIET)}%"


def _jobs_join():
    return fct_jobs_daily.outerjoin(
        silver_job_detail,
        and_(
            silver_job_detail.c.source == fct_jobs_daily.c.source,
            silver_job_detail.c.source_job_id == fct_jobs_daily.c.source_job_id,
        ),
    )


# ─── JobMatcher ────────────────────────────────────────────────────

class JobMatcher:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_already_alerted_ids(self, user_id: UUID) -> set[tuple[str | None, str]]:
        """Cac `(job_source, source_job_id)` da bao cho user nay.

        Tra TUPLE chu khong phai id tran: id cua warehouse chi duy nhat trong
        mot nguon, nen so theo id khong thoi se chan nham job cua nguon khac
        trung id (JA-05). Chi dem kenh dedup — xem `DEDUP_CHANNEL`.
        """
        result = await self.db.execute(_alerted_subquery(user_id))
        return {(r[0], r[1]) for r in result.all()}

    async def find_jobs(self, user: User, include_alerted: bool = False) -> list[MatchedJob]:
        if getattr(user, "experience_level", None) == "student":
            return await self._find_student_jobs(user, include_alerted)
        return await self._find_scored_jobs(user, include_alerted)

    # ── Student: hard title filter, Intern/Fresher only ────────────

    async def _find_student_jobs(self, user: User, include_alerted: bool = False) -> list[MatchedJob]:
        titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
        if not titles:
            return []

        title_patterns = [_mau_chua(t) for t in titles]
        levels = LEVEL_MAP["student"]

        conditions = [
            fct_jobs_daily.c.is_active == True,  # noqa: E712
            fct_jobs_daily.c.job_level == any_(levels),
            (fct_jobs_daily.c.title.ilike(any_(title_patterns)))
            | (fct_jobs_daily.c.job_category.ilike(any_(title_patterns))),
        ]
        if not include_alerted:
            conditions.append(
                not_(
                    tuple_(fct_jobs_daily.c.source, fct_jobs_daily.c.source_job_id).in_(
                        _alerted_subquery(user.id)
                    )
                )
            )

        # `fct_jobs_daily` la bang SNAPSHOT THEO NGAY: mot tin co nhieu dong
        # `is_active=true`, moi `snapshot_date` mot dong. Thieu `DISTINCT ON`
        # o day nghia la `find_jobs` tra ve cung mot job nhieu lan ->
        # `log_and_send` add nhieu dong AlertLog giong het nhau -> `flush()`
        # nem UniqueViolation -> `dispatch_alerts` rollback. Trang thai khong
        # doi nen LAN DISPATCH NAO CUNG FAIL Y HET: sinh vien khong bao gio
        # nhan duoc gi (JA-06).
        #
        # `ORDER BY` phai bat dau bang dung cac cot cua `DISTINCT ON` roi den
        # `snapshot_date DESC`; thieu ve sau thi Postgres chon dong tuy y va
        # tin da het han van co the duoc alert (JA-28).
        moi_nhat = (
            select(*_base_columns())
            .select_from(_jobs_join())
            .where(and_(*conditions))
            .distinct(fct_jobs_daily.c.source, fct_jobs_daily.c.source_job_id)
            .order_by(
                fct_jobs_daily.c.source,
                fct_jobs_daily.c.source_job_id,
                fct_jobs_daily.c.snapshot_date.desc(),
            )
            .cte("moi_nhat_student")
        )

        query = (
            select(moi_nhat)
            .order_by(moi_nhat.c.posted_at.desc().nullslast())
            .limit(STUDENT_ALERT_LIMIT)
        )

        result = await self.db.execute(query)
        return [_row_to_job(r) for r in result.all()]

    # ── Non-student: scoring with title/city/salary/skills ──────────

    async def _find_scored_jobs(self, user: User, include_alerted: bool = False) -> list[MatchedJob]:
        titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
        # User chon pill "Hồ Chí Minh"; warehouse luu `city_canonical = 'HCMC'`.
        # So thang hai chuoi do thi SAI 100% SO DONG — 25/100 diem cham luon
        # bang 0, job Ha Noi va job Sai Gon xep hang y het nhau (JA-09).
        # `recommendations.py` va `job_fit/profile.py` deu da canonical hoa;
        # rieng matcher cua alert quen.
        cities = _canon_cities([c.strip() for c in (user.preferred_cities or []) if c.strip()])
        skills = [s.strip().lower() for s in (user.skills or []) if s.strip()]
        min_salary = getattr(user, "desired_salary_min", None)
        experience_level = getattr(user, "experience_level", None)

        allowed_levels = LEVEL_MAP.get(experience_level) if experience_level else None

        # Build score components
        title_score = self._title_score_expr(titles)
        city_score = self._city_score_expr(cities)
        salary_score = self._salary_score_expr(min_salary)
        skill_score, skill_subq = self._skill_score_expr(skills)

        total_score = (title_score + city_score + salary_score + skill_score).label("score")

        # Build FROM with optional skill join
        from_clause = _jobs_join()
        if skill_subq is not None:
            from_clause = from_clause.join(
                skill_subq,
                and_(
                    skill_subq.c.source == fct_jobs_daily.c.source,
                    skill_subq.c.source_job_id == fct_jobs_daily.c.source_job_id,
                ),
                full=False,
                isouter=True,
            )

        # Level filter
        level_filters = [
            fct_jobs_daily.c.is_active == True,  # noqa: E712
        ]
        if allowed_levels:
            level_filters.append(fct_jobs_daily.c.job_level == any_(allowed_levels))
        if not include_alerted:
            level_filters.append(
                not_(
                    tuple_(fct_jobs_daily.c.source, fct_jobs_daily.c.source_job_id).in_(
                        _alerted_subquery(user.id)
                    )
                )
            )

        # Scored CTE
        scored_cols = [
            * _base_columns(),
            total_score,
        ]
        scored_query = (
            select(*scored_cols)
            .select_from(from_clause)
            .where(and_(*level_filters))
            .distinct(fct_jobs_daily.c.source, fct_jobs_daily.c.source_job_id)
            # Khong co `ORDER BY` khop thi Postgres chon snapshot TUY Y trong
            # so cac dong cua cung mot job: diem so doi giua cac lan chay va
            # tin da het han van co the duoc alert (JA-28).
            .order_by(
                fct_jobs_daily.c.source,
                fct_jobs_daily.c.source_job_id,
                fct_jobs_daily.c.snapshot_date.desc(),
            )
        )

        scored = scored_query.cte("scored")

        final = (
            select(
                scored.c.source,
                scored.c.source_job_id,
                scored.c.title,
                scored.c.company_name,
                scored.c.city_canonical,
                scored.c.job_level,
                scored.c.job_category,
                scored.c.salary_m,
                scored.c.source_url,
                scored.c.posted_at,
                scored.c.score,
                scored.c.primary_address,
                scored.c.city_raw_vi,
            )
            .where(scored.c.score > 0)
            .order_by(scored.c.score.desc(), scored.c.posted_at.desc().nullslast())
            .limit(ALERT_LIMIT)
        )

        result = await self.db.execute(final)
        return [_row_to_job(r, score=r._mapping.get("score")) for r in result.all()]

    # ── Score expressions ───────────────────────────────────────────

    @staticmethod
    def _title_score_expr(titles: list[str]) -> case:
        if not titles:
            return literal_column("0")
        patterns = [_mau_chua(t) for t in titles]
        return case(
            (
                (fct_jobs_daily.c.title.ilike(any_(patterns)))
                | (fct_jobs_daily.c.job_category.ilike(any_(patterns))),
                40,
            ),
            else_=0,
        )

    @staticmethod
    def _city_score_expr(cities: list[str]) -> case:
        if not cities:
            return literal_column("0")
        return case(
            (fct_jobs_daily.c.city_canonical == any_(cities), 25),
            else_=0,
        )

    @staticmethod
    def _salary_score_expr(min_salary: int | None) -> case:
        if not min_salary or min_salary <= 0:
            return literal_column("0")
        return case(
            (
                and_(
                    fct_jobs_daily.c.salary_vnd_monthly_avg.isnot(None),
                    fct_jobs_daily.c.salary_vnd_monthly_avg >= min_salary,
                ),
                20,
            ),
            else_=0,
        )

    @staticmethod
    def _skill_score_expr(skills: list[str]):
        if not skills:
            return literal_column("0"), None

        skill_subq = (
            select(
                silver_skill_long.c.source,
                silver_skill_long.c.source_job_id,
                (
                    # DISTINCT ca tu va mau: mot skill bi tag trung trong du
                    # lieu crawl truoc day lam phinh ca tu lan mau va bop meo
                    # ty le — mot di thuong du lieu khong lien quan gi toi do
                    # khop that (JA-E2).
                    func.count(func.distinct(silver_skill_long.c.skill_name_norm))
                    .filter(silver_skill_long.c.skill_name_norm == any_(skills))
                    .cast(Float)
                    / func.greatest(
                        func.count(func.distinct(silver_skill_long.c.skill_name_norm)), 1
                    )
                ).label("skill_ratio"),
            )
            .group_by(silver_skill_long.c.source, silver_skill_long.c.source_job_id)
            .subquery("sk")
        )

        # `silver_skill_long` co coverage 0% cho LinkedIn (~64% kho job). Voi
        # `coalesce(..., 0)` cu, user chi khai skills (khong title/city/salary)
        # se cham 0 diem cho MOI job LinkedIn -> bi `WHERE score > 0` loai
        # sach, tuc la mot phan lon kho viec vo hinh voi ho (JA-16).
        #
        # LEFT JOIN cho phep phan biet "job nay khong khop skill nao" (ratio =
        # 0) voi "job nay khong he co du lieu skill" (ratio IS NULL). Chi
        # nhom thu hai moi dung tieu de lam nguon thay the — cac nguon da co
        # du lieu skill van cham diem y nhu cu, khong bi xao tron thu hang.
        patterns = [_mau_chua(s) for s in skills]
        fallback = case(
            (fct_jobs_daily.c.title.ilike(any_(patterns)), 15),
            else_=0,
        )
        diem = case(
            (skill_subq.c.skill_ratio.is_(None), fallback),
            else_=skill_subq.c.skill_ratio * 15,
        )
        return diem, skill_subq

    # ── Dedup + log + send ──────────────────────────────────────────

    async def log_and_send(
        self,
        user: User,
        jobs: list[MatchedJob],
        chat_id: int | None,
        send_fn,
        source: str | None = None,
        email_enabled: bool = False,
    ) -> int:
        """Log new alerts to DB and send via telegram. Returns count of new jobs.

        `source` = cai gi kich hoat lan gui nay ("background_loop", "admin_manual",
        "cron_webhook", ...). PHAI ghi vao MOI dong: trang admin dispatch-history
        va dispatch-stats gom nhom theo cot nay. Truoc day ham nay khong nhan tham
        so do trong khi nhanh email o job_alert.py co truyen, nen tren DB that
        57/59 dong website va 6/7 dong telegram co source = NULL — admin khong
        biet gi ve nguon goc cua 63% so alert da gui.
        """
        # Khong co kenh gui nao thi KHONG duoc ghi gi ca (JA-52).
        #
        # `dispatch_alerts` dung `outerjoin` voi TelegramConnection nen user
        # chua noi Telegram van lot vao vong lap. Ban cu ghi dong `website` vo
        # dieu kien, tuc la moi slot (~8 lan/ngay) he thong "dot" hang loat job
        # vao alert_logs cho nguoi chua he duoc bao gi. Dang ky hom nay, mot
        # tuan sau moi noi bot -> `get_already_alerted_ids` loai sach hang tram
        # job da tich luy, ho chi nhan duoc tin dang MOI tu luc noi tro di. Mat
        # het cac match tot nhat, va khong co gi trong UI cho biet dieu do da
        # xay ra.
        if not chat_id and not email_enabled:
            logger.info(
                "User %s chua co kenh gui nao (telegram/email) — bo qua, khong ghi alert_logs",
                user.id,
            )
            return 0

        alerted = await self.get_already_alerted_ids(user.id)
        new_jobs = [j for j in jobs if (j.source, j.source_job_id) not in alerted]

        if not new_jobs:
            return 0

        # Ghi dau moc dedup TRUOC khi gui: gui truoc roi ghi sau thi mot lan
        # crash o giua se gui lai y het o slot ke tiep.
        for j in new_jobs:
            self.db.add(AlertLog(
                user_id=user.id,
                job_source=j.source,
                source_job_id=j.source_job_id,
                channel=DEDUP_CHANNEL,
                source=source,
            ))
        await self.db.flush()

        if chat_id:
            # Gui theo TUNG KHOI va ghi status rieng cho tung khoi: mot khoi
            # hong khong duoc keo cac job da gui thanh cong o khoi khac thanh
            # 'failed', va nguoc lai.
            for msg, nhom in _format_job_messages(new_jobs):
                try:
                    await send_fn(chat_id, msg)
                    status, err = "sent", None
                except Exception as exc:
                    # KHONG duoc nuot that bai roi di tiep. Cac dong 'website' o
                    # tren DA duoc ghi, tuc la nhung job nay da bi danh dau la
                    # da-alert — lan chay sau `get_already_alerted_ids` se loai
                    # chung ra VINH VIEN. Neu khong ghi lai that bai o day thi
                    # push Telegram mat han ma khong de lai dau vet, va co che
                    # retry (admin.py) khong the tim thay de gui lai. Do la ly do
                    # 100/100 dong trong DB that deu status='sent' va
                    # retry_count=0: khong phai vi hoan hao, ma vi that bai chua
                    # bao gio duoc ghi.
                    logger.exception("Telegram send failed for user %s", user.id)
                    status, err = "failed", str(exc)[:500]

                for j in nhom:
                    self.db.add(AlertLog(
                        user_id=user.id,
                        job_source=j.source,
                        source_job_id=j.source_job_id,
                        channel="telegram",
                        status=status,
                        error_message=err,
                        source=source,
                    ))

        return len(new_jobs)


# ─── Message formatting ────────────────────────────────────────────

SOURCE_LABEL: dict[str, str] = {
    "vietnamworks": "VietnamWorks",
    "itviec": "ITviec",
    # linkedin la crawler thu ba dang chay (~64% kho job) nhung truoc day khong
    # co trong bang nay -> tin hien nhan tho "Xem trên linkedin" (JA-E1).
    "linkedin": "LinkedIn",
}

FALLBACK_URL: dict[str, str] = {
    "vietnamworks": "https://www.vietnamworks.com",
    "itviec": "https://itviec.com",
    "linkedin": "https://www.linkedin.com/jobs",
}

# Telegram gioi han 4096 don vi ma UTF-16 moi tin. Chua toi han muc de con cho
# cho header/footer va cho phan phinh ra sau khi escape HTML.
TELEGRAM_MAX_LEN = 4096
CHUNK_BUDGET = 3500

_ALERT_HEADER = "\U0001f4cb <b>TalentPuse Alert</b>"
_ALERT_FOOTER = (
    "\n✏️ Cập nhật hồ sơ tại <b>talentpuse.io.vn/profile</b> để nhận alert chính xác hơn."
)


def _do_dai_utf16(s: str) -> int:
    """Do do dai theo don vi ma UTF-16 — dung don vi Telegram dem.

    `len()` cua Python dem code point, nen emoji ngoai BMP (moi entry co vai
    cai) bi dem thieu mot nua. Do bang `len()` roi ket luan "chua cham gioi
    han" chinh la cach vuot gioi han ma khong biet.
    """
    return len(s.encode("utf-16-le")) // 2


def _esc(v: str | None) -> str:
    """Escape du lieu crawl truoc khi nhet vao HTML cua Telegram (JA-07).

    Tieu de kieu `R&D Engineer (C++/C#)` hay cong ty `Tuyen dung <Urgent>` lam
    Telegram tra 400 `can't parse entities` va tu choi CA BATCH. `quote=False`
    vi day la noi dung text, khong nam trong attribute.
    """
    return html.escape(v or "", quote=False)


def _build_job_url(job: MatchedJob) -> str:
    """URL cua job, hoac chuoi rong neu khong co dich den dang tin cay.

    Truoc day nguon khong biet + thieu `source_url` -> tra ve trang chu
    VietnamWorks: mot dich den SAI duoc trinh bay nhu link binh thuong. Tha
    khong co link con hon dan user di nham cho (JA-E1).
    """
    url = job.source_url or FALLBACK_URL.get(job.source, "")
    if not url.startswith(("http://", "https://")):
        return ""
    return url


def _format_entry(i: int, j: MatchedJob) -> str:
    title = _esc(j.title) or "Không rõ"
    company = _esc(j.company_name) or "Không rõ"
    city = _esc(j.city_raw_vi or j.city_canonical)
    level = _esc(j.job_level)
    address = _esc(j.address)
    salary = j.salary_m
    source_label = _esc(SOURCE_LABEL.get(j.source, j.source))
    url = _build_job_url(j)

    score_text = f"  ·  ⭐ {j.score:.0f}%" if j.score else ""

    entry = f"<b>{i}. {title}</b>"
    entry += f"\n   \U0001f3e2 {company}"
    if city:
        entry += f"  ·  \U0001f4cd {city}"
    if address:
        entry += f"\n   \U0001f4cd {address}"
    if level:
        entry += f"\n   \U0001f4ca {level}"
    if salary:
        entry += f"  ·  \U0001f4b0 ~{salary:.0f} triệu/tháng"
    entry += score_text
    if url:
        # quote=True o day: chuoi nam TRONG attribute href, mot dau " chua
        # escape se thoat ra khoi attribute va chen markup tuy y.
        entry += f'\n   \U0001f517 <a href="{html.escape(url, quote=True)}">Xem trên {source_label}</a>'
    return entry


def _format_job_messages(jobs: list[MatchedJob]) -> list[tuple[str, list[MatchedJob]]]:
    """Chia danh sach job thanh nhieu tin, moi tin duoi gioi han Telegram.

    Tra ve (noi_dung, cac_job_trong_tin_do) de `log_and_send` ghi status THEO
    TUNG KHOI: khoi 1 gui duoc ma khoi 2 hong thi chi job cua khoi 2 la
    'failed'.

    Vi sao can: nhanh student dung `STUDENT_ALERT_LIMIT = 50`, tuc ~3 lan gioi
    han 4096 ky tu -> Telegram tra 400 `message is too long` -> cong voi JA-03
    thi ca 50 job bi danh dau da-gui va bien mat vinh vien. Nhanh thuong dung
    `ALERT_LIMIT = 3` nen khong bao gio cham gioi han — them mot ly do nua
    khien loi nay vo hinh voi nguoi dung binh thuong.
    """
    if not jobs:
        return []

    tong = len(jobs)
    header = f"{_ALERT_HEADER}\nTìm thấy <b>{tong}</b> việc làm mới phù hợp với bạn.\n"

    khoi: list[tuple[str, list[MatchedJob]]] = []
    cur_entries: list[str] = []
    cur_jobs: list[MatchedJob] = []

    for i, j in enumerate(jobs, 1):
        entry = _format_entry(i, j)
        # Mot entry don le van co the vuot ngan sach (dia chi rat dai). Cat bot
        # con hon de Telegram tu choi ca khoi.
        if _do_dai_utf16(entry) > CHUNK_BUDGET:
            entry = entry[: CHUNK_BUDGET // 2] + "…"

        thu = "\n\n".join([header, *cur_entries, entry, _ALERT_FOOTER])
        if cur_jobs and _do_dai_utf16(thu) > CHUNK_BUDGET:
            khoi.append(("\n\n".join([header, *cur_entries]), list(cur_jobs)))
            cur_entries, cur_jobs = [], []

        cur_entries.append(entry)
        cur_jobs.append(j)

    if cur_jobs:
        khoi.append(("\n\n".join([header, *cur_entries]), list(cur_jobs)))

    # Footer chi gan vao tin cuoi: lap lai o moi tin chi lam nhieu.
    noi_dung, nhom = khoi[-1]
    khoi[-1] = (f"{noi_dung}\n\n{_ALERT_FOOTER}", nhom)
    return khoi


def _format_job_message(jobs: list[MatchedJob]) -> str:
    """Giu lai cho cac goi/test cu mong doi MOT chuoi duy nhat.

    Duong gui that su dung `_format_job_messages` de con chia khoi.
    """
    return "\n\n".join(noi_dung for noi_dung, _ in _format_job_messages(jobs))
