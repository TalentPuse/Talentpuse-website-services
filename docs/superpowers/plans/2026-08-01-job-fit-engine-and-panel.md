# Job Fit — Engine, Panel chi tiết, Rerank — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng bấm vào một card job (ở `/jobs` hoặc `/applications`) và thấy JD đầy đủ, thông tin công ty, cùng một điểm phù hợp có giải thích được — rồi sắp xếp lại danh sách theo điểm đó.

**Architecture:** Một engine chấm điểm duy nhất (`app/services/job_fit/`), thuần SQL + Python, không LLM. Năm tiêu chí được mô hình hoá thành các đối tượng `Criterion` cùng giao diện, nên điểm số, trọng số và câu giải thích của mỗi tiêu chí nằm cùng một chỗ. Engine nhận một **danh sách job cụ thể** (không bao giờ cả kho) và trả về điểm + lý do. Ba mặt tiền — panel chi tiết, rerank, "nên focus job nào" — đều chỉ tiêu thụ lại engine đó.

**Tech Stack:** FastAPI, SQLAlchemy async (raw `text()` cho kho dbt), Pydantic v2, pytest; Next.js 14 App Router, TypeScript, Radix (`components/ui/sheet.tsx` đã có), Tailwind, Jest + Testing Library.

**Nguồn:** `docs/superpowers/specs/2026-08-01-job-fit-suite-design.md`

**Phạm vi plan này:** spec §12 việc **1–3**. Việc 4–7 (Insight viết lại, backfill + nhắc follow-up, soạn thư, trang công ty) sẽ có plan riêng — chúng phụ thuộc engine ở đây, và gộp cả 7 vào một plan thì các bước cuối chỉ là phỏng đoán chưa kiểm chứng.

---

## Global Constraints

Mọi task đều ngầm bao gồm các ràng buộc này.

- **KHÔNG dùng LLM ở bất kỳ đâu trong plan này.** Điểm số phải tái lập được: cùng đầu vào ra cùng kết quả.
- **KHÔNG BAO GIỜ chấm điểm cả kho trong một request.** Quét biên từ tốn ~250ms/kỹ năng/6432 tin. Luôn truyền vào danh sách job cụ thể (≤ 50 tin cho một trang, ≤ 300 cho shortlist rerank).
- **Khớp kỹ năng phải dùng biên từ, KHÔNG dùng `ILIKE '%x%'`.** Đã đo: `ILIKE '%ai%'` khớp 5974/6432 tin (93%) vì ăn trong "email"/"training"/"maintain".
- **Biên từ phải gắn có điều kiện:** chỉ thêm `\m` khi kỹ năng bắt đầu bằng ký tự chữ, chỉ thêm `\M` khi kết thúc bằng ký tự chữ. Đã đo: gắn vô điều kiện thì `c++`, `c#`, `f#`, `.net` **không bao giờ khớp** — regex vẫn hợp lệ nên không nổ lỗi, chỉ lặng lẽ trả `false` mãi mãi.
- **Phải escape metachar regex** trong tên kỹ năng: `([.^$*+?()\[\]{}|\\-])` → `\\\1`. Kỹ năng thật chứa `/`, `+`, `.`, `-`, `#`.
- **Tín hiệu kỹ năng phải là `structured OR text`.** `silver_skill_long` chỉ phủ 33% và lệch hẳn theo nguồn (LinkedIn 0/4130). Chỉ dùng bảng đó sẽ dìm 64% kho vì lỗ hổng ETL.
- **Hồ sơ rỗng trả `null`, KHÔNG trả 0.** Bịa số cho hồ sơ trống dạy người dùng rằng điểm này vô nghĩa.
- **`job_description_text` là dữ liệu bên thứ ba.** TUYỆT ĐỐI không `dangerouslySetInnerHTML`. Render văn bản thuần, ngắt dòng bằng CSS.
- **Điểm hiển thị dạng `%` kèm câu giải thích** (người dùng đã chọn).
- Comment tiếng Việt **không dấu** cho phần giải thích lý do/bug (theo quy ước đang dùng ở `application_service.py`, `cv_tailor/`).
- Type hint kiểu PEP 604 (`str | None`) + `from __future__ import annotations`.
- Backend chạy test: `docker exec tp-backend sh -c 'cd /app && python -m pytest <path> -q'`. Source **không** được mount vào container — phải `docker cp` file vào trước khi chạy.
- Frontend chạy test: `cd apps/frontend && npm test`.
- Test thủ công trên `http://[::1]/` — **KHÔNG dùng cổng 80**, đó là tunnel VS Code trỏ vào production.

---

## File Structure

### Backend — package mới `app/services/job_fit/`

Tách thành thư mục (không phải một file) theo đúng tiêu chí repo đang dùng: `cv_tailor/` tách 445 dòng thành 7 file vì mỗi file là **một tầng trách nhiệm khác loại**. Ở đây cũng vậy — chuẩn hoá hồ sơ, truy vấn kho, chấm từng tiêu chí, và tổng hợp là bốn việc khác nhau, test được độc lập.

| File | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `job_fit/__init__.py` | API công khai: `score_jobs`, `Profile`, `FitScore` | các module dưới |
| `job_fit/profile.py` | `Profile` (frozen dataclass) + `build_profile(user)` — lọc nhiễu, chuẩn hoá thành phố, đổi chỗ lương min>max | `recommendations._CITY_CANON` |
| `job_fit/facts.py` | `JobFacts` dataclass + `fetch_facts(db, skills, keys)` — **toàn bộ SQL nằm ở đây** | `sqlalchemy` |
| `job_fit/criteria.py` | `Criterion` protocol + 5 lớp cài đặt. Trọng số, cách tính, câu giải thích của mỗi tiêu chí nằm cùng chỗ | `profile`, `facts` |
| `job_fit/scoring.py` | `FitScore` dataclass + `combine(profile, facts)` — chuẩn hoá lại theo tiêu chí có dữ liệu | `criteria` |

**Vì sao `Criterion` là class còn phần còn lại là hàm:** repo gần như thuần hàm (~148 hàm cấp module, đúng 1 class OOP thật là `JobMatcher` — và nó là class chỉ vì giữ `self.db`). Nhét class vào chỗ không có state là đi ngược repo. Nhưng 5 tiêu chí thì khác: mỗi cái có **trọng số + cách tính + câu giải thích** dính liền nhau. Gom vào một giao diện chung thì thêm tiêu chí thứ 6 chỉ là thêm một lớp, thay vì sửa một hàm `if/else` phình to và nhớ cập nhật ba nơi. Đó là OOP có lý do.

### Backend — file sửa

| File | Thay đổi |
|---|---|
| `app/schemas/jobs.py` | thêm `JobMatch`, `JobDetail` |
| `app/api/jobs.py` | thêm `GET /api/jobs/{source}/{source_job_id}`; thêm `sort` vào `GET /api/jobs` |
| `app/services/job_matcher.py` | **không đổi hành vi** — chỉ để `job_fit/criteria.py` dùng lại `LEVEL_MAP` thay vì nhân bản |

### Backend — file XOÁ

| File | Lý do |
|---|---|
| `app/services/job_match.py` | Bản nháp chưa commit, chưa ai import. Bị thay bởi package `job_fit/`. Tên chỉ khác `job_matcher.py` một chữ cái trong khi làm việc khác hẳn (`job_matcher` lọc nhị phân để **gửi alert**; `job_fit` chấm thang điểm để **hiển thị**). |

### Frontend — file mới

| File | Trách nhiệm |
|---|---|
| `components/jobs/JobDetailSheet.tsx` | Panel trượt, dùng `components/ui/sheet.tsx` có sẵn. Tự nạp dữ liệu theo `(source, sourceJobId)` |
| `components/jobs/JobMatchScore.tsx` | Điểm `%` + danh sách lý do + kỹ năng thiếu |
| `components/jobs/JobDescriptionText.tsx` | Render JD **văn bản thuần** — nơi duy nhất chạm vào dữ liệu bên thứ ba |
| `components/jobs/__tests__/job-detail-sheet.test.tsx` | Test hành vi |
| `components/jobs/__tests__/job-match-score.test.tsx` | Test hành vi |

### Frontend — file sửa

| File | Thay đổi |
|---|---|
| `lib/api.ts` | `jobsApi.detail(source, id)`; type `JobDetail`, `JobMatch`; `sort` trong `jobsApi.list` |
| `app/jobs/page.tsx` | Bấm card → mở panel; đồng bộ `?job=` lên URL; thêm nút sắp xếp theo độ phù hợp |
| `components/applications/ApplicationCard.tsx` | Bấm card → mở panel (bỏ qua khi `source_job_id` NULL) |
| `app/applications/page.tsx` | Chứa panel + trạng thái mở/đóng |

