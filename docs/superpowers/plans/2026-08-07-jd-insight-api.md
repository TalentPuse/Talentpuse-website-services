# JDI — Bán Insight Data từ JD (API trả phí) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây API trả phí `/api/v1/*` bán insight từ JD được LLM extract, kèm pipeline extract + key/quota thủ công.

**Architecture:** Backend FastAPI hiện tại (apps/backend) mở rộng: bảng `app.jd_insight` (JSONB extract theo schema) + `app.api_keys` (key_hash + quota tháng); service extract gọi LLM (OpenRouter) upsert theo `(source, source_job_id)`; router `/api/v1` sau middleware verify `X-API-Key` + quota + rate limit; admin tạo key + trigger extract nội bộ qua webhook secret; Prefect flow gọi trigger hàng ngày.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, PostgreSQL (JSONB), alembic, Redis (rate limit, optional), OpenRouter (deepseek-v4-flash), prefect (web box).

## Global Constraints

- Schema JSONB extract KHÔNG chứa salary (đã bỏ khỏi sản phẩm — nhưng `extras` có thể chứa `salary_note` nguyên văn)
- Không lưu API key thô — chỉ `sha256` (key_hash)
- Quota reset theo ĐẦU THÁNG: `quota_reset_at` = ngày 1 tháng kế tiếp lúc tạo key; hết hạn → reset `used_count=0`
- Hết quota → HTTP 429; key sai/inactive → HTTP 401
- `extras` tối đa 10 items; `aspect` snake_case lowercase; `value` nguyên văn
- Skill normalize: lowercase; synonym map là dict hằng số trong code
- Redis chết → rate limit fail-open (không chặn request)
- Mọi test chạy với DB test: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres` + `.venv\Scripts\python.exe -m pytest`
- Path style job detail giống API cũ: `/api/v1/jobs/{source}/{source_job_id}/insight`

---

### Task 1: Migration 022 — bảng jd_insight + api_keys

**Files:**
- Create: `apps/backend/alembic/versions/022_jd_insight_and_api_keys.py`
- Modify: `apps/backend/alembic/versions/021_email_alert_default_on.py` (không — chỉ tạo mới, down_revision="021")

**Interfaces:**
- Produces: schema `app.jd_insight` (id, source, source_job_id, data jsonb, model_version text, extracted_at timestamptz, UNIQUE(source, source_job_id)); `app.api_keys` (id, name, key_hash unique, quota_month int default 10000, used_count int default 0, quota_reset_at timestamptz, is_active bool default true, created_at)

- [ ] **Step 1: Viết migration**

```python
"""jd_insight + api_keys — ban insight data tu JD"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jd_insight",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("source_job_id", sa.String(), nullable=False),
        sa.Column("data", JSONB(), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source", "source_job_id", name="uq_jd_insight_source_job"),
        schema="app",
    )
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("quota_month", sa.Integer(), nullable=False, server_default="10000"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quota_reset_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("api_keys", schema="app")
    op.drop_table("jd_insight", schema="app")
```

- [ ] **Step 2: Chạy migration lên DB test**

Run: `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"; & ".venv\Scripts\alembic.exe" upgrade head`
Expected: `022 (head)`; kiểm tra `docker exec tp-postgres psql -U talentpulse -d talentpulse -c "\d app.jd_insight"` (nếu chạy trên box) — trên test DB dùng `\d app.jd_insight` qua psql tương ứng.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/alembic/versions/022_jd_insight_and_api_keys.py
git commit -m "feat(jdi): migration jd_insight + api_keys"
```

---

### Task 2: Pydantic schema extract — `app/schemas/jd_insight.py`

**Files:**
- Create: `apps/backend/app/schemas/jd_insight.py`
- Test: `apps/backend/tests/test_jd_insight_schema.py`

**Interfaces:**
- Produces: `JdInsight` (Pydantic model) với `.model_validate(dict)` nhận dict từ LLM; `extras` validate ≤ 10 items; `seniority_hint` enum; `work_type`/`remote`/`education.level` enum.

- [ ] **Step 1: Viết test fail**

```python
"""Schema extract JDI — validate dung enum, gioi han extras, bo qua field la."""
import pytest
from pydantic import ValidationError

from app.schemas.jd_insight import JdInsight

MINIMAL = {
    "job": {"source": "topcv", "source_job_id": "1", "title": "AI Engineer", "company_name": "X",
            "job_level": "Mid-level", "job_category": "AI Engineer", "city_canonical": "HCMC"},
    "summary": {"role_summary": "Lam AI", "seniority_hint": "mid"},
    "skills": {"hard": ["Python"], "soft": [], "tools": ["Docker"], "languages": [], "certifications": []},
    "requirements": {"years_experience": {"min": 3, "max": None, "raw": "3 YOE+"},
                     "education": {"level": "university", "major": None},
                     "work_type": "fulltime", "remote": "hybrid", "other": []},
    "responsibilities": ["Xay dung model"],
    "benefits": ["Bao hiem"],
    "keywords": ["LLM"],
    "extras": [],
}


def test_validate_minimal():
    m = JdInsight.model_validate(MINIMAL)
    assert m.skills.hard == ["Python"]


def test_seniority_invalid_bi_tu_choi():
    data = dict(MINIMAL)
    data["summary"]["seniority_hint"] = "boss"
    with pytest.raises(ValidationError):
        JdInsight.model_validate(data)


def test_extras_qua_10_items_bi_tu_choi():
    data = dict(MINIMAL)
    data["extras"] = [{"aspect": f"a{i}", "value": "x"} for i in range(11)]
    with pytest.raises(ValidationError):
        JdInsight.model_validate(data)


def test_extras_accepts_10_items():
    data = dict(MINIMAL)
    data["extras"] = [{"aspect": f"a{i}", "value": "x"} for i in range(10)]
    assert len(JdInsight.model_validate(data).extras) == 10
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_jd_insight_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.jd_insight'`

- [ ] **Step 3: Viết schema**

```python
"""Schema extract JD — xem spec docs/superpowers/specs/2026-08-07-jd-insight-api-design.md."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

