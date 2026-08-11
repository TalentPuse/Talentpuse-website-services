"""JA-06 · JA-09 · JA-14 · JA-28 — cac lo hong khien ca mot phan khuc user
khong bao gio nhan duoc alert.

Diem chung: khong lam sap gi ca, khong log loi, CI van xanh — nen chung song
duoc rat lau. Chi nhin tu phia nguoi dung moi thay: "toi dang ky roi ma chua
bao gio nhan duoc gi".
"""
from __future__ import annotations

import re
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.models.user import User
from app.services.job_matcher import JobMatcher


def _sql_pg(stmt) -> str:
    """Compile theo dialect PostgreSQL, khong phai dialect mac dinh.

    `str(stmt)` dung dialect chung, va dialect chung IM LANG BO `DISTINCT ON`
    (SQLAlchemy chi canh bao deprecation). Kiem tren chuoi do se luon bao
    "khong co DISTINCT ON" ke ca khi code hoan toan dung — hoac te hon, luon
    bao "co" khi kiem thu khac. Phai compile dung dialect that chay tren
    production.
    """
    return str(stmt.compile(dialect=postgresql.dialect()))


def _fake_db(captured: dict):
    class FakeDB:
        async def execute(self, sql, params=None):
            compiled = sql.compile(dialect=postgresql.dialect())
            captured.setdefault("sqls", []).append(str(compiled))
            # Gia tri nhu ten thanh pho di vao dang bind param, khong nam trong
            # chuoi SQL — phai soi rieng.
            captured.setdefault("params", []).append(dict(compiled.params))

            class R:
                def all(self):
                    return []

            return R()

        def add(self, obj):
            pass

        async def flush(self):
            pass

    return FakeDB()


def _user(**kwargs) -> User:
    u = MagicMock(spec=User)
    u.id = "00000000-0000-0000-0000-000000000001"
    u.skills = []
    u.desired_titles = []
    u.preferred_cities = []
    u.desired_salary_min = None
    u.experience_level = None
    for k, v in kwargs.items():
        setattr(u, k, v)
    return u


# ─── JA-06 + JA-28: dedup bang snapshot ────────────────────────────


@pytest.mark.asyncio
async def test_query_student_khu_trung_snapshot():
    """`fct_jobs_daily` la bang SNAPSHOT THEO NGAY, khong phai danh sach job.

    Mot tin co nhieu dong `is_active=true`, moi `snapshot_date` mot dong.
    Nhanh scored co `DISTINCT ON`, nhanh student thi khong — nen `find_jobs`
    tra ve cung mot job 3 lan, `log_and_send` add 3 dong AlertLog giong het
    nhau, `flush()` nem UniqueViolation, `job_alert` rollback. Trang thai
    khong doi nen LAN DISPATCH NAO CUNG FAIL Y HET: sinh vien khong bao gio
    nhan duoc gi, mai mai.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(_user(experience_level="student", desired_titles=["Data"]))

    sql = captured["sqls"][-1]
    assert "DISTINCT ON" in sql, "nhanh student van tra ve nhieu dong snapshot cho mot job"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "user_kwargs",
    [
        {"experience_level": "student", "desired_titles": ["Data"]},
        {"experience_level": "experienced", "desired_titles": ["Data"], "skills": ["python"]},
    ],
    ids=["student", "scored"],
)
async def test_distinct_on_chon_snapshot_moi_nhat(user_kwargs):
    """`DISTINCT ON` khong co `ORDER BY` khop thi Postgres chon dong TUY Y.

    Hau qua: diem so khong xac dinh giua cac lan chay, va mot snapshot cu (tin
    da het han) van co the duoc alert (JA-28).
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(_user(**user_kwargs))

    sql = captured["sqls"][-1]
    assert "DISTINCT ON" in sql

    # ORDER BY phai bat dau bang dung cac cot cua DISTINCT ON roi den
    # snapshot_date DESC — day la dieu kien de Postgres chon dong moi nhat.
    assert re.search(
        r"ORDER BY.*?source.*?source_job_id.*?snapshot_date DESC",
        sql,
        re.IGNORECASE | re.DOTALL,
    ), f"DISTINCT ON khong co ORDER BY khop -> snapshot thang la ngau nhien:\n{sql}"