---

## Task 1: Profile — chuẩn hoá hồ sơ người dùng

**Files:**
- Create: `apps/backend/app/services/job_fit/__init__.py`
- Create: `apps/backend/app/services/job_fit/profile.py`
- Test: `apps/backend/tests/test_job_fit/test_profile.py`

**Interfaces:**
- Consumes: `app.models.user.User`, `app.services.recommendations._CITY_CANON`
- Produces:
  - `Profile` — frozen dataclass, thuộc tính: `skills: list[str]`, `titles: list[str]`, `cities: list[str]`, `salary_min: int | None`, `salary_max: int | None`, `level: str | None`; property `is_empty: bool`
  - `build_profile(user: User) -> Profile`
  - `MAX_SKILLS_SCANNED: int = 30`

- [ ] **Step 1: Viết test đỏ**

Tạo `apps/backend/tests/test_job_fit/__init__.py` (file rỗng) và `apps/backend/tests/test_job_fit/test_profile.py`:

```python
"""Test chuan hoa ho so cho engine cham diem."""
from __future__ import annotations

from app.models.user import User
from app.services.job_fit.profile import MAX_SKILLS_SCANNED, build_profile


def _user(**kw) -> User:
    base = dict(
        skills=[], desired_titles=[], preferred_cities=[],
        desired_salary_min=None, desired_salary_max=None, experience_level=None,
    )
    base.update(kw)
    return User(**base)


def test_ho_so_rong_thi_is_empty():
    """Khong co tieu chi nao => KHONG cham diem duoc. Tra diem cho ho so trong la
    bia so, va no day nguoi dung den ket luan rang diem nay vo nghia."""
    assert build_profile(_user()).is_empty is True


def test_chi_can_mot_tieu_chi_la_khong_rong():
    assert build_profile(_user(preferred_cities=["HCMC"])).is_empty is False


def test_loai_ky_nang_nhieu():
    """'ai' khop 42% tong so tin ngay ca khi da dung bien tu — do la nhieu, khong
    phai tin hieu. 'airflow' thi giu, dung cat nham theo tien to."""
    p = build_profile(_user(skills=["ai", "data", "english", "airflow", "python"]))
    assert "ai" not in p.skills
    assert "data" not in p.skills
    assert "english" not in p.skills
    assert set(p.skills) == {"airflow", "python"}


def test_chuan_hoa_chu_thuong_va_bo_trung():
    p = build_profile(_user(skills=["Python", "python", "  PYTHON  "]))
    assert p.skills == ["python"]


def test_chan_so_ky_nang_va_uu_tien_cai_dai():
    """Quet text ton ~250ms/ky nang/6432 tin nen phai chan. Khi cat thi giu cai
    DAI hon vi no dac trung hon: 'machine learning' phan biet tot hon 'go'."""
    skills = [f"skill{i}" for i in range(50)] + ["machine learning engineering"]
    p = build_profile(_user(skills=skills))
    assert len(p.skills) == MAX_SKILLS_SCANNED
    assert "machine learning engineering" in p.skills


def test_chuan_hoa_thanh_pho_ve_tu_vung_kho():
    p = build_profile(_user(preferred_cities=["Hồ Chí Minh", "ha noi", "khong-ton-tai"]))
    assert p.cities == ["HCMC", "Hanoi"]


def test_doi_cho_khi_luong_min_lon_hon_max():
    """Du lieu that co ca ca nay (qa-bob@local.dev: min=90000000, max=1000).
    Doi cho thay vi bo qua, de khong am tham danh rot tieu chi luong."""
    p = build_profile(_user(desired_salary_min=90_000_000, desired_salary_max=1000))
    assert p.salary_min == 1000
    assert p.salary_max == 90_000_000
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
docker exec tp-backend sh -c 'mkdir -p /app/tests/test_job_fit'
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_profile.py -q'
```
Kỳ vọng: FAIL với `ModuleNotFoundError: No module named 'app.services.job_fit'`

- [ ] **Step 3: Cài đặt**

`apps/backend/app/services/job_fit/__init__.py`:

```python
"""Cham diem do phu hop giua ho so nguoi dung va tin tuyen dung.

Xem docs/superpowers/specs/2026-08-01-job-fit-suite-design.md muc 2 de biet cac
phep do quyet dinh thiet ke nay.
"""
from app.services.job_fit.profile import Profile, build_profile

__all__ = ["Profile", "build_profile"]
```

`apps/backend/app/services/job_fit/profile.py`:

```python
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
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
docker cp apps/backend/app/services/job_fit tp-backend:/app/app/services/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_profile.py -q'
```
Kỳ vọng: 7 passed

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/services/job_fit/ apps/backend/tests/test_job_fit/
git commit -m "feat(job-fit): chuan hoa ho so nguoi dung cho engine cham diem"
```

---

## Task 2: Facts — truy vấn kho, khớp kỹ năng theo biên từ

**Files:**
- Create: `apps/backend/app/services/job_fit/facts.py`
- Test: `apps/backend/tests/test_job_fit/test_facts_sql.py`

**Interfaces:**
- Consumes: `Profile` (Task 1)
- Produces:
  - `JobFacts` dataclass: `source, source_job_id, title, company_name, city, job_level, job_category, salary_min, salary_max, salary_avg, matched_skills: list[str], job_skills: list[str], has_text: bool`
  - `async fetch_facts(db, skills: list[str], keys: list[tuple[str, str]]) -> list[JobFacts]`
  - `SKILL_REGEX_SQL: str` — mảnh SQL sinh regex biên từ, export riêng để test được

- [ ] **Step 1: Viết test đỏ cho phần regex**

`apps/backend/tests/test_job_fit/test_facts_sql.py`:

```python
"""Kiem chung bieu thuc regex khop ky nang CHAY THAT tren Postgres.

Day la test tich hop co chu dich: cai de sai o day khong phai logic Python ma la
hanh vi regex cua Postgres, va no chi lo ra khi chay that.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core import database as db_module
from app.services.job_fit.facts import SKILL_REGEX_SQL

# (ky nang, doan van, co phai khop khong)
CASES = [
    # Bien tu chan khop chuoi con — day la ly do khong dung ILIKE '%x%'
    ("ai", "Please send your email to us", False),
    ("ai", "Applied AI research team", True),
    ("sql", "Deep MySQL and PostgreSQL knowledge", False),
    ("sql", "Strong SQL skills", True),
    ("go", "Golang microservices, Google Cloud", False),
    ("go", "We write Go and Rust", True),
    # Ky nang co metachar regex — phai escape, khong duoc no loi
    ("ci/cd", "Build CI/CD pipelines with Jenkins", True),
    ("node.js", "Backend in Node.js and Express", True),
    ("node.js", "We use NodeXjs internally", False),   # '.' phai la literal
    ("vega-lite", "Charts with Vega-Lite and D3", True),
    # Ky nang co bien KHONG phai chu tu — gan bien tu vo dieu kien se KHONG BAO
    # GIO khop, va no im lang chu khong bao loi. Bon ca nay la ly do ton tai cua
    # phan CASE WHEN trong SKILL_REGEX_SQL.
    ("c++", "Strong C++ and Rust experience required", True),
    ("c++", "Experience with C and Java", False),
    ("c#", "Backend in C# and .NET", True),
    ("c#", "We use C and Go", False),
    ("f#", "We write F# on the backend", True),
    (".net", "ASP.NET Core microservices", True),
    (".net", "Building a social network platform", False),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("skill,haystack,expected", CASES)
async def test_khop_ky_nang_theo_bien_tu(skill: str, haystack: str, expected: bool):
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        got = (await db.execute(
            text(f"SELECT :hay ~* ({SKILL_REGEX_SQL.format(skill=':sk')})"),
            {"hay": haystack, "sk": skill},
        )).scalar()
    assert got is expected, f"{skill!r} vs {haystack!r}"
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_facts_sql.py -q'
```
Kỳ vọng: FAIL với `ImportError: cannot import name 'SKILL_REGEX_SQL'`

- [ ] **Step 3: Cài đặt**

`apps/backend/app/services/job_fit/facts.py`:

```python
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
    SELECT
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
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
docker cp apps/backend/app/services/job_fit tp-backend:/app/app/services/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_facts_sql.py -q'
```
Kỳ vọng: 17 passed

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/services/job_fit/facts.py apps/backend/tests/test_job_fit/test_facts_sql.py
git commit -m "feat(job-fit): truy van kho + khop ky nang theo bien tu co dieu kien"
```

---

## Task 3: Criteria — năm tiêu chí, mỗi tiêu chí một đối tượng

**Files:**
- Create: `apps/backend/app/services/job_fit/criteria.py`
- Test: `apps/backend/tests/test_job_fit/test_criteria.py`

**Interfaces:**
- Consumes: `Profile` (Task 1), `JobFacts` (Task 2), `job_matcher.LEVEL_MAP`
- Produces:
  - `CriterionResult` dataclass: `key: str`, `weight: int`, `score: float | None`, `reason: str | None`, `detail: dict`
  - `Criterion` protocol: thuộc tính `key: str`, `weight: int`; phương thức `evaluate(profile, facts) -> CriterionResult`
  - `CRITERIA: tuple[Criterion, ...]` — 5 phần tử, thứ tự cố định
  - `SKILL_SATURATION: int = 6`

- [ ] **Step 1: Viết test đỏ**

`apps/backend/tests/test_job_fit/test_criteria.py`:

```python
"""Test tung tieu chi mot. Thuan Python — khong cham DB."""
from __future__ import annotations

import pytest

from app.services.job_fit.criteria import CRITERIA, SKILL_SATURATION
from app.services.job_fit.facts import JobFacts
from app.services.job_fit.profile import Profile


def _facts(**kw) -> JobFacts:
    base = dict(
        source="linkedin", source_job_id="j1", title="Data Engineer",
        company_name="Co", city="HCMC", job_level="Mid-level", job_category="Data",
        salary_min=None, salary_max=None, salary_avg=None,
        matched_skills=[], job_skills=[], has_text=True,
    )
    base.update(kw)
    return JobFacts(**base)


def _profile(**kw) -> Profile:
    base = dict(skills=[], titles=[], cities=[], salary_min=None, salary_max=None, level=None)
    base.update(kw)
    return Profile(**base)


def _run(key: str, profile: Profile, facts: JobFacts):
    crit = next(c for c in CRITERIA if c.key == key)
    return crit.evaluate(profile, facts)


# -- skills --------------------------------------------------------

def test_skills_khong_co_ky_nang_thi_tieu_chi_khong_ap_dung():
    assert _run("skills", _profile(), _facts()).score is None


def test_skills_co_so_required_khi_tin_co_ky_nang_cau_truc():
    """Tin co ky nang cau truc => dem duoc dap ung bao nhieu phan YEU CAU.
    Day la con so nguoi dung tin duoc: 'ban co 2/4 ky nang'."""
    r = _run("skills",
             _profile(skills=["python", "sql", "react"]),
             _facts(job_skills=["python", "sql", "airflow", "dbt"],
                    matched_skills=["python", "sql"]))
    assert r.detail["basis"] == "required"
    assert r.score == pytest.approx(2 / 4)
    assert "2/4" in r.reason


def test_skills_co_so_mentioned_khi_tin_khong_co_ky_nang_cau_truc():
    """Toan bo 4130 tin LinkedIn roi vao nhanh nay. Khong duoc de chung khong co
    diem chi vi ETL chua trich ky nang cho nguon do."""
    r = _run("skills",
             _profile(skills=["python", "sql", "react"]),
             _facts(job_skills=[], matched_skills=["python", "sql"], has_text=True))
    assert r.detail["basis"] == "mentioned"
    assert r.score == pytest.approx(2 / SKILL_SATURATION)


def test_skills_bao_hoa_khong_vuot_qua_1():
    r = _run("skills",
             _profile(skills=[f"s{i}" for i in range(20)]),
             _facts(job_skills=[], matched_skills=[f"s{i}" for i in range(20)]))
    assert r.score == pytest.approx(1.0)


def test_skills_thieu_gi_chi_tra_ve_khi_biet_tin_yeu_cau_gi():
    """Tin khong co ky nang cau truc thi ta KHONG BIET no yeu cau gi — tra rong
    thay vi doan bua."""
    co = _run("skills", _profile(skills=["python"]),
              _facts(job_skills=["python", "airflow"], matched_skills=["python"]))
    assert co.detail["missing"] == ["airflow"]

    khong = _run("skills", _profile(skills=["python"]),
                 _facts(job_skills=[], matched_skills=["python"]))
    assert khong.detail["missing"] == []


# -- title ---------------------------------------------------------

def test_title_khop_toan_bo_tu():
    r = _run("title", _profile(titles=["data engineer"]), _facts(title="Senior Data Engineer"))
    assert r.score == pytest.approx(1.0)


def test_title_khop_mot_phan():
    r = _run("title", _profile(titles=["data engineer"]), _facts(title="Data Analyst"))
    assert r.score == pytest.approx(0.5)


def test_title_lay_max_tren_cac_vi_tri_mong_muon():
    r = _run("title", _profile(titles=["kien truc su", "data engineer"]),
             _facts(title="Data Engineer"))
    assert r.score == pytest.approx(1.0)


# -- city ----------------------------------------------------------

def test_city_khop_va_khong_khop():
    assert _run("city", _profile(cities=["HCMC"]), _facts(city="HCMC")).score == 1.0
    assert _run("city", _profile(cities=["HCMC"]), _facts(city="Hanoi")).score == 0.0


def test_city_tin_khong_ghi_thanh_pho_thi_tieu_chi_khong_ap_dung():
    """1077/6432 tin co city_canonical rong. Cham 0 diem cho chung la phat nguoi
    dung vi lo hong cua kho du lieu."""
    assert _run("city", _profile(cities=["HCMC"]), _facts(city=None)).score is None


# -- salary --------------------------------------------------------

def test_salary_giao_nhau_thi_tron_diem():
    r = _run("salary", _profile(salary_min=20_000_000, salary_max=30_000_000),
             _facts(salary_min=25_000_000, salary_max=35_000_000))
    assert r.score == pytest.approx(1.0)


def test_salary_tra_cao_hon_mong_muon_khong_bi_tru_diem():
    r = _run("salary", _profile(salary_min=20_000_000, salary_max=30_000_000),
             _facts(salary_min=50_000_000, salary_max=60_000_000))
    assert r.score == pytest.approx(1.0)


def test_salary_tra_thap_hon_thi_giam_dan_chu_khong_cat_ve_0():
    """Tin lech 5% khong the bi doi xu nhu tin lech 80%."""
    r = _run("salary", _profile(salary_min=20_000_000, salary_max=None),
             _facts(salary_min=19_000_000, salary_max=19_000_000))
    assert 0.9 < r.score < 1.0


def test_salary_tin_khong_ghi_luong_thi_khong_ap_dung():
    assert _run("salary", _profile(salary_min=20_000_000), _facts()).score is None


# -- level ---------------------------------------------------------

def test_level_khop_hoan_toan_va_mot_phan():
    assert _run("level", _profile(level="fresher"),
                _facts(job_level="Fresher/Entry level")).score == 1.0
    assert _run("level", _profile(level="fresher"),
                _facts(job_level="Mid-level")).score == 0.5
    assert _run("level", _profile(level="fresher"),
                _facts(job_level="Director+")).score == 0.0
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_criteria.py -q'
```
Kỳ vọng: FAIL với `ImportError: cannot import name 'CRITERIA'`

- [ ] **Step 3: Cài đặt**

`apps/backend/app/services/job_fit/criteria.py`:

```python
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
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
docker cp apps/backend/app/services/job_fit tp-backend:/app/app/services/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_criteria.py -q'
```
Kỳ vọng: 16 passed

**Lưu ý khi chạy:** `LEVEL_MAP["fresher"]` hiện là `["Fresher/Entry level", "Mid-level"]` — không chứa `Intern/Student`. Test `test_level_khop_hoan_toan_va_mot_phan` được viết đúng theo bảng đó. **Không sửa `LEVEL_MAP`** trong task này: nó đang được dùng để lọc alert thật, đổi nó là đổi hành vi gửi alert. Nếu muốn chỉnh thang cấp bậc, làm ở một commit riêng có test riêng cho alert.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/services/job_fit/criteria.py apps/backend/tests/test_job_fit/test_criteria.py
git commit -m "feat(job-fit): nam tieu chi cham diem, moi tieu chi mot doi tuong"
```

---

## Task 4: Scoring — tổng hợp và chuẩn hoá lại

**Files:**
- Create: `apps/backend/app/services/job_fit/scoring.py`
- Modify: `apps/backend/app/services/job_fit/__init__.py`
- Test: `apps/backend/tests/test_job_fit/test_scoring.py`

**Interfaces:**
- Consumes: `CRITERIA`, `CriterionResult` (Task 3), `JobFacts` (Task 2), `Profile` (Task 1)
- Produces:
  - `FitScore` dataclass: `score: int`, `reasons: list[str]`, `matched_skills: list[str]`, `missing_skills: list[str]`, `skill_basis: str`, `skills_matched: int`, `skills_total: int`, `criteria_used: list[str]`
  - `combine(profile: Profile, facts: JobFacts) -> FitScore | None`
  - `async score_jobs(db, user, keys) -> dict[tuple[str, str], FitScore]`

- [ ] **Step 1: Viết test đỏ**

`apps/backend/tests/test_job_fit/test_scoring.py`:

```python
"""Test phep tong hop diem. Thuan Python — khong cham DB."""
from __future__ import annotations

from app.services.job_fit.facts import JobFacts
from app.services.job_fit.profile import Profile
from app.services.job_fit.scoring import combine


def _facts(**kw) -> JobFacts:
    base = dict(
        source="linkedin", source_job_id="j1", title="Data Engineer",
        company_name="Co", city="HCMC", job_level="Mid-level", job_category="Data",
        salary_min=None, salary_max=None, salary_avg=None,
        matched_skills=[], job_skills=[], has_text=True,
    )
    base.update(kw)
    return JobFacts(**base)


def _profile(**kw) -> Profile:
    base = dict(skills=[], titles=[], cities=[], salary_min=None, salary_max=None, level=None)
    base.update(kw)
    return Profile(**base)


def test_ho_so_rong_tra_none_chu_khong_phai_0():
    assert combine(_profile(), _facts()) is None


def test_diem_nam_trong_khoang_0_100():
    r = combine(_profile(cities=["HCMC"]), _facts(city="HCMC"))
    assert 0 <= r.score <= 100


def test_tieu_chi_thieu_du_lieu_bi_LOAI_chu_khong_tinh_la_0():
    """Mot tin khong ghi luong khong duoc bi tru diem — dieu do chang noi gi ve
    do phu hop, no chi la lo hong cua kho du lieu. Hai tin duoi day khop y het
    nhau o moi tieu chi CO du lieu, nen phai cung diem."""
    p = _profile(cities=["HCMC"], salary_min=20_000_000)
    co_luong = combine(p, _facts(city="HCMC", salary_min=25_000_000, salary_max=30_000_000))
    khong_luong = combine(p, _facts(city="HCMC"))
    assert co_luong.score == khong_luong.score == 100
    assert "salary" in co_luong.criteria_used
    assert "salary" not in khong_luong.criteria_used


def test_criteria_used_liet_ke_dung_tieu_chi_da_dung():
    r = combine(_profile(cities=["HCMC"], level="fresher"),
                _facts(city="HCMC", job_level="Mid-level"))
    assert r.criteria_used == ["city", "level"]


def test_reasons_bo_qua_tieu_chi_khong_co_cau_giai_thich():
    r = combine(_profile(cities=["HCMC"]), _facts(city="Hanoi"))
    assert r.reasons == []


def test_thong_tin_ky_nang_duoc_nang_len_muc_tren_cung():
    """UI can doc thang, khong phai dao vao detail cua tung tieu chi."""
    r = combine(_profile(skills=["python", "sql"]),
                _facts(job_skills=["python", "airflow"], matched_skills=["python"]))
    assert r.skill_basis == "required"
    assert r.skills_matched == 1
    assert r.skills_total == 2
    assert r.missing_skills == ["airflow"]


def test_trong_so_ky_nang_at_hon_thanh_pho():
    """skills=45 vs city=15: tin khop het ky nang nhung sai thanh pho phai hon
    han tin khop thanh pho nhung truot het ky nang."""
    p = _profile(skills=["python", "sql"], cities=["HCMC"])
    manh_ky_nang = combine(p, _facts(city="Hanoi", job_skills=["python", "sql"],
                                     matched_skills=["python", "sql"]))
    manh_thanh_pho = combine(p, _facts(city="HCMC", job_skills=["python", "sql"],
                                       matched_skills=[]))
    assert manh_ky_nang.score > manh_thanh_pho.score
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_scoring.py -q'
```
Kỳ vọng: FAIL với `ModuleNotFoundError: No module named 'app.services.job_fit.scoring'`

- [ ] **Step 3: Cài đặt**

`apps/backend/app/services/job_fit/scoring.py`:

```python
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
```

Cập nhật `apps/backend/app/services/job_fit/__init__.py`:

```python
"""Cham diem do phu hop giua ho so nguoi dung va tin tuyen dung.