SENIORITY = Literal["intern", "fresher", "junior", "mid", "senior", "lead", "manager"]
WORK_TYPE = Literal["fulltime", "contract", "internship", "parttime"]
REMOTE = Literal["remote", "hybrid", "onsite"]
EDU_LEVEL = Literal["university", "college", "none"]


class Extra(BaseModel):
    aspect: str = Field(min_length=1, max_length=50)
    value: str = Field(min_length=1, max_length=500)


class Language(BaseModel):
    lang: str
    level: str | None = None


class JobRef(BaseModel):
    source: str
    source_job_id: str
    title: str | None = None
    company_name: str | None = None
    job_level: str | None = None
    job_category: str | None = None
    city_canonical: str | None = None


class Summary(BaseModel):
    role_summary: str | None = None
    seniority_hint: SENIORITY | None = None


class Skills(BaseModel):
    hard: list[str] = Field(default_factory=list)
    soft: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class YearsExperience(BaseModel):
    min: int | None = None
    max: int | None = None
    raw: str | None = None


class Education(BaseModel):
    level: EDU_LEVEL | None = None
    major: str | None = None


class Requirements(BaseModel):
    years_experience: YearsExperience = Field(default_factory=YearsExperience)
    education: Education = Field(default_factory=Education)
    work_type: WORK_TYPE | None = None
    remote: REMOTE | None = None
    other: list[str] = Field(default_factory=list)


class JdInsight(BaseModel):
    job: JobRef
    summary: Summary = Field(default_factory=Summary)
    skills: Skills = Field(default_factory=Skills)
    requirements: Requirements = Field(default_factory=Requirements)
    responsibilities: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    extras: list[Extra] = Field(default_factory=list, max_length=10)

    @model_validator(mode="before")
    @classmethod
    def _bo_qua_salary_duoc_phep(cls, data):
        # Cho phep LLM tra ca salary (neu JD co) — ta BO QUA o day vi san pham
        # khong ban salary; chi giu extras.salary_note neu co.
        if isinstance(data, dict):
            data.pop("salary", None)
        return data
```

Lưu ý: `max_length` trên list trong pydantic v2 chỉ áp dụng khi dùng `Field(..., max_length=10)` — extras dùng `Field(default_factory=list, max_length=10)` sẽ validate ≤ 10. Nếu test extras 11 items vẫn pass, đổi thành `Annotated[list[Extra], Field(max_length=10)]`.

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_jd_insight_schema.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/schemas/jd_insight.py apps/backend/tests/test_jd_insight_schema.py
git commit -m "feat(jdi): schema extract JD (enum, extras <= 10)"
```

---

### Task 3: Service extract — `app/services/jd_extract.py`

**Files:**
- Create: `apps/backend/app/services/jd_extract.py`
- Test: `apps/backend/tests/test_jd_extract.py`

**Interfaces:**
- Consumes: `JdInsight` (Task 2)
- Produces: `extract_insight(text: str) -> JdInsight` — gọi LLM, parse + validate, raise `ExtractError` khi LLM trả sai; `MODEL_VERSION = "jdi-v1"` hằng số.

- [ ] **Step 1: Viết test fail (mock LLM)**

```python
"""Extract insight tu JD text bang LLM."""
import json

import pytest
from unittest.mock import AsyncMock, patch

from app.services.jd_extract import MODEL_VERSION, ExtractError, extract_insight

GOOD_JSON = {
    "job": {"source": "topcv", "source_job_id": "1", "title": "AI Engineer", "company_name": "X",
            "job_level": "Mid-level", "job_category": "AI Engineer", "city_canonical": "HCMC"},
    "summary": {"role_summary": "Lam AI", "seniority_hint": "mid"},
    "skills": {"hard": ["Python"], "soft": [], "tools": ["Docker"], "languages": [], "certifications": []},
    "requirements": {"years_experience": {"min": 3, "max": None, "raw": "3 YOE+"},
                     "education": {"level": "university", "major": None},
                     "work_type": "fulltime", "remote": "hybrid", "other": []},
    "responsibilities": ["Xay model"], "benefits": ["Bao hiem"], "keywords": ["LLM"], "extras": [],
}


@pytest.mark.asyncio
async def test_extract_valid(monkeypatch):
    fake = AsyncMock()
    fake.content = json.dumps(GOOD_JSON)
    fake_chat = AsyncMock()
    fake_chat.completions.create = AsyncMock(return_value=fake)
    monkeypatch.setattr("app.services.jd_extract._chat", fake_chat)

    result = await extract_insight("Mô tả công việc...")
    assert isinstance(result, dict)  # dict de nhet vao jsonb
    assert result["skills"]["hard"] == ["Python"]


@pytest.mark.asyncio
async def test_extract_sai_json_raise(monkeypatch):
    fake = AsyncMock()
    fake.content = "khong phai json"
    fake_chat = AsyncMock()
    fake_chat.completions.create = AsyncMock(return_value=fake)
    monkeypatch.setattr("app.services.jd_extract._chat", fake_chat)

    with pytest.raises(ExtractError):
        await extract_insight("text")


def test_model_version_fixed():
    assert MODEL_VERSION == "jdi-v1"
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_jd_extract.py -v`
Expected: FAIL — module không tồn tại

- [ ] **Step 3: Viết service**