# ─── JA-09: city score khong bao gio khop ──────────────────────────


@pytest.mark.asyncio
async def test_city_score_dung_ma_canonical_cua_warehouse():
    """User chon pill "Hồ Chí Minh"; warehouse luu `city_canonical = 'HCMC'`.

    So thang chuoi hien thi voi ma canonical thi SAI 100% SO DONG: job Ha Noi
    va job Sai Gon co diem y het nhau, 25/100 diem cham luon bang 0, top-3 bo
    qua hoan toan dia diem.

    `recommendations.py` va `job_fit/profile.py` deu da co `_canon_cities` —
    rieng matcher cua alert quen dung.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(
        _user(experience_level="experienced", skills=["python"], preferred_cities=["Hồ Chí Minh"])
    )

    gia_tri = repr(captured["params"][-1])
    assert "HCMC" in gia_tri, f"chua canonical hoa ten thanh pho: {gia_tri}"
    assert "Hồ Chí Minh" not in gia_tri, "van so chuoi hien thi voi ma canonical"


@pytest.mark.asyncio
async def test_thanh_pho_khong_nhan_ra_khong_lam_hong_query():
    """Ten thanh pho la (vd nguoi dung tu nhap) chi nen lam mat diem city.

    Khong duoc bien thanh mot predicate loai het job — tha cham diem theo cac
    tieu chi con lai.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    jobs = await matcher.find_jobs(
        _user(experience_level="experienced", skills=["python"], preferred_cities=["Xyz"])
    )

    assert jobs == []
    assert captured["sqls"], "query van phai chay"


# ─── JA-14: dieu kien chon user loai nham ca phan khuc ─────────────


def test_dieu_kien_chon_user_khong_loai_bo_student_chi_co_title():
    """`array_length(skills,1) > 0` loai student ra khoi vong dispatch.

    Nhanh student CHI doc `desired_titles` — no khong dung `skills` de tim
    viec. Nhung dieu kien SELECT o `dispatch_alerts` lai doi phai co skills,
    nen student khai title day du ma chua nhap skills thi `find_jobs` KHONG
    BAO GIO duoc goi toi. Ho khong nam trong bat ky log nao vi chua tung buoc
    vao vong lap.
    """
    import inspect

    from app.services import job_alert

    src = inspect.getsource(job_alert._dispatch_alerts_locked)

    assert "desired_titles" in src, (
        "dieu kien chon user van chi xet skills -> student chi khai title bi bo qua"
    )


# ─── JA-16 + JA-E2: cham diem skill ────────────────────────────────