Xem docs/superpowers/specs/2026-08-01-job-fit-suite-design.md muc 2 de biet cac
phep do quyet dinh thiet ke nay.
"""
from app.services.job_fit.facts import JobFacts, fetch_facts
from app.services.job_fit.profile import Profile, build_profile
from app.services.job_fit.scoring import FitScore, combine, score_jobs

__all__ = [
    "FitScore", "JobFacts", "Profile",
    "build_profile", "combine", "fetch_facts", "score_jobs",
]
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
docker cp apps/backend/app/services/job_fit tp-backend:/app/app/services/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/ -q'
```
Kỳ vọng: 47 passed (7 + 17 + 16 + 7)

- [ ] **Step 5: Xoá bản nháp cũ và commit**

```bash
rm apps/backend/app/services/job_match.py
git add -A apps/backend/app/services/ apps/backend/tests/test_job_fit/
git commit -m "feat(job-fit): tong hop diem, chuan hoa lai theo tieu chi co du lieu"
```

---

## Task 5: Test chống lệch theo nguồn (điều kiện chấp nhận của spec)

**Files:**
- Test: `apps/backend/tests/test_job_fit/test_no_source_bias.py`

**Interfaces:**
- Consumes: `score_jobs` (Task 4)
- Produces: không có mã sản phẩm — đây là hàng rào bảo vệ

Đây là **test quan trọng nhất của cả plan**. Nó là phép đo trực tiếp chống lại cái bẫy mà spec §2.1 mô tả: nếu ai đó sau này "tối ưu" engine bằng cách chỉ dùng `silver_skill_long`, test này phải đỏ.

- [ ] **Step 1: Viết test**

```python
"""Diem so KHONG duoc lech theo nha cung cap tin.

silver_skill_long phu 100% itviec, 99% vietnamworks, 53% topcv, va 0% linkedin
(0/4130 tin). Neu engine chi cham diem ky nang tu bang do thi toan bo 64% kho la
tin LinkedIn se tut day bang xep hang — khong phai vi khong hop ma vi ETL chua
trich ky nang cho nguon do. Test nay la hang rao chan dieu do quay lai.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core import database as db_module
from app.models.user import User
from app.services.job_fit import score_jobs

NGUONG_LECH = 15  # diem trung binh giua nguon cao nhat va thap nhat
MAU_MOI_NGUON = 20


def _user() -> User:
    return User(
        skills=["python", "sql", "java", "react", "aws", "docker",
                "project management", "marketing", "sales", "accounting"],
        desired_titles=[], preferred_cities=[],
        desired_salary_min=None, desired_salary_max=None,
        experience_level=None,
    )


@pytest.mark.asyncio
async def test_diem_trung_binh_khong_lech_theo_nguon():
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        keys: list[tuple[str, str]] = []
        for src in ("linkedin", "vietnamworks", "itviec", "topcv"):
            rows = (await db.execute(text("""
                SELECT source, source_job_id FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active AND source = :s
                ORDER BY posted_at DESC NULLS LAST LIMIT :n
            """), {"s": src, "n": MAU_MOI_NGUON})).all()
            keys += [(r[0], r[1]) for r in rows]

        if len(keys) < MAU_MOI_NGUON * 2:
            pytest.skip("kho du lieu local khong du mau")

        scored = await score_jobs(db, _user(), keys)

    theo_nguon: dict[str, list[int]] = {}
    for (src, _), fit in scored.items():
        theo_nguon.setdefault(src, []).append(fit.score)

    trung_binh = {s: sum(v) / len(v) for s, v in theo_nguon.items() if len(v) >= 5}
    assert len(trung_binh) >= 2, f"can it nhat 2 nguon co du mau: {theo_nguon.keys()}"

    lech = max(trung_binh.values()) - min(trung_binh.values())
    assert lech <= NGUONG_LECH, (
        f"diem lech {lech:.1f} qua {NGUONG_LECH} giua cac nguon: "
        f"{ {k: round(v, 1) for k, v in trung_binh.items()} } — "
        "gan nhu chac chan la engine dang chi doc silver_skill_long"
    )