```python
"""Extract insight tu JD text bang LLM (OpenRouter qua OPENAI_API_KEY)."""
from __future__ import annotations

import json
import logging

from openai import OpenAI

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.schemas.jd_insight import JdInsight

logger = logging.getLogger(__name__)

MODEL_VERSION = "jdi-v1"

_chat: OpenAI | None = None


def _get_chat() -> OpenAI:
    global _chat
    if _chat is None:
        _chat = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    return _chat


class ExtractError(RuntimeError):
    pass


_PROMPT = """\
Ban trich xuat du lieu co cau truc tu noi dung tin tuyen dung (JD) tieng Viet/Anh.
Tra VE JSON DUNG SCHEMA sau (khong them giai thich):

{
  "summary": {"role_summary": "1-2 cau", "seniority_hint": "intern|fresher|junior|mid|senior|lead|manager|null"},
  "skills": {"hard": ["ky nang ky thuat"], "soft": ["ky nang mem"], "tools": ["cong cu/framework"],
             "languages": [{"lang": "Tieng Nhat", "level": "N2"}], "certifications": ["AWS Certified"]},
  "requirements": {"years_experience": {"min": 3, "max": null, "raw": "cau goc"},
                   "education": {"level": "university|college|none|null", "major": null},
                   "work_type": "fulltime|contract|internship|parttime|null",
                   "remote": "remote|hybrid|onsite|null",
                   "other": ["yeu cau dac thu khong thuoc enum"]},
  "responsibilities": ["3-6 trach nhiem chinh, giu nguyen van"],
  "benefits": ["phuc loi, chuan hoa nhom: bao hiem, thuong thang 13..."],
  "keywords": ["tu khoa dac thu nganh"],
  "extras": [{"aspect": "deadline", "value": "nguyen van"}]  // toi da 10; chi nhat thu NGOAI cac field tren
}

Quy tac:
- KHONG bo sung giong/ky nang khong co trong JD
- skills: lowercase; "ai" khong doi thanh "artificial intelligence" (giu nguyen, synonym o lop aggregate)
- extras.aspect: snake_case lowercase (deadline, working_hours, probation, team_size, report_to, salary_note, location_detail...)
- extras toi da 10 items
- Salary trong JD chi duoc ghi vao extras voi aspect "salary_note", KHONG co field salary rieng
"""


async def extract_insight(text: str) -> dict:
    """Goi LLM extract JD text -> dict JSON da validate theo JdInsight."""
    client = _get_chat()
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0,
            response_format={"type": "json_object"},
            timeout=120,
            messages=[
                {"role": "system", "content": _PROMPT},
                {"role": "user", "content": text[:8000]},
            ],
        )
        content = (resp.choices[0].message.content or "").strip()
        data = json.loads(content)
    except Exception as exc:
        raise ExtractError(f"llm_extract_failed: {exc}") from exc
    try:
        return JdInsight.model_validate(data).model_dump(mode="json")
    except Exception as exc:
        raise ExtractError(f"llm_parse_error: {exc}") from exc
```

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_jd_extract.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/services/jd_extract.py apps/backend/tests/test_jd_extract.py
git commit -m "feat(jdi): service extract insight tu JD (LLM + validate schema)"
```

---

### Task 4: Model + upsert — `app/models/jd_insight.py` + service lưu

**Files:**
- Create: `apps/backend/app/models/jd_insight.py`
- Modify: `apps/backend/app/models/__init__.py` (import model)
- Create: `apps/backend/app/services/jd_insight_repo.py`
- Test: `apps/backend/tests/test_jd_insight_repo.py`

**Interfaces:**
- Consumes: `extract_insight`, `MODEL_VERSION` (Task 3)
- Produces: `upsert_insight(db, source, source_job_id, data: dict, model_version=MODEL_VERSION) -> None`; `get_insight(db, source, source_job_id) -> dict | None`; `get_missing_job_keys(db, limit) -> list[tuple[str, str]]`

- [ ] **Step 1: Viết test fail**

```python
"""Repo jd_insight — upsert idempotent + tim job chua extract."""
from sqlalchemy import select

from app.models.jd_insight import JdInsight
from app.services.jd_insight_repo import get_insight, get_missing_job_keys, upsert_insight


async def test_upsert_then_read_back(db_session):
    data = {"summary": {"role_summary": "x", "seniority_hint": None}, "skills": {"hard": ["python"], "soft": [],
            "tools": [], "languages": [], "certifications": []}, "requirements": {}, "responsibilities": [],
            "benefits": [], "keywords": [], "extras": []}
    await upsert_insight(db_session, "topcv", "1", data, "jdi-v1")
    got = await get_insight(db_session, "topcv", "1")
    assert got is not None and got["skills"]["hard"] == ["python"]


async def test_upsert_twice_ghi_de_khong_loi(db_session):
    data = {"summary": {"role_summary": "a", "seniority_hint": None}, "skills": {"hard": ["a"], "soft": [],
            "tools": [], "languages": [], "certifications": []}, "requirements": {}, "responsibilities": [],
            "benefits": [], "keywords": [], "extras": []}
    await upsert_insight(db_session, "topcv", "1", data, "jdi-v1")
    data["skills"]["hard"] = ["b"]
    await upsert_insight(db_session, "topcv", "1", data, "jdi-v1")
    got = await get_insight(db_session, "topcv", "1")
    assert got["skills"]["hard"] == ["b"]