@pytest.mark.asyncio
async def test_job_khong_co_du_lieu_skill_van_cham_diem_duoc():
    """`silver_skill_long` co coverage 0% cho LinkedIn (~64% kho job).

    Voi `coalesce(..., 0)` cu, user chi khai skills se cham 0 diem cho MOI job
    LinkedIn -> `WHERE score > 0` loai sach -> phan lon kho viec vo hinh voi
    ho (JA-16).

    Kiem theo cau truc SQL chu khong theo ket qua: chay that can du lieu
    LinkedIn co that trong warehouse, ma diem mau do thay doi theo lan crawl.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(_user(experience_level="experienced", skills=["python"]))

    sql = captured["sqls"][-1]
    assert "sk.skill_ratio IS NULL" in sql, (
        f"khong phan biet 'khong khop skill' voi 'khong co du lieu skill':\n{sql}"
    )
    # JA-60: nguon thay the la regex word-boundary qua `~*`, khong con `%...%`
    # ILIKE (skill 'ai' match nham 'KHAI'/'Sustainability').
    assert "title ~*" in sql, "khong co nguon thay the cho job thieu du lieu skill"


@pytest.mark.asyncio
async def test_ty_le_skill_dem_theo_skill_khac_nhau():
    """Skill bi tag trung trong du lieu crawl khong duoc bop meo ty le (JA-E2)."""
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(_user(experience_level="experienced", skills=["python"]))

    sql = captured["sqls"][-1]
    assert "count(distinct" in sql.lower(), f"van dem dong tho, khong DISTINCT:\n{sql}"


# ─── JA-15 / JA-27: khong ghim connection qua lan goi mang ─────────


@pytest.mark.asyncio
async def test_commit_truoc_khi_goi_mang():
    """`log_and_send` phai COMMIT truoc khi gui, khong phai `flush`.

    Transaction mo = connection bi ghim. Pool chi co 5, `max_overflow=0`,
    `pool_timeout=10`, trong khi moi user ton toi 10s (Telegram) + 15s
    (Resend). Vai chuc user la moi request dashboard chet voi
    `QueuePool limit reached` (JA-15).

    Kem theo JA-27: voi `flush`, mot loi bat ky sau do lam rollback xoa sach
    dau moc dedup TRONG KHI tin da bay di — slot sau gui lai y het.

    Kiem THU TU THAT bang cach ghi lai cac su kien, chu khong doc source code:
    cau hoi la "commit co xay ra TRUOC lan gui dau tien khong".
    """
    from app.services.job_matcher import JobMatcher, MatchedJob

    su_kien: list[str] = []

    class DB:
        async def execute(self, sql, params=None):
            class R:
                def all(self_inner):
                    return []
            return R()

        def add(self, obj):
            pass

        async def flush(self):
            su_kien.append("flush")

        async def commit(self):
            su_kien.append("commit")

    async def send_fn(chat_id, msg):
        su_kien.append("gui")

    jobs = [MatchedJob(source="vietnamworks", source_job_id="1", title="Dev")]
    await JobMatcher(DB()).log_and_send(_user(), jobs, chat_id=123, send_fn=send_fn)

    assert "gui" in su_kien
    assert su_kien.index("commit") < su_kien.index("gui"), (
        f"van giu transaction mo trong luc goi mang: {su_kien}"
    )


# ─── JA-24: retry lay lai dung job ─────────────────────────────────


def test_retry_lay_job_theo_nguon_va_snapshot_moi_nhat():
    """Truy van lay lai job phai xet nguon, snapshot moi nhat, va con hieu luc.

    Ban cu: `WHERE source_job_id = :id LIMIT 1` — khong loc `source` nen co
    the keo ve job cua nguon khac trung id; khong `ORDER BY` nen lay mot
    snapshot bat ky (luong/cap bac co the la ban cu); khong loc `is_active`
    nen gui lai ca tin da het han (JA-24).
    """
    import inspect

    from app.api import admin

    src = inspect.getsource(admin._get_matched_job_details)

    assert "DISTINCT ON" in src
    assert "snapshot_date DESC" in src
    assert "f.is_active" in src
    assert "job_source" in src


def test_retry_gui_mot_email_moi_nguoi():
    """Gom theo NGUOI, khong lap theo DONG (JA-23).

    Ban cu: moi dong fail = 1 query user + 1 query job + 1 lan goi Resend,
    tuan tu. 300 dong ≈ 600 query + 300 lan goi mang (~5 phut) chay noi tuyen
    trong request. Va mot user co 3 job fail nhan 3 EMAIL RIENG.
    """
    import inspect

    from app.api import admin

    src = inspect.getsource(admin.retry_failed_alerts)

    assert "theo_user" in src, "van lap theo tung dong alert_log"
    assert "User.id.in_(" in src, "van query user tung dong (N+1)"