@pytest.mark.asyncio
async def test_tin_linkedin_van_co_diem_ky_nang():
    """LinkedIn khong co dong nao trong silver_skill_long, nen neu tin LinkedIn
    nao cung co skill_basis='none' thi nhanh quet JD text da hong."""
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        rows = (await db.execute(text("""
            SELECT source, source_job_id FROM dbt_dev_gold.fct_jobs_daily
            WHERE is_active AND source = 'linkedin'
            ORDER BY posted_at DESC NULLS LAST LIMIT 30
        """))).all()
        if not rows:
            pytest.skip("khong co tin linkedin trong kho local")
        scored = await score_jobs(db, _user(), [(r[0], r[1]) for r in rows])

    assert scored, "khong cham duoc tin linkedin nao"
    co_ky_nang = [f for f in scored.values() if f.skills_matched > 0]
    assert co_ky_nang, "khong tin LinkedIn nao khop ky nang — nhanh quet JD text hong"
```

- [ ] **Step 2: Chạy**

```bash
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_no_source_bias.py -q'
```
Kỳ vọng: 2 passed

**Nếu đỏ:** đừng nới `NGUONG_LECH`. Đọc lại `facts.py` — gần như chắc chắn nhánh `OR ... ~* ...` không chạy.

- [ ] **Step 3: Đo chi phí**

```bash
docker exec tp-backend sh -c 'cd /app && python -c "
import asyncio, time
from sqlalchemy import text
from app.core import database as dbm
from app.models.user import User
from app.services.job_fit import score_jobs