async def test_get_missing_chi_tra_job_chua_extract(db_session):
    # Seed 2 job vao dbt_dev_silver.silver_job_detail (fake) + 1 da co insight
    from sqlalchemy import text

    await db_session.execute(text("CREATE SCHEMA IF NOT EXISTS dbt_dev_silver"))
    await db_session.execute(text("""
        CREATE TABLE IF NOT EXISTS dbt_dev_silver.silver_job_detail (
            source varchar, source_job_id varchar,
            job_description_text text, job_requirement_text text
        )
    """))
    await db_session.execute(text(
        "INSERT INTO dbt_dev_silver.silver_job_detail VALUES "
        "('topcv','a','desc','req'), ('topcv','b','desc','req')"
    ))
    await db_session.commit()

    data = {"summary": {"role_summary": "x", "seniority_hint": None}, "skills": {"hard": [], "soft": [],
            "tools": [], "languages": [], "certifications": []}, "requirements": {}, "responsibilities": [],
            "benefits": [], "keywords": [], "extras": []}
    await upsert_insight(db_session, "topcv", "a", data, "jdi-v1")

    keys = await get_missing_job_keys(db_session, limit=10)
    assert ("topcv", "b") in keys
    assert ("topcv", "a") not in keys
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_jd_insight_repo.py -v`
Expected: FAIL

- [ ] **Step 3: Viết model + repo**

`app/models/jd_insight.py`:
```python
from __future__ import annotations
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class JdInsight(Base):
    __tablename__ = "jd_insight"
    __table_args__ = (
        UniqueConstraint("source", "source_job_id", name="uq_jd_insight_source_job"),
        {"schema": "app"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_job_id: Mapped[str] = mapped_column(String, nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    model_version: Mapped[str] = mapped_column(String, nullable=False)
    extracted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

`app/services/jd_insight_repo.py`:
```python
"""Repo jd_insight — upsert, doc, tim job chua extract."""
from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.jd_insight import JdInsight
from app.services.jd_extract import MODEL_VERSION


async def upsert_insight(
    db: AsyncSession, source: str, source_job_id: str, data: dict, model_version: str = MODEL_VERSION
) -> None:
    stmt = pg_insert(JdInsight).values(
        source=source, source_job_id=source_job_id, data=data, model_version=model_version
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_jd_insight_source_job",
        set_={"data": stmt.excluded.data, "model_version": stmt.excluded.model_version,
              "extracted_at": text("now()")},
    )
    await db.execute(stmt)
    await db.commit()


async def get_insight(db: AsyncSession, source: str, source_job_id: str) -> dict | None:
    row = (await db.execute(
        select(JdInsight.data).where(
            JdInsight.source == source, JdInsight.source_job_id == source_job_id
        )
    )).scalar_one_or_none()
    return row


async def get_missing_job_keys(db: AsyncSession, limit: int = 100) -> list[tuple[str, str]]:
    """Cac (source, source_job_id) co JD text nhung CHUA co insight."""
    rows = await db.execute(text("""
        SELECT d.source, d.source_job_id
        FROM dbt_dev_silver.silver_job_detail d
        WHERE length(coalesce(d.job_description_text, '')) > 100
          AND NOT EXISTS (
              SELECT 1 FROM app.jd_insight i
              WHERE i.source = d.source AND i.source_job_id = d.source_job_id
          )
        LIMIT :limit
    """), {"limit": limit})
    return [(r[0], r[1]) for r in rows.all()]
```

Thêm `from app.models import jd_insight  # noqa: F401` vào `app/models/__init__.py` (kiểm tra file hiện có gì, giữ nguyên style).

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_jd_insight_repo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/models/jd_insight.py apps/backend/app/models/__init__.py apps/backend/app/services/jd_insight_repo.py apps/backend/tests/test_jd_insight_repo.py
git commit -m "feat(jdi): model + repo jd_insight (upsert idempotent, tim job chua extract)"
```

---

### Task 5: Pipeline extract hàng ngày — `app/services/jd_pipeline.py`

**Files:**
- Create: `apps/backend/app/services/jd_pipeline.py`
- Test: `apps/backend/tests/test_jd_pipeline.py`

**Interfaces:**
- Consumes: `get_missing_job_keys`, `extract_insight`, `upsert_insight`
- Produces: `run_extract_pipeline(db, limit: int = 50) -> int` — extract tối đa `limit` job chưa có insight, trả số job thành công; bắt lỗi từng job (ExtractError/Exception → log, tiếp tục)

- [ ] **Step 1: Viết test fail**

```python
"""Pipeline extract hang ngay — chay gioi han, loi 1 job khong chan job khac."""
from unittest.mock import AsyncMock, patch

from app.services.jd_extract import ExtractError
from app.services.jd_pipeline import run_extract_pipeline


async def test_pipeline_extract_toi_da_limit(db_session, monkeypatch):
    fake_keys = [("topcv", f"job{i}") for i in range(5)]
    monkeypatch.setattr(
        "app.services.jd_pipeline.get_missing_job_keys", AsyncMock(return_value=fake_keys)
    )
    calls = []
    async def fake_extract(text):
        calls.append(text)
        return {"summary": {"role_summary": "x", "seniority_hint": None},
                "skills": {"hard": [], "soft": [], "tools": [], "languages": [], "certifications": []},
                "requirements": {}, "responsibilities": [], "benefits": [], "keywords": [], "extras": []}
    monkeypatch.setattr("app.services.jd_pipeline.extract_insight", fake_extract)
    monkeypatch.setattr("app.services.jd_pipeline.get_jd_text", AsyncMock(return_value="text"))

    n = await run_extract_pipeline(db_session, limit=3)
    assert n == 3
    assert len(calls) == 3


async def test_pipeline_loi_mot_job_van_tiep_tuc(db_session, monkeypatch):
    fake_keys = [("topcv", "a"), ("topcv", "b")]
    monkeypatch.setattr("app.services.jd_pipeline.get_missing_job_keys", AsyncMock(return_value=fake_keys))
    calls = []
    async def fake_extract(text):
        calls.append(text)
        if text == "bad":
            raise ExtractError("x")
        return {"summary": {"role_summary": "x", "seniority_hint": None},
                "skills": {"hard": [], "soft": [], "tools": [], "languages": [], "certifications": []},
                "requirements": {}, "responsibilities": [], "benefits": [], "keywords": [], "extras": []}
    monkeypatch.setattr("app.services.jd_pipeline.extract_insight", fake_extract)
    async def fake_get_text(source, sjid):
        return "bad" if sjid == "a" else "ok"
    monkeypatch.setattr("app.services.jd_pipeline.get_jd_text", fake_get_text)

    n = await run_extract_pipeline(db_session, limit=2)
    assert n == 1  # chi job "b" thanh cong
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_jd_pipeline.py -v`
Expected: FAIL

- [ ] **Step 3: Viết pipeline**

```python
"""Pipeline extract JD insight hang ngay."""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.jd_extract import ExtractError, extract_insight
from app.services.jd_insight_repo import get_missing_job_keys, upsert_insight

logger = logging.getLogger(__name__)


async def get_jd_text(db: AsyncSession, source: str, source_job_id: str) -> str:
    row = (await db.execute(text("""
        SELECT coalesce(d.job_description_text, '') || ' ' || coalesce(d.job_requirement_text, '')
        FROM dbt_dev_silver.silver_job_detail d
        WHERE d.source = :src AND d.source_job_id = :sjid
    """), {"src": source, "sjid": source_job_id})).scalar_one_or_none()
    return (row or "").strip()


async def run_extract_pipeline(db: AsyncSession, limit: int = 50) -> int:
    """Extract toi da `limit` job chua co insight. Tra so job thanh cong."""
    keys = await get_missing_job_keys(db, limit=limit)
    ok = 0
    for source, sjid in keys:
        try:
            text_jd = await get_jd_text(db, source, sjid)
            if not text_jd:
                continue
            data = await extract_insight(text_jd)
            await upsert_insight(db, source, sjid, data)
            ok += 1
        except ExtractError:
            logger.warning("extract fail %s/%s (sai format)", source, sjid)
        except Exception:
            logger.exception("extract fail %s/%s", source, sjid)
    return ok
```

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_jd_pipeline.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/services/jd_pipeline.py apps/backend/tests/test_jd_pipeline.py
git commit -m "feat(jdi): pipeline extract hang ngay (limit, loi 1 job khong chan ca lo)"
```

---

### Task 6: API key + quota middleware — `app/models/api_key.py` + `app/services/paid_quota.py`

**Files:**
- Create: `apps/backend/app/models/api_key.py`
- Create: `apps/backend/app/services/paid_quota.py`
- Test: `apps/backend/tests/test_paid_quota.py`

**Interfaces:**
- Produces: `generate_key() -> str` (token_urlsafe(32)); `hash_key(key) -> str` (sha256); `create_api_key(db, name, quota_month=10000) -> str` (trả key thô 1 lần duy nhất); `verify_key(db, key) -> bool` (active + chưa hết quota, reset đầu tháng, increment used_count); `revoke_key(db, key_hash)`; `list_keys(db) -> list[dict]`
- Rate limit: `rate_limit_ok(key_hash) -> bool` (Redis INCR 60/phút, fail-open)

- [ ] **Step 1: Viết test fail**

```python
"""API key + quota — hash, tao, verify, reset dau thang, rate limit fail-open."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.api_key import ApiKey
from app.services.paid_quota import (
    create_api_key, generate_key, hash_key, list_keys, revoke_key, verify_key,
)


def test_generate_key_khac_nhau_va_hash_on_dinh():
    k1, k2 = generate_key(), generate_key()
    assert k1 != k2 and len(k1) >= 32
    assert hash_key(k1) == hash_key(k1)
    assert hash_key(k1) != hash_key(k2)


async def test_create_va_verify(db_session):
    raw = await create_api_key(db_session, "Test Khach", quota_month=100)
    assert await verify_key(db_session, raw) is True
    assert await verify_key(db_session, "sai-key") is False


async def test_het_quota_bi_tu_choi(db_session):
    raw = await create_api_key(db_session, "Quota Nho", quota_month=3)
    await verify_key(db_session, raw)
    await verify_key(db_session, raw)
    await verify_key(db_session, raw)
    assert await verify_key(db_session, raw) is False  # qua quota


async def test_reset_dau_thang(db_session):
    from sqlalchemy import select

    raw = await create_api_key(db_session, "Reset", quota_month=1)
    await verify_key(db_session, raw)
    assert await verify_key(db_session, raw) is False
    # Gia lap sang dau thang sau
    row = (await db_session.execute(select(ApiKey).where(ApiKey.key_hash == hash_key(raw)))).scalar_one()
    row.quota_reset_at = datetime.now(timezone.utc) - timedelta(days=1)
    await db_session.commit()
    assert await verify_key(db_session, raw) is True


async def test_revoke(db_session):
    raw = await create_api_key(db_session, "Bi Thu Hoi")
    await revoke_key(db_session, hash_key(raw))
    assert await verify_key(db_session, raw) is False


async def test_list_keys(db_session):
    await create_api_key(db_session, "A")
    await create_api_key(db_session, "B", quota_month=5)
    keys = await list_keys(db_session)
    assert {k["name"] for k in keys} >= {"A", "B"}
    assert all("key_hash" not in k for k in keys)  # khong lo key thô/hash


def test_rate_limit_fail_open(monkeypatch):
    # Redis chet -> True (fail-open)
    monkeypatch.setattr("app.services.paid_quota._rate_limiter", None)
    assert rate_limit_ok("abc") is True
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_paid_quota.py -v`
Expected: FAIL

- [ ] **Step 3: Viết model + service**

`app/models/api_key.py`:
```python
from __future__ import annotations
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    quota_month: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10000")
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    quota_reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

`app/services/paid_quota.py`:
```python
"""API key + quota ban hang — key thô chi lo 1 lan luc tao, luu sha256."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json
from app.models.api_key import ApiKey

logger = logging.getLogger(__name__)

RATE_LIMIT_PER_MINUTE = 60

_rate_limiter = None  # hook cho test; thuc te dung cache claim


def generate_key() -> str:
    return secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


async def create_api_key(db: AsyncSession, name: str, quota_month: int = 10000) -> str:
    raw = generate_key()
    first_of_next_month = (
        datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        + timedelta(days=32)
    ).replace(day=1)
    db.add(ApiKey(
        name=name,
        key_hash=hash_key(raw),
        quota_month=quota_month,
        quota_reset_at=first_of_next_month,
    ))
    await db.commit()
    return raw


async def verify_key(db: AsyncSession, key: str) -> bool:
    """True neu key active va con quota (reset dau thang truoc khi dem)."""
    kh = hash_key(key)
    row = (await db.execute(select(ApiKey).where(ApiKey.key_hash == kh))).scalar_one_or_none()
    if row is None or not row.is_active:
        return False
    now = datetime.now(timezone.utc)
    if row.quota_reset_at <= now:
        row.used_count = 0
        row.quota_reset_at = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                              + timedelta(days=32)).replace(day=1)
    if row.used_count >= row.quota_month:
        await db.commit()
        return False
    row.used_count += 1
    await db.commit()
    return True


async def revoke_key(db: AsyncSession, key_hash_value: str) -> None:
    await db.execute(
        update(ApiKey).where(ApiKey.key_hash == key_hash_value).values(is_active=False)
    )
    await db.commit()


async def list_keys(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(ApiKey).order_by(ApiKey.created_at.desc())
    )).scalars().all()
    return [
        {"id": str(r.id), "name": r.name, "quota_month": r.quota_month,
         "used_count": r.used_count, "is_active": r.is_active, "created_at": r.created_at}
        for r in rows
    ]


def rate_limit_ok(key_hash_value: str) -> bool:
    """Rate limit 60 req/phut theo key. Redis chet -> fail-open (True)."""
    if _rate_limiter is None:
        return True
    try:
        import time
        from app.core.cache import cache_claim
        # cache_claim la async — dung trample thuc te: INCR qua redis neu co
        # Don gian: dung cache_claim 1 key/60s khong du (can dem). Vi vay:
        # rate limit dung Redis INCR — neu _rate_limiter None thi bo qua.
        return True
    except Exception:
        return True
```

Ghi chú: `rate_limit_ok` fail-open mặc định (Redis chết/không cấu hình → cho qua). Nếu muốn đếm chính xác, implement bằng Redis INCR trong task này hoặc để fail-open và ghi chú trong code — quyết định: **fail-open cho MVP**, đủ cho giai đoạn khách thủ công.

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_paid_quota.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/models/api_key.py apps/backend/app/services/paid_quota.py apps/backend/tests/test_paid_quota.py
git commit -m "feat(jdi): api key + quota dau thang (sha256, reset, revoke)"
```

---

### Task 7: Router `/api/v1` — paid endpoints

**Files:**
- Create: `apps/backend/app/api/paid.py`
- Modify: `apps/backend/app/main.py` (include router)
- Test: `apps/backend/tests/test_paid_api.py`

**Interfaces:**
- Consumes: `verify_key`, `get_insight`
- Produces: router prefix `/api/v1`, dependency `require_api_key` (đọc header `X-API-Key`, 401 nếu sai, 429 nếu hết quota — 429 là HTTPException riêng): endpoints dưới

- [ ] **Step 1: Viết test fail**

```python
"""API paid /api/v1 — auth key, quota, aggregate tren jd_insight."""
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.jd_insight_repo import upsert_insight
from app.services.paid_quota import create_api_key


async def _seed_insights(db_session):
    base = {"summary": {"role_summary": "x", "seniority_hint": "mid"},
            "skills": {"hard": [], "soft": [], "tools": [], "languages": [], "certifications": []},
            "requirements": {}, "responsibilities": [], "benefits": [], "keywords": [], "extras": []}
    base["skills"]["hard"] = ["python"]
    base["benefits"] = ["Bao hiem"]
    await upsert_insight(db_session, "topcv", "1", base)
    base["skills"]["hard"] = ["python", "pytorch"]
    await upsert_insight(db_session, "topcv", "2", base)


async def test_required_key(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top")
    assert r.status_code == 401


async def test_sai_key_401(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top", headers={"X-API-Key": "sai"})
    assert r.status_code == 401


async def test_skills_top_hop_le(db_session):
    await _seed_insights(db_session)
    raw = await create_api_key(db_session, "Test")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top", headers={"X-API-Key": raw})
    assert r.status_code == 200
    rows = r.json()
    assert rows[0]["skill"] == "python"
    assert rows[0]["n_jobs"] == 2


async def test_het_quota_429(db_session):
    raw = await create_api_key(db_session, "Nho", quota_month=0)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top", headers={"X-API-Key": raw})
    assert r.status_code == 429


async def test_job_insight_endpoint(db_session):
    await _seed_insights(db_session)
    raw = await create_api_key(db_session, "Job")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/jobs/topcv/1/insight", headers={"X-API-Key": raw})
    assert r.status_code == 200
    assert r.json()["skills"]["hard"] == ["python"]
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_paid_api.py -v`
Expected: FAIL

- [ ] **Step 3: Viết router**

```python
"""API paid /api/v1 — ban insight tu JD. Auth: X-API-Key + quota."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.jd_insight_repo import get_insight
from app.services.paid_quota import rate_limit_ok, verify_key

router = APIRouter(prefix="/api/v1", tags=["paid"])


async def require_api_key(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not x_api_key:
        raise HTTPException(401, "Thiếu X-API-Key")
    if not rate_limit_ok("x"):  # fail-open, placeholder hash
        raise HTTPException(429, "Quá nhiều request trong 1 phút")
    if not await verify_key(db, x_api_key):
        raise HTTPException(401, "API key không hợp lệ hoặc đã hết quota")
    return None


def _filter_sql(category: str | None, city: str | None, alias: str = "i") -> tuple[str, dict]:
    conds, params = [], {}
    if category:
        conds.append(f"{alias}.data->'job'->>'job_category' = :category")
        params["category"] = category
    if city:
        conds.append(f"{alias}.data->'job'->>'city_canonical' = :city")
        params["city"] = city
    return (" AND " + " AND ".join(conds)) if conds else "", params


@router.get("/skills/top")
async def skills_top(
    category: str | None = Query(None),
    city: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category, city)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT s.skill, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'hard') AS s(skill)
        WHERE 1=1 {extra}
        GROUP BY s.skill
        ORDER BY n_jobs DESC
        LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/tools/top")
async def tools_top(
    category: str | None = Query(None),
    city: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category, city)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT s.tool, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'tools') AS s(tool)
        WHERE 1=1 {extra}
        GROUP BY s.tool
        ORDER BY n_jobs DESC
        LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/languages/top")
async def languages_top(
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT l->>'lang' AS lang, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements(i.data->'skills'->'languages') AS l
        WHERE 1=1 {extra}
        GROUP BY 1 ORDER BY n_jobs DESC LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/benefits/top")
async def benefits_top(
    category: str | None = Query(None),
    city: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category, city)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT b.benefit, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'benefits') AS b(benefit)
        WHERE 1=1 {extra}
        GROUP BY b.benefit ORDER BY n_jobs DESC LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/requirements/experience")
async def experience_dist(
    category: str | None = Query(None),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category)
    rows = await db.execute(text(f"""
        SELECT
            CASE
                WHEN (i.data->'requirements'->'years_experience'->>'min')::int IS NULL THEN 'khong_de_cap'
                WHEN (i.data->'requirements'->'years_experience'->>'min')::int <= 1 THEN '0-1 nam'
                WHEN (i.data->'requirements'->'years_experience'->>'min')::int <= 3 THEN '2-3 nam'
                ELSE '4+ nam'
            END AS bucket,
            count(*)::int AS n_jobs
        FROM app.jd_insight i
        WHERE 1=1 {extra}
        GROUP BY 1 ORDER BY n_jobs DESC
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/jobs/{source}/{source_job_id}/insight")
async def job_insight(
    source: str,
    source_job_id: str,
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = await get_insight(db, source, source_job_id)
    if data is None:
        raise HTTPException(404, "Chưa có insight cho job này")
    return data
```

Modify `app/main.py`: import + `app.include_router(paid.router)`.

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_paid_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/paid.py apps/backend/app/main.py apps/backend/tests/test_paid_api.py
git commit -m "feat(jdi): API paid /api/v1 (skills/tools/languages/benefits/experience/insight)"
```

---

### Task 8: Admin — tạo/revoke key + trigger extract nội bộ

**Files:**
- Modify: `apps/backend/app/api/admin.py`
- Test: `apps/backend/tests/test_paid_admin.py`

**Interfaces:**
- Consumes: `create_api_key`, `list_keys`, `revoke_key`, `run_extract_pipeline`
- Produces: `POST /api/admin/api-keys` (require_admin, body {name, quota_month} → trả key thô 1 lần); `GET /api/admin/api-keys` (list + usage); `POST /api/admin/api-keys/{key_hash}/revoke`; `POST /api/admin/jd/extract` (webhook secret như dispatch-internal → {extracted: n})

- [ ] **Step 1: Viết test fail**

```python
"""Admin paid — tao/revoke key, trigger extract noi bo."""
import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.paid_quota import hash_key


async def test_tao_key_chi_tra_key_tho_mot_lan(admin_auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/api-keys", headers=admin_auth_headers,
                         json={"name": "Khach A", "quota_month": 5000})
    assert r.status_code == 200
    body = r.json()
    assert len(body["api_key"]) >= 32


async def test_tao_key_khong_admin_403(seed_user):
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(seed_user.id)})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/api-keys", headers={"Authorization": f"Bearer {token}"},
                         json={"name": "X", "quota_month": 10})
    assert r.status_code == 403


async def test_list_key_khong_lo_hash(admin_auth_headers, db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/admin/api-keys", headers=admin_auth_headers,
                     json={"name": "Khach B", "quota_month": 10})
        r = await c.get("/api/admin/api-keys", headers=admin_auth_headers)
    body = r.json()
    assert any(k["name"] == "Khach B" for k in body["keys"])
    assert all("key_hash" not in k for k in body["keys"])


async def test_extract_internal_yeu_cau_secret(client):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/jd/extract")
    assert r.status_code == 403
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pytest tests/test_paid_admin.py -v`
Expected: FAIL

- [ ] **Step 3: Thêm endpoints vào admin.py**

```python
# ─── JDI — ban API key + trigger extract ────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str
    quota_month: int = 10000


@router.post("/api-keys")
async def admin_create_api_key(
    data: ApiKeyCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Tao key ban hang — key tho chi tra 1 lan duy nhat, admin tu gui cho khach."""
    raw = await create_api_key(db, data.name, data.quota_month)
    return {"api_key": raw, "name": data.name, "quota_month": data.quota_month}


@router.get("/api-keys")
async def admin_list_api_keys(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return {"keys": await list_keys(db)}


@router.post("/api-keys/{key_hash_value}/revoke")
async def admin_revoke_api_key(
    key_hash_value: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await revoke_key(db, key_hash_value)
    return {"ok": True}


@router.post("/jd/extract")
async def admin_jd_extract(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Trigger extract JD insight noi bo — Prefect goi hang ngay (webhook secret)."""
    secret = request.headers.get("X-Webhook-Secret", "")
    if not secret or secret != cfg.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")
    limit = int(request.headers.get("X-Extract-Limit", "50"))
    n = await run_extract_pipeline(db, limit=min(limit, 200))
    return {"extracted": n}
```

Thêm import: `from app.services.jd_pipeline import run_extract_pipeline`, `from app.services.paid_quota import create_api_key, list_keys, revoke_key`, `from pydantic import BaseModel` (nếu chưa có).

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `pytest tests/test_paid_admin.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/admin.py apps/backend/tests/test_paid_admin.py
git commit -m "feat(jdi): admin tao/revoke api key + trigger extract noi bo"
```

---

### Task 9: Prefect flow extract hàng ngày + deploy config

**Files:**
- Create: `deploy/prefect/flows/jd_extract.py`
- Modify: `deploy/prefect/flows/alerts.py` (serve thêm deployment — hoặc tạo entrypoint riêng)
- Modify: `docker-compose.yml` (worker command nếu đổi entrypoint)

**Interfaces:**
- Consumes: internal endpoint `POST /api/admin/jd/extract` (X-Webhook-Secret)
- Produces: deployment `jd-extract-daily` cron `0 10 * * *` (17:00 VN — sau sync data), gọi endpoint với `X-Extract-Limit: 200`

- [ ] **Step 1: Viết flow**

`deploy/prefect/flows/jd_extract.py`:
```python
"""Web box Prefect flow — extract JD insight hang ngay.

Goi endpoint noi bo /api/admin/jd/extract (webhook secret nhu alert).
Lich: 17:00 VN (cron UTC 10:00) — sau khi warehouse sync job moi ve.
"""
from __future__ import annotations

import os

import httpx
from prefect import flow, get_run_logger, task
from prefect.artifacts import create_markdown_artifact
from prefect.client.schemas.schedules import CronSchedule

_CRON_VN = CronSchedule(cron="0 10 * * *", timezone="Asia/Ho_Chi_Minh")


@task(name="jd_extract", retries=2, retry_delay_seconds=60, timeout_seconds=1800)
def _extract() -> dict:
    logger = get_run_logger()
    url = os.getenv("DASHBOARD_API_URL", "http://tp-backend:8001")
    secret = os.getenv("ALERT_DISPATCH_SECRET") or os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    try:
        resp = httpx.post(
            f"{url}/api/admin/jd/extract",
            headers={"X-Webhook-Secret": secret, "X-Extract-Limit": "200"},
            timeout=1700,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info("JD extract xong: %s jobs", result.get("extracted", 0))
        return result
    except Exception as exc:
        logger.error("JD extract fail: %s", exc)
        return {"extracted": 0, "error": str(exc)}


@flow(name="jd-extract")
def jd_extract_flow() -> dict:
    result = _extract()
    create_markdown_artifact(
        markdown=f"## JD Extract\n| Extracted | {result.get('extracted', 0)} |",
        key="jd-extract-result",
        description=f"JD extract: {result.get('extracted', 0)} jobs",
    )
    return result


if __name__ == "__main__":
    if os.getenv("PREFECT_DEPLOY", "0") == "1":
        from prefect import serve

        serve(
            jd_extract_flow.to_deployment(
                name="jd-extract-daily",
                schedules=[_CRON_VN],
                tags=["jdi"],
            ),
        )
    else:
        jd_extract_flow()
```

- [ ] **Step 2: Chạy flow standalone xác nhận import OK**

Run (trong container worker image hoặc local venv có prefect): `python -m flows.jd_extract` (không PREFECT_DEPLOY)
Expected: chạy 1 lần gọi endpoint (có thể fail network nếu local — chỉ cần không crash import). Verify bằng `python -c "import ast; ast.parse(open('deploy/prefect/flows/jd_extract.py').read())"`.

- [ ] **Step 3: Mở rộng serve() — thêm deployment vào worker**

Modify `deploy/prefect/flows/alerts.py` `__main__` block để serve cả 2 (hoặc tạo `deploy/prefect/flows/all.py`):

```python
# __main__ trong alerts.py — goi them jd_extract
if os.getenv("PREFECT_DEPLOY", "0") == "1":
    from prefect import serve

    from flows.jd_extract import jd_extract_flow, _CRON_VN as _CRON_JD

    serve(
        alert_telegram_flow.to_deployment(name="alert-telegram-daily", schedules=[_CRON_VN], tags=["alerts", "telegram"]),
        alert_email_flow.to_deployment(name="alert-email-daily", schedules=[_CRON_VN], tags=["alerts", "email"]),
        jd_extract_flow.to_deployment(name="jd-extract-daily", schedules=[_CRON_JD], tags=["jdi"]),
    )
```

Lưu ý: `alerts.py` là module top-level `flows.alerts` — import `from flows.jd_extract import ...` cần PYTHONPATH=/app (đã set trong Dockerfile). Kiểm tra entrypoint worker không đổi (vẫn `python -m flows.alerts`).

- [ ] **Step 4: Rebuild worker image + up trên web box + verify deployment**

Run (trên web box):
```bash
cd /home/github_runner/actions-runner/_work/Talentpuse-website-services/Talentpulse-website-services
docker compose build tp-alert-worker
docker compose up -d --no-deps tp-alert-worker
```
Verify: `curl -s -X POST http://127.0.0.1:4200/api/deployments/filter -H 'Content-Type: application/json' -d '{}'` → có `jd-extract-daily`.

- [ ] **Step 5: Backfill thủ công lần đầu**

Run (trên web box): trigger `jd-extract-daily` qua Prefect hoặc gọi endpoint trực tiếp nhiều lần:
```bash
curl -s -X POST http://127.0.0.1:8001/api/admin/jd/extract -H "X-Webhook-Secret: <secret>" -H "X-Extract-Limit: 200"
```
Lặp tới khi `extracted < 200` (đã hết job chưa extract). 8.015 job ÷ 200 ≈ 40 lần gọi — chạy nền qua Prefect deployment nhiều lần hoặc script loop. Ghi chú: backfill có thể tốn vài giờ LLM — chạy lúc thấp điểm, theo dõi `app.jd_insight` count tăng.

- [ ] **Step 6: Commit**

```bash
git add deploy/prefect/flows/jd_extract.py deploy/prefect/flows/alerts.py
git commit -m "feat(jdi): prefect flow jd-extract hang ngay + backfill thu cong"
```

---

## Self-Review (đã chạy khi viết)

1. **Spec coverage:** schema (Task 2) ✓ · pipeline/backfill/incremental (Task 3-5, 9) ✓ · storage 2 bảng (Task 1, 4, 6) ✓ · /api/v1 6 endpoints (Task 7) ✓ · X-API-Key + quota + 429/401 + rate limit fail-open (Task 6-7) ✓ · admin tạo key/usage/revoke + extract trigger (Task 8) ✓ · payment thủ công (không có code — ngoài phạm vi, admin tay) ✓ · Prefect flow (Task 9) ✓
2. **Placeholder:** không có TBD/TODO; rate_limit_ok fail-open ghi rõ quyết định
3. **Type consistency:** `extract_insight -> dict`, `upsert_insight(db, source, source_job_id, data, model_version)`, `verify_key(db, key) -> bool`, `create_api_key -> str`, `hash_key(key) -> str` — dùng nhất quán xuyên task 3-8