async def main():
    await dbm.init_db()
    async with dbm.async_session_factory() as db:
        rows = (await db.execute(text(
            \"SELECT source, source_job_id FROM dbt_dev_gold.fct_jobs_daily \"
            \"WHERE is_active ORDER BY posted_at DESC NULLS LAST LIMIT 50\"))).all()
        u = User(skills=[\"python\",\"sql\",\"java\",\"react\",\"aws\",\"docker\",\"kafka\",\"airflow\"],
                 desired_titles=[], preferred_cities=[], desired_salary_min=None,
                 desired_salary_max=None, experience_level=None)
        t0 = time.time()
        r = await score_jobs(db, u, [(a,b) for a,b in rows])
        print(\"cham %d tin het %.0f ms\" % (len(r), (time.time()-t0)*1000))
    await dbm.close_db()
asyncio.run(main())"'
```
Kỳ vọng: **< 600ms** cho 50 tin. Vượt ngưỡng thì giảm `MAX_SKILLS_SCANNED` và ghi lại con số đo được.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/tests/test_job_fit/test_no_source_bias.py
git commit -m "test(job-fit): hang rao chong lech diem theo nha cung cap tin"
```

---

## Task 6: Endpoint chi tiết job

**Files:**
- Modify: `apps/backend/app/schemas/jobs.py`
- Modify: `apps/backend/app/api/jobs.py`
- Test: `apps/backend/tests/test_job_fit/test_detail_endpoint.py`

**Interfaces:**
- Consumes: `score_jobs` (Task 4)
- Produces: `GET /api/jobs/{source}/{source_job_id}` → `JobDetail`

**Schema** (thêm vào `apps/backend/app/schemas/jobs.py`):

```python
class JobMatch(BaseModel):
    score: int
    reasons: list[str] = []
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    skill_basis: str = "none"
    skills_matched: int = 0
    skills_total: int = 0
    criteria_used: list[str] = []


class JobDetail(BaseModel):
    source: str
    source_job_id: str
    title: str | None = None
    company_name: str | None = None
    company_logo_url: str | None = None
    company_size_label: str | None = None
    city_canonical: str | None = None
    primary_address: str | None = None
    job_level: str | None = None
    job_category: str | None = None
    employment_type: str | None = None
    years_of_experience: int | None = None
    working_days: str | None = None
    degree_label: str | None = None
    salary_million: float | None = None
    salary_min_million: float | None = None
    salary_max_million: float | None = None
    description: str | None = None
    requirement: str | None = None
    benefits: list[str] = []
    skills: list[str] = []
    source_url: str | None = None
    posted_at: datetime | None = None
    expired_at: datetime | None = None
    num_of_views: int | None = None
    num_of_applications: int | None = None
    # None khi ho so nguoi dung con rong — UI moi ho dien ho so, KHONG hien 0%.
    match: JobMatch | None = None
```

- [ ] **Step 1: Viết test đỏ**

```python
"""Test endpoint chi tiet job."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core import database as db_module
from app.main import app


async def _token(c: AsyncClient) -> str:
    email = "jobfit-detail@local.dev"
    await c.post("/api/auth/signup", json={
        "email": email, "password": "Test12345!", "full_name": "Detail QA"})
    r = await c.post("/api/auth/login", json={"email": email, "password": "Test12345!"})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_job_khong_ton_tai_tra_404_chu_khong_phai_500():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        tok = await _token(c)
        r = await c.get("/api/jobs/linkedin/khong-ton-tai-9999",
                        headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_can_dang_nhap():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/api/jobs/linkedin/abc")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_tra_ve_jd_va_match_null_khi_ho_so_rong():
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        row = (await db.execute(text(
            "SELECT source, source_job_id FROM dbt_dev_gold.fct_jobs_daily "
            "WHERE is_active LIMIT 1"))).first()
    if row is None:
        pytest.skip("kho du lieu local rong")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        tok = await _token(c)
        r = await c.get(f"/api/jobs/{row[0]}/{row[1]}",
                        headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["source_job_id"] == row[1]
    assert body["description"] is not None
    # Tai khoan vua tao chua co ky nang/vi tri/thanh pho => ho so rong.
    assert body["match"] is None, "ho so rong PHAI tra null, khong duoc tra 0"
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_detail_endpoint.py -q'
```
Kỳ vọng: `test_tra_ve_jd_va_match_null_khi_ho_so_rong` FAIL (nhận 404, mong đợi 200) vì route chưa tồn tại

- [ ] **Step 3: Cài đặt**

Thêm vào cuối `apps/backend/app/api/jobs.py` (**đặt SAU** `/filters` và `/my-alerts` — FastAPI khớp route theo thứ tự khai báo, đặt trước sẽ nuốt mất chúng):

```python
_DETAIL_SQL = text("""
    SELECT
        f.source, f.source_job_id, f.title, f.company_name,
        f.city_canonical, f.job_level, f.job_category, f.degree_label,
        f.posted_at, f.expired_at, f.num_of_views, f.num_of_applications,
        round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
        round((f.salary_vnd_monthly_min / 1000000.0)::numeric, 1)::float AS salary_min_million,
        round((f.salary_vnd_monthly_max / 1000000.0)::numeric, 1)::float AS salary_max_million,
        d.company_logo_url, d.company_size_label, d.primary_address,
        d.employment_type, d.years_of_experience, d.working_days,
        d.job_description_text, d.job_requirement_text,
        d.benefits, d.skills, d.source_url
    FROM dbt_dev_gold.fct_jobs_daily f
    LEFT JOIN dbt_dev_silver.silver_job_detail d
        ON d.source = f.source AND d.source_job_id = f.source_job_id
    WHERE f.source = :source AND f.source_job_id = :sjid AND f.is_active
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
```

Sửa khối import ở đầu `apps/backend/app/api/jobs.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.jobs import JobDetail, JobMatch  # them vao import san co tu module nay
from app.services.job_fit import score_jobs
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
docker cp apps/backend/app/api/jobs.py tp-backend:/app/app/api/jobs.py
docker cp apps/backend/app/schemas/jobs.py tp-backend:/app/app/schemas/jobs.py
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/ tests/test_endpoints.py -q'
```
Kỳ vọng: tất cả xanh

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/jobs.py apps/backend/app/schemas/jobs.py apps/backend/tests/test_job_fit/test_detail_endpoint.py
git commit -m "feat(jobs): endpoint chi tiet job kem diem phu hop"
```

---

## Task 7: Frontend — client API và component điểm phù hợp

**Files:**
- Modify: `apps/frontend/lib/api.ts`
- Create: `apps/frontend/components/jobs/JobMatchScore.tsx`
- Create: `apps/frontend/components/jobs/JobDescriptionText.tsx`
- Test: `apps/frontend/components/jobs/__tests__/job-match-score.test.tsx`

**Interfaces:**
- Consumes: `GET /api/jobs/{source}/{sjid}` (Task 6)
- Produces:
  - type `JobMatch`, `JobDetail` trong `lib/api.ts`
  - `jobsApi.detail(source, sourceJobId, token, signal?) => Promise<JobDetail>`
  - `<JobMatchScore match={JobMatch | null} />`
  - `<JobDescriptionText text={string | null} />`

- [ ] **Step 1: Viết test đỏ**

`apps/frontend/components/jobs/__tests__/job-match-score.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import JobMatchScore from "../JobMatchScore";

const base = {
  score: 78,
  reasons: ["Khớp 7/9 kỹ năng tin này yêu cầu"],
  matched_skills: ["python"],
  missing_skills: ["airflow", "dbt"],
  skill_basis: "required" as const,
  skills_matched: 7,
  skills_total: 9,
  criteria_used: ["city", "level", "skills", "title"],
};

test("ho so rong thi moi dien ho so, KHONG hien 0%", () => {
  render(<JobMatchScore match={null} />);
  expect(screen.queryByText(/0\s*%/)).not.toBeInTheDocument();
  expect(screen.getByText(/hồ sơ/i)).toBeInTheDocument();
});

test("hien diem phan tram va cau giai thich", () => {
  render(<JobMatchScore match={base} />);
  expect(screen.getByText("78%")).toBeInTheDocument();
  expect(screen.getByText(/Khớp 7\/9 kỹ năng/)).toBeInTheDocument();
});

test("liet ke ky nang con thieu", () => {
  render(<JobMatchScore match={base} />);
  expect(screen.getByText("airflow")).toBeInTheDocument();
  expect(screen.getByText("dbt")).toBeInTheDocument();
});

test("noi ro da cham tren bao nhieu tieu chi", () => {
  render(<JobMatchScore match={base} />);
  expect(screen.getByText(/4\/5 tiêu chí/)).toBeInTheDocument();
});

test("co so 'mentioned' khong hien phan ky nang con thieu", () => {
  // Tin khong co ky nang cau truc => ta KHONG BIET no yeu cau gi.
  // Hien "con thieu: ..." o day la bia dat va se thanh loi khuyen sai.
  render(<JobMatchScore match={{ ...base, skill_basis: "mentioned", missing_skills: [] }} />);
  expect(screen.queryByText(/còn thiếu/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
cd apps/frontend && npm test -- job-match-score
```
Kỳ vọng: FAIL — `Cannot find module '../JobMatchScore'`

- [ ] **Step 3: Cài đặt**

`apps/frontend/lib/api.ts` — thêm type (đặt cạnh các interface job sẵn có):

```ts
export interface JobMatch {
  score: number;
  reasons: string[];
  matched_skills: string[];
  missing_skills: string[];
  skill_basis: "required" | "mentioned" | "none";
  skills_matched: number;
  skills_total: number;
  criteria_used: string[];
}

export interface JobDetail {
  source: string;
  source_job_id: string;
  title: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  company_size_label: string | null;
  city_canonical: string | null;
  primary_address: string | null;
  job_level: string | null;
  job_category: string | null;
  employment_type: string | null;
  years_of_experience: number | null;
  working_days: string | null;
  degree_label: string | null;
  salary_million: number | null;
  salary_min_million: number | null;
  salary_max_million: number | null;
  description: string | null;
  requirement: string | null;
  benefits: string[];
  skills: string[];
  source_url: string | null;
  posted_at: string | null;
  expired_at: string | null;
  num_of_views: number | null;
  num_of_applications: number | null;
  match: JobMatch | null;
}
```

Thêm vào object `jobsApi` (bám đúng khuôn `request<T>` sẵn có của file):

```ts
  detail: (source: string, sourceJobId: string, token: string, signal?: AbortSignal) =>
    request<JobDetail>(
      `/api/jobs/${encodeURIComponent(source)}/${encodeURIComponent(sourceJobId)}`,
      { token, signal },
    ),
```

`apps/frontend/components/jobs/JobMatchScore.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { JobMatch } from "@/lib/api";

const TONG_TIEU_CHI = 5;

function mau(score: number) {
  if (score >= 75) return "text-emerald-600 ring-emerald-200 bg-emerald-50";
  if (score >= 50) return "text-amber-600 ring-amber-200 bg-amber-50";
  return "text-slate-500 ring-slate-200 bg-slate-50";
}

export default function JobMatchScore({ match }: { match: JobMatch | null }) {
  // Ho so rong => KHONG hien 0%. Mot con so bia cho ho so trong day nguoi dung
  // ket luan rang diem nay vo nghia; moi ho dien ho so thi vua that vua huu ich.
  if (!match) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-slate-300 p-4 text-sm text-slate-600">
        Thêm kỹ năng và vị trí mong muốn vào hồ sơ để xem mức độ phù hợp của bạn với tin này.
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 p-4">
      <div className="flex items-baseline gap-3">
        <span className={cn("rounded-full px-3 py-1 text-2xl font-bold ring-1", mau(match.score))}>
          {match.score}%
        </span>
        <span className="text-sm font-medium text-slate-700">Phù hợp với bạn</span>
      </div>

      {match.reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {match.reasons.map((r) => (
            <li key={r} className="text-sm text-slate-600">• {r}</li>
          ))}
        </ul>
      )}

      {/* Chi hien phan "con thieu" khi co so la 'required'. Voi 'mentioned' ta
          KHONG BIET tin yeu cau gi, nen liet ke o day se la bia dat. */}
      {match.skill_basis === "required" && match.missing_skills.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Còn thiếu</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {match.missing_skills.map((s) => (
              <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Noi ro da cham tren bao nhieu tieu chi, de nguoi dung khong tuong moi
          diem so deu cung mot do tin cay. */}
      <p className="mt-3 text-xs text-slate-400">
        Đã chấm trên {match.criteria_used.length}/{TONG_TIEU_CHI} tiêu chí
      </p>
    </div>
  );
}
```

`apps/frontend/components/jobs/JobDescriptionText.tsx`:

```tsx
/**
 * Render mo ta cong viec.
 *
 * BAT BUOC render VAN BAN THUAN. `job_description_text` do LinkedIn/ITviec/TopCV
 * cung cap — day la du lieu ben thu ba chua tung duoc hien trong app truoc day.
 * Dung dangerouslySetInnerHTML o day la mo mot lo hong XSS luu tru ma ke tan
 * cong kich hoat duoc chi bang cach dang mot tin tuyen dung.
 *
 * `whitespace-pre-line` giu lai xuong dong cua ban goc ma khong can parse HTML.
 */
export default function JobDescriptionText({ text }: { text: string | null }) {
  if (!text?.trim()) {
    return <p className="text-sm italic text-slate-400">Tin này không có mô tả chi tiết.</p>;
  }
  return (
    <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
      {text}
    </div>
  );
}
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
cd apps/frontend && npm test -- job-match-score && npx tsc --noEmit
```
Kỳ vọng: 5 passed, tsc sạch

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/lib/api.ts apps/frontend/components/jobs/
git commit -m "feat(jobs): component diem phu hop va render JD van ban thuan"
```

---

## Task 8: Panel trượt + gắn vào `/jobs` và `/applications`

**Files:**
- Create: `apps/frontend/components/jobs/JobDetailSheet.tsx`
- Modify: `apps/frontend/app/jobs/page.tsx`
- Modify: `apps/frontend/app/applications/page.tsx`
- Modify: `apps/frontend/components/applications/ApplicationCard.tsx`
- Test: `apps/frontend/components/jobs/__tests__/job-detail-sheet.test.tsx`

**Interfaces:**
- Consumes: `jobsApi.detail` (Task 7), `JobMatchScore`, `JobDescriptionText`, `components/ui/sheet.tsx`
- Produces: `<JobDetailSheet source={string|null} sourceJobId={string|null} onClose={() => void} manualTitle?={string} />`

- [ ] **Step 1: Viết test đỏ**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import JobDetailSheet from "../JobDetailSheet";

jest.mock("@/lib/api", () => ({ jobsApi: { detail: jest.fn() } }));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok" }) }));

const { jobsApi } = jest.requireMock("@/lib/api");

const detail = {
  source: "linkedin", source_job_id: "j1", title: "Data Engineer",
  company_name: "Acme", description: "Xay dung pipeline du lieu.",
  requirement: null, benefits: [], skills: [], match: null,
  company_logo_url: null, company_size_label: null, city_canonical: "HCMC",
  primary_address: null, job_level: null, job_category: null,
  employment_type: null, years_of_experience: null, working_days: null,
  degree_label: null, salary_million: null, salary_min_million: null,
  salary_max_million: null, source_url: null, posted_at: null,
  expired_at: null, num_of_views: null, num_of_applications: null,
};

beforeEach(() => jest.clearAllMocks());

test("khong goi API khi chua chon job nao", () => {
  render(<JobDetailSheet source={null} sourceJobId={null} onClose={jest.fn()} />);
  expect(jobsApi.detail).not.toHaveBeenCalled();
});

test("nap va hien JD khi mo", async () => {
  jobsApi.detail.mockResolvedValue(detail);
  render(<JobDetailSheet source="linkedin" sourceJobId="j1" onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText("Data Engineer")).toBeInTheDocument());
  expect(screen.getByText(/Xay dung pipeline/)).toBeInTheDocument();
});

test("loi API hien thong bao loi RIENG, khong hien nhu la tin khong co mo ta", async () => {
  jobsApi.detail.mockRejectedValue(new Error("500"));
  render(<JobDetailSheet source="linkedin" sourceJobId="j1" onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText(/Không tải được/i)).toBeInTheDocument());
  expect(screen.queryByText(/không có mô tả chi tiết/i)).not.toBeInTheDocument();
});

test("job nhap tay (khong co source_job_id) thi bao ro thay vi panel trong", () => {
  render(<JobDetailSheet source="manual" sourceJobId={null}
                         onClose={jest.fn()} manualTitle="Job tu nhap" />);
  expect(screen.getByText(/tự nhập/i)).toBeInTheDocument();
  expect(jobsApi.detail).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
cd apps/frontend && npm test -- job-detail-sheet
```
Kỳ vọng: FAIL — `Cannot find module '../JobDetailSheet'`

- [ ] **Step 3: Cài đặt `JobDetailSheet.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { jobsApi, type JobDetail } from "@/lib/api";
import JobMatchScore from "./JobMatchScore";
import JobDescriptionText from "./JobDescriptionText";

interface Props {
  source: string | null;
  sourceJobId: string | null;
  onClose: () => void;
  /** Tieu de cho job nguoi dung TU NHAP (source_job_id = NULL, khong co trong kho). */
  manualTitle?: string;
}

export default function JobDetailSheet({ source, sourceJobId, onClose, manualTitle }: Props) {
  const { token } = useAuth();
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // Trang thai loi RIENG voi trang thai rong. Gop hai thu lam mot se khien loi
  // mang hien thanh "tin nay khong co mo ta chi tiet" — bao sai su that.
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController>();

  const open = Boolean(source);
  const laTuNhap = open && !sourceJobId;

  useEffect(() => {
    if (!open || laTuNhap || !token || !source || !sourceJobId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null);
    jobsApi
      .detail(source, sourceJobId, token, controller.signal)
      .then((d) => { if (!controller.signal.aborted) setData(d); })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Không tải được thông tin việc làm");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [open, laTuNhap, token, source, sourceJobId]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{data?.title ?? manualTitle ?? "Chi tiết việc làm"}</SheetTitle>
        </SheetHeader>

        {/* Job nguoi dung tu them khong nam trong kho du lieu nen khong co JD.
            Noi thang dieu do, thay vi de panel trong cho ho tuong la loi. */}
        {laTuNhap ? (
          <p className="mt-6 text-sm text-slate-600">
            Đây là việc làm bạn tự nhập nên chưa có mô tả chi tiết trong kho dữ liệu.
          </p>
        ) : loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-red-300 bg-red-50/50 p-6 text-center">
            <p className="font-medium text-red-700">{error}</p>
          </div>
        ) : data ? (
          <div className="mt-6 space-y-6">
            <div className="text-sm text-slate-600">
              {[data.company_name, data.city_canonical, data.job_level]
                .filter(Boolean).join(" · ")}
            </div>

            <JobMatchScore match={data.match} />

            <section>
              <h3 className="mb-2 font-semibold text-slate-900">Mô tả công việc</h3>
              <JobDescriptionText text={data.description} />
            </section>

            {data.requirement && (
              <section>
                <h3 className="mb-2 font-semibold text-slate-900">Yêu cầu</h3>
                <JobDescriptionText text={data.requirement} />
              </section>
            )}

            {data.benefits.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold text-slate-900">Quyền lợi</h3>
                <ul className="space-y-1 text-sm text-slate-700">
                  {data.benefits.map((b) => <li key={b}>• {b}</li>)}
                </ul>
              </section>
            )}

            {data.source_url && (
              <a href={data.source_url} target="_blank" rel="noopener noreferrer"
                 className="inline-block text-sm font-medium text-brand-600 hover:underline">
                Xem tin gốc và ứng tuyển →
              </a>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
cd apps/frontend && npm test -- job-detail-sheet
```
Kỳ vọng: 4 passed

- [ ] **Step 5: Gắn vào `/jobs`**

Trong `apps/frontend/app/jobs/page.tsx` (file đã có sẵn khuôn `readParams` + `router.replace`):

```tsx
const [openJob, setOpenJob] = useState<{ source: string; id: string } | null>(() => {
  const raw = searchParams.get("job");
  if (!raw) return null;
  const i = raw.indexOf(":");
  return i > 0 ? { source: raw.slice(0, i), id: raw.slice(i + 1) } : null;
});
```

Trong `useEffect` đồng bộ URL đã có, thêm một dòng (và thêm `openJob` vào mảng phụ thuộc):

```tsx
if (openJob) sp.set("job", `${openJob.source}:${openJob.id}`);
```

Render panel bên trong `JobBoardContent`:

```tsx
<JobDetailSheet
  source={openJob?.source ?? null}
  sourceJobId={openJob?.id ?? null}
  onClose={() => setOpenJob(null)}
/>
```

**Cẩn thận:** `JobCard` đang có link ra tin gốc và nút "Đã apply". Đặt handler mở panel ở vùng thân card, **không** bọc cả card trong một nút — nếu không, bấm "Đã apply" sẽ mở luôn panel.

- [ ] **Step 6: Gắn vào `/applications`**

`ApplicationCard.tsx` — thêm prop `onOpenDetail`. Vùng bấm phải **tránh** listener kéo-thả của dnd-kit: đặt `onClick` trên phần tiêu đề, **không** trên phần tử mang `{...listeners}` (dòng 48), nếu không mỗi lần kéo sẽ mở panel.

`app/applications/page.tsx` — giữ state `openJob` và render:

```tsx
<JobDetailSheet
  source={openJob?.source ?? null}
  sourceJobId={openJob?.sourceJobId ?? null}
  manualTitle={openJob?.title}
  onClose={() => setOpenJob(null)}
/>
```

Job tự nhập có `source_job_id === null` → truyền `sourceJobId={null}` + `manualTitle` để panel hiện thông báo thay vì gọi API vô ích.

- [ ] **Step 7: Kiểm chứng bằng trình duyệt**

Trên `http://[::1]/` (**không** dùng cổng 80):

1. `/jobs` → bấm một card → panel mở, có JD, URL thành `?job=linkedin:xxx`
2. F5 → panel vẫn mở đúng job đó
3. Bấm Back → panel đóng
4. Bấm nút "Đã apply" trên card → **không** mở panel
5. `/applications` → bấm card đã lưu → panel mở kèm điểm phù hợp
6. `/applications` → bấm job tự nhập → hiện "bạn tự nhập nên chưa có mô tả", **không** gọi API
7. Kéo một card sang cột khác → panel **không** mở
8. DevTools → kiểm tra JD **không** render thành HTML (thẻ `<b>` trong nguồn phải hiện ra dưới dạng chữ)

- [ ] **Step 8: Commit**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
git add apps/frontend/
git commit -m "feat(jobs): panel chi tiet job tren /jobs va /applications"
```

---

## Task 9: Rerank theo độ phù hợp + "nên focus job nào"

**Files:**
- Modify: `apps/backend/app/api/jobs.py`
- Modify: `apps/backend/app/schemas/jobs.py`
- Modify: `apps/backend/app/api/applications.py`
- Modify: `apps/frontend/app/jobs/page.tsx`
- Test: `apps/backend/tests/test_job_fit/test_rerank.py`

**Interfaces:**
- Consumes: `score_jobs` (Task 4), `application_service.tracked_keys`
- Produces: `GET /api/jobs?sort=match`; `GET /api/applications/focus`; `RERANK_POOL: int = 300`

- [ ] **Step 1: Viết test đỏ**

```python
"""Test sap xep theo do phu hop."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.jobs import RERANK_POOL
from app.main import app


@pytest.mark.asyncio
async def test_sort_match_tra_ve_da_sap_giam_dan():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        email = "jobfit-rerank@local.dev"
        await c.post("/api/auth/signup", json={
            "email": email, "password": "Test12345!", "full_name": "Rerank QA"})
        tok = (await c.post("/api/auth/login", json={
            "email": email, "password": "Test12345!"})).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        await c.patch("/api/auth/me", headers=h, json={
            "skills": ["python", "sql"], "preferred_cities": ["HCMC"]})

        r = await c.get("/api/jobs?sort=match&per_page=20", headers=h)

    assert r.status_code == 200
    body = r.json()
    diem = [j["match_score"] for j in body["jobs"] if j.get("match_score") is not None]
    assert diem == sorted(diem, reverse=True), "khong duoc sap giam dan"
    assert body["scored_pool"] is not None
    assert body["scored_pool"] <= RERANK_POOL
```

- [ ] **Step 2: Chạy để xác nhận đỏ**

```bash
docker cp apps/backend/tests/test_job_fit/. tp-backend:/app/tests/test_job_fit/
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/test_rerank.py -q'
```
Kỳ vọng: FAIL với `ImportError: cannot import name 'RERANK_POOL'`

- [ ] **Step 3: Cài đặt backend**

Thêm hằng số vào `apps/backend/app/api/jobs.py`, ngay dưới `router = APIRouter(...)`:

```python
# Chan kich thuoc shortlist truoc khi cham diem. Quet bien tu ton ~250ms cho MOI
# ky nang tren 6432 tin; 300 tin voi 30 ky nang la ~350ms — chap nhan duoc cho
# mot request. Cham ca kho se mat hang chuc giay.
#
# Gioi han nay PHAI duoc noi ro tren UI (truong `scored_pool`). Cat bot am tham
# se doc thanh "da xet het kho" trong khi khong phai.
RERANK_POOL = 300
```

Thêm `sort: str | None = Query(None)` vào chữ ký `list_jobs`. Khi `sort == "match"`, thay đường phân trang SQL bằng năm bước theo đúng thứ tự:

1. Chạy đúng truy vấn lọc hiện có nhưng `ORDER BY f.posted_at DESC NULLS LAST LIMIT :pool` (`pool = RERANK_POOL`), **bỏ** `OFFSET`
2. Gọi `await score_jobs(db, _user, [(r["source"], r["source_job_id"]) for r in rows])`
3. Sắp xếp `rows` theo `scores.get(key).score` giảm dần; tin không chấm được (`None`) xếp cuối, giữ nguyên thứ tự tương đối theo `posted_at`
4. Cắt trang trong Python: `rows[offset : offset + per_page]`
5. Gán `match_score` cho từng `PublicJobRow` và `scored_pool = len(rows_truoc_khi_cat)` cho `PublicJobList`

Thêm vào `apps/backend/app/schemas/jobs.py`:

```python
# trong PublicJobRow
    match_score: int | None = None

# trong PublicJobList
    # So tin THUC SU duoc cham diem o lan rerank nay. UI phai hien con so nay:
    # cat bot am tham se doc thanh "da xet het kho" trong khi khong phai.
    scored_pool: int | None = None
```

**"Nên focus job nào"** — thêm vào `apps/backend/app/api/applications.py`:

```python
@router.get("/focus")
async def focus_suggestions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Ba job DA LUU nhung CHUA apply, diem phu hop cao nhat.

    Khong dung LLM: cau tra loi "nen focus cai nao" chinh la diem so + ly do da
    tinh o job_fit. Chay them mot model ngon ngu o day chi lam cham va lam ket
    qua bap benh, khong them thong tin gi.
    """
    rows = await tracked_keys(db, user.id)
    keys = [(r["source"], r["source_job_id"]) for r in rows if r["status"] == "saved"]
    if not keys:
        return []
    scored = await score_jobs(db, user, keys)
    top = sorted(scored.items(), key=lambda kv: kv[1].score, reverse=True)[:3]
    return [
        {"source": k[0], "source_job_id": k[1], "score": v.score, "reasons": v.reasons}
        for k, v in top
    ]
```

Thêm import `from app.services.job_fit import score_jobs` vào `applications.py`.

**Chú ý thứ tự route:** `/focus` phải khai báo **trước** bất kỳ route `/{application_id}` nào trong cùng router, nếu không FastAPI sẽ coi "focus" là một id.

- [ ] **Step 4: Chạy để xác nhận xanh**

```bash
docker cp apps/backend/app/api/jobs.py tp-backend:/app/app/api/jobs.py
docker cp apps/backend/app/api/applications.py tp-backend:/app/app/api/applications.py
docker cp apps/backend/app/schemas/jobs.py tp-backend:/app/app/schemas/jobs.py
docker exec tp-backend sh -c 'cd /app && python -m pytest tests/test_job_fit/ tests/test_applications_api.py -q'
```
Kỳ vọng: tất cả xanh

- [ ] **Step 5: Frontend — nút sắp xếp**

Thêm nút bật/tắt "Phù hợp nhất" ↔ "Mới nhất" vào `/jobs`, đồng bộ lên URL qua `?sort=match` (dùng đúng khuôn `readParams`/`router.replace` sẵn có). Khi đang bật, hiện dòng:

```tsx
{data?.scored_pool != null && (
  <p className="text-xs text-slate-500">
    Đã chấm {data.scored_pool} tin mới nhất khớp bộ lọc
  </p>
)}
```

Không được giấu giới hạn này.

- [ ] **Step 6: Commit**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
git add apps/backend/app/api/ apps/backend/app/schemas/jobs.py apps/backend/tests/test_job_fit/test_rerank.py apps/frontend/
git commit -m "feat(jobs): sap xep theo do phu hop va goi y job nen focus"
```

---

## Self-Review

**1. Spec coverage** — đối chiếu spec §12 việc 1–3:

| Spec | Task |
|---|---|
| §4.1 bộ chấm điểm (5 tiêu chí, chuẩn hoá lại, 2 cơ sở kỹ năng, lọc nhiễu, chặn 30 kỹ năng, hồ sơ rỗng → null) | 1, 3, 4 |
| §2.2 `structured OR text` | 2 |
| §2.3 biên từ + escape metachar | 2 |
| §2.4 không chấm cả kho | 2, 9 (`RERANK_POOL`) |
| §4.2 endpoint chi tiết + panel + cấm `dangerouslySetInnerHTML` | 6, 7, 8 |
| §4.3 rerank + focus + nói rõ giới hạn | 9 |
| §8 hợp nhất `LEVEL_MAP`, xoá `job_match.py`, đổi tên `job_fit` | 3, 4 |
| §9 xử lý lỗi (404 không 500, hồ sơ rỗng, tiêu chí thiếu dữ liệu) | 3, 4, 6, 8 |
| §10 điều kiện chấp nhận (chống lệch nguồn, chi phí, không tự khớp sai) | 5 |
| **Yêu cầu của user về `/applications`** (spec ghi thiếu) | 8, bước 6 |

**Chưa phủ, sang plan sau:** §5 soạn thư + nhắc follow-up, §6 Insight, §7 trang công ty, migration backfill `applied_at`. Lỗi kéo-thả bằng bàn phím **không thuộc spec** — bug riêng, plan riêng.

**2. Placeholder scan** — không có TBD/TODO. Mọi bước có mã thật. Task 9 bước 3 và 5 mô tả bằng lời thay vì dán mã đầy đủ vì chúng sửa xen vào hàm `list_jobs` đang có (230 dòng) — dán một khối mã ở đây sẽ lệch với file thật khi tới lượt thi công. Các bước đó nêu rõ năm thao tác theo thứ tự.

**3. Type consistency** — `Profile` (Task 1) dùng nguyên vẹn ở 3, 4. `JobFacts` (Task 2) dùng ở 3, 4. `CriterionResult.detail` khoá `basis`/`matched`/`missing`/`hit`/`total` được `scoring.combine` đọc đúng tên. `FitScore` có đúng các trường mà `JobMatch` (Task 6) khai báo, nên `JobMatch(**fit.__dict__)` khớp. Type `JobMatch` ở TS (Task 7) khớp schema Pydantic.

**Một chỗ cần chú ý khi thi công:** `FitScore` là `@dataclass(frozen=True)` nên `fit.__dict__` hoạt động, nhưng nếu ai đó đổi sang `slots=True` thì nó sẽ vỡ — lúc đó dùng `dataclasses.asdict(fit)`.

---

## Execution Handoff

Plan hoàn tất, lưu tại `docs/superpowers/plans/2026-08-01-job-fit-engine-and-panel.md`. Hai cách thi công:

**1. Subagent-Driven (đề xuất)** — mỗi task một subagent mới, review giữa các task, vòng lặp nhanh.

**2. Inline Execution** — chạy tuần tự trong phiên này, có điểm dừng để review.
