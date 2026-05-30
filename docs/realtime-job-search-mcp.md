# Real-time Job Search qua MCP Tool — Implementation Plan

> **Ngày**: 2026-05-24
> **Status**: Planning
> **Scope**: Tích hợp jobspy (LinkedIn/Indeed/Glassdoor scraper) vào MCP server để AI agent tìm job real-time

---

## 1. Context & Motivation

### Vấn đề

TalentPulse hiện tại chỉ có dữ liệu **lịch sử** từ pipeline crawl (VietnamWorks, ITviec, LinkedIn) chạy định kỳ qua Prefect (02:00 - 06:00 AM). Khi user hỏi AI "Có job Data Engineer nào không?", AI chỉ trả kết quả từ warehouse — không có dữ liệu real-time.

### Giải pháp

Tích hợp `python-jobspy` library (lấy từ JobOps open-source) trực tiếp vào MCP server hiện tại. User chat với AI → AI gọi MCP tool `search_jobs_realtime` → kết quả trả ngay trong chat.

### Tại sao không deploy JobOps riêng?

| Approach | Pros | Cons |
|----------|------|------|
| **Deploy JobOps Docker riêng** | Full features (scoring, tailoring, email tracking) | Nặng (Node.js + Python + Playwright), cần maintain thêm 1 platform |
| **Chỉ port jobspy vào MCP** (chọn) | Nhẹ, tận dụng infra sẵn, Python-to-Python, nhanh deploy | Không có AI scoring/tailoring của JobOps |

### Mục tiêu

```
User: "Tìm job Data Engineer ở HCM"
  → AI gọi search_jobs_realtime(query="Data Engineer", location="Ho Chi Minh City")
  → jobspy scrape LinkedIn VN + Indeed VN
  → Trả về 15 jobs trong chat dạng structured list
```

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                    USER CHAT                             │
│            "Tìm job AI Engineer ở HCM"                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│           Dashboard Backend (FastAPI)                     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │        LangChain Agent                          │     │
│  │                                                 │     │
│  │  Tools:                                        │     │
│  │  • query_skill_gap (existing)                  │     │
│  │  • search_jobs_realtime (NEW)  ──────┐         │     │
│  └──────────────────────────────────────┼──────────┘     │
│                                         │                │
│                          call_mcp_tool() │                │
│                                         ▼                │
│  ┌──────────────────────────────────────────────────┐    │
│  │       MCP Client (fastmcp.Client)                │    │
│  └──────────────────────────┬───────────────────────┘    │
└─────────────────────────────┼────────────────────────────┘
                              │ HTTP (streamable)
                              ▼
┌──────────────────────────────────────────────────────────┐
│           MCP Server (FastMCP, port 8080)                │
│                                                          │
│  NEW TOOL: search_jobs_realtime                         │
│    │                                                     │
│    ├── jobspy_service.search_jobs()                     │
│    │     └── asyncio.to_thread(scrape_jobs(...))        │
│    │            │                                        │
│    │            ▼                                        │
│    │     ┌──────────────────────────┐                   │
│    │     │  jobspy library          │                   │
│    │     │  • LinkedIn Vietnam      │                   │
│    │     │  • Indeed Vietnam        │                   │
│    │     │  • Glassdoor Vietnam     │                   │
│    │     └──────────────────────────┘                   │
│    │                                                     │
│    └── Returns JobSearchResponse (JSON)                 │
│                                                          │
│  EXISTING TOOLS:                                        │
│  • query_skill_gap, get_user_profile                    │
│  • get_system_stats, get_job_market_overview            │
│  • get_top_skills, get_salary_analysis                  │
│  • get_top_companies, get_skill_trends                  │
│  • run_alert_dispatch                                   │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User gửi message qua Chat API
2. Backend tạo/resume LangChain agent session
3. Agent nhận diện intent "tìm việc" → gọi tool search_jobs_realtime
4. MCP Client forward đến MCP Server
5. MCP Server gọi jobspy_service.search_jobs()
6. jobspy scrape LinkedIn + Indeed (async thread)
7. DataFrame → map → JobSearchResult[]
8. JSON trả về → Agent format thành chat response
9. User thấy danh sách jobs trong chat
```

---

## 3. Chi tiết Implementation

### Step 1: Install jobspy vào MCP server

**File sửa**: `mcp_server/requirements.txt`

```diff
  fastmcp>=2.0
  asyncpg>=0.30
  httpx>=0.27
  python-dotenv>=1.0
  pydantic>=2.0
  tenacity>=9.0
+ python-jobspy>=1.0
  pytest>=8.0
  pytest-asyncio>=0.24
```

**File sửa**: `mcp_server/Dockerfile` (nếu cần system deps cho jobspy)

```dockerfile
# jobspy cần các packages này (nếu chưa có)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
```

> **Note**: `python-jobspy` có dependencies: `pandas`, `playwright` (cho LinkedIn), `requests`. Playwright là optional — LinkedIn scraping qua jobspy dùng HTTP requests, không cần browser.

---

### Step 2: Config cho real-time search

**File sửa**: `mcp_server/config.py`

```python
# Thêm vào class Config:
JOBSPY_SITES: str = os.getenv("JOBSPY_SITES", "linkedin,indeed")
JOBSPY_DEFAULT_RESULTS: int = int(os.getenv("JOBSPY_DEFAULT_RESULTS", "20"))
JOBSPY_HOURS_OLD: int = int(os.getenv("JOBSPY_HOURS_OLD", "72"))      # 3 ngày
JOBSPY_TIMEOUT: int = int(os.getenv("JOBSPY_TIMEOUT", "60"))          # seconds
```

**File sửa**: `mcp_server/.env.example`

```bash
# JobSpy (Real-time Job Search)
JOBSPY_SITES=linkedin,indeed
JOBSPY_DEFAULT_RESULTS=20
JOBSPY_HOURS_OLD=72
JOBSPY_TIMEOUT=60
```

---

### Step 3: Pydantic Schemas

**File mới**: `mcp_server/schemas/job_search.py`

```python
"""Schemas for real-time job search via jobspy."""
from __future__ import annotations

from pydantic import BaseModel, Field


class JobSearchResult(BaseModel):
    """Single job result from real-time search."""

    title: str
    employer: str
    location: str | None = None
    salary: str | None = None
    job_url: str
    job_url_direct: str | None = None
    date_posted: str | None = None
    job_type: str | None = None
    job_level: str | None = None
    is_remote: bool | None = None
    description_snippet: str | None = Field(None, description="First 300 chars of description")
    source: str = Field(description="linkedin | indeed | glassdoor")
    skills: list[str] | None = None
    company_industry: str | None = None


class JobSearchResponse(BaseModel):
    """Response from real-time job search."""

    success: bool
    total_found: int
    jobs: list[JobSearchResult]
    source_errors: list[str] | None = None
    search_meta: dict = Field(
        description="query, location, sources used, time taken"
    )
```

---

### Step 4: JobSpy Service (Core Logic)

**File mới**: `mcp_server/services/__init__.py` (tạo thư mục services/ nếu chưa có)

**File mới**: `mcp_server/services/jobspy_service.py`

```python
"""JobSpy service — wraps python-jobspy for real-time job search."""
from __future__ import annotations

import asyncio
import time
from typing import Sequence

import pandas as pd
from jobspy import scrape_jobs

from mcp_server.schemas.job_search import JobSearchResponse, JobSearchResult


# Glassdoor needs city-level location for Vietnam
_GLASSDOOR_VN_CITY = "Ho Chi Minh City"
_VIETNAM_ALIASES = {"vietnam", "vn", "việt nam"}


def _build_description_snippet(description: str | None, max_len: int = 300) -> str | None:
    if not description:
        return None
    clean = " ".join(description.split())
    return clean[:max_len] + "..." if len(clean) > max_len else clean


def _parse_skills(skills_raw) -> list[str] | None:
    if skills_raw is None:
        return None
    if isinstance(skills_raw, list):
        return [str(s) for s in skills_raw]
    if isinstance(skills_raw, str):
        # jobspy trả JSON string hoặc comma-separated
        try:
            import json
            parsed = json.loads(skills_raw)
            if isinstance(parsed, list):
                return [str(s) for s in parsed]
        except (json.JSONDecodeError, ValueError):
            return [s.strip() for s in skills_raw.split(",") if s.strip()]
    return None


def _map_row_to_result(row: pd.Series) -> JobSearchResult:
    """Map một row từ jobspy DataFrame sang JobSearchResult."""
    salary_parts = []
    min_amt = row.get("min_amount")
    max_amt = row.get("max_amount")
    currency = row.get("currency")
    interval = row.get("interval")

    if pd.notna(min_amt) and pd.notna(max_amt):
        salary_parts.append(f"{currency} {int(min_amt)}-{int(max_amt)}")
    elif pd.notna(min_amt):
        salary_parts.append(f"{currency} {int(min_amt)}+")
    elif pd.notna(max_amt):
        salary_parts.append(f"{currency} {int(max_amt)}")

    if salary_parts and pd.notna(interval):
        salary_parts.append(f"/ {interval}")

    salary = " ".join(salary_parts) if salary_parts else None

    description = row.get("description")
    snippet = _build_description_snippet(
        description if pd.notna(description) else None
    )

    skills_raw = row.get("skills")
    skills = _parse_skills(skills_raw if pd.notna(skills_raw) else None)

    company_industry = row.get("company_industry")
    is_remote = row.get("is_remote")

    return JobSearchResult(
        title=str(row.get("title", "Unknown Title")),
        employer=str(row.get("company", "Unknown Employer")),
        location=str(row["location"]) if pd.notna(row.get("location")) else None,
        salary=salary,
        job_url=str(row["job_url"]),
        job_url_direct=str(row["job_url_direct"]) if pd.notna(row.get("job_url_direct")) else None,
        date_posted=str(row["date_posted"]) if pd.notna(row.get("date_posted")) else None,
        job_type=str(row["job_type"]) if pd.notna(row.get("job_type")) else None,
        job_level=str(row["job_level"]) if pd.notna(row.get("job_level")) else None,
        is_remote=bool(is_remote) if pd.notna(is_remote) else None,
        description_snippet=snippet,
        source=str(row.get("site", "unknown")).lower(),
        skills=skills,
        company_industry=str(company_industry) if pd.notna(company_industry) else None,
    )


def _sync_scrape_jobs(
    query: str,
    location: str,
    sources: Sequence[str],
    results_wanted: int,
    hours_old: int,
    is_remote: bool,
) -> tuple[pd.DataFrame, list[str]]:
    """
    Synchronous wrapper cho jobspy.scrape_jobs().

    Chạy từng site riêng để xử lý geo-filtering đúng:
    - LinkedIn: chỉ dùng location param (không dùng country_indeed)
    - Indeed: dùng country_indeed="vietnam" + location (city)
    - Glassdoor: dùng city-level location cho VN
    """
    frames: list[pd.DataFrame] = []
    source_errors: list[str] = []

    site_configs = {
        "linkedin": {
            "site_name": ["linkedin"],
            "location": location if location else "Vietnam",
            "country_indeed": None,
        },
        "indeed": {
            "site_name": ["indeed"],
            "location": location if location and location.lower() not in _VIETNAM_ALIASES else None,
            "country_indeed": "vietnam",
        },
        "glassdoor": {
            "site_name": ["glassdoor"],
            "location": _GLASSDOOR_VN_CITY if (not location or location.lower() in _VIETNAM_ALIASES) else location,
            "country_indeed": "vietnam",
        },
    }

    for source in sources:
        config = site_configs.get(source)
        if not config:
            continue

        try:
            kwargs: dict = {
                "site_name": config["site_name"],
                "search_term": query,
                "results_wanted": results_wanted,
                "hours_old": hours_old,
                "is_remote": is_remote,
                "linkedin_fetch_description": False,  # Faster without full descriptions
            }
            if config.get("location"):
                kwargs["location"] = config["location"]
            if config.get("country_indeed"):
                kwargs["country_indeed"] = config["country_indeed"]

            df = scrape_jobs(**kwargs)
            if not df.empty:
                frames.append(df)
        except Exception as e:
            source_errors.append(f"{source}: {e}")
            continue

    if frames:
        return pd.concat(frames, ignore_index=True), source_errors
    return pd.DataFrame(), source_errors


async def search_jobs(
    query: str,
    location: str = "Vietnam",
    sources: Sequence[str] = ("linkedin", "indeed"),
    results_wanted: int = 20,
    hours_old: int = 72,
    is_remote: bool = False,
    timeout: int = 60,
) -> JobSearchResponse:
    """
    Search real-time jobs via jobspy.

    Args:
        query: Search term (job title, keywords)
        location: Vietnam city or "Vietnam" for nationwide
        sources: Which sites to scrape ("linkedin", "indeed", "glassdoor")
        results_wanted: Max results per source
        hours_old: Only jobs posted within N hours
        is_remote: Filter remote-only
        timeout: Max seconds to wait

    Returns:
        JobSearchResponse with list of jobs and metadata
    """
    start_time = time.time()

    try:
        df, source_errors = await asyncio.wait_for(
            asyncio.to_thread(
                _sync_scrape_jobs,
                query=query,
                location=location,
                sources=list(sources),
                results_wanted=results_wanted,
                hours_old=hours_old,
                is_remote=is_remote,
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        return JobSearchResponse(
            success=False,
            total_found=0,
            jobs=[],
            source_errors=[f"Search timed out after {timeout}s"],
            search_meta={
                "query": query,
                "location": location,
                "sources": list(sources),
                "time_taken": timeout,
                "timeout": True,
            },
        )
    except Exception as e:
        return JobSearchResponse(
            success=False,
            total_found=0,
            jobs=[],
            source_errors=[str(e)],
            search_meta={
                "query": query,
                "location": location,
                "sources": list(sources),
                "time_taken": time.time() - start_time,
            },
        )

    # Deduplicate by job_url
    seen_urls: set[str] = set()
    jobs: list[JobSearchResult] = []
    if not df.empty:
        for _, row in df.iterrows():
            url = str(row.get("job_url", ""))
            if url in seen_urls:
                continue
            seen_urls.add(url)
            jobs.append(_map_row_to_result(row))

    elapsed = round(time.time() - start_time, 1)

    return JobSearchResponse(
        success=True,
        total_found=len(jobs),
        jobs=jobs,
        source_errors=source_errors or None,
        search_meta={
            "query": query,
            "location": location,
            "sources": list(sources),
            "results_per_source": results_wanted,
            "hours_old": hours_old,
            "time_taken_seconds": elapsed,
        },
    )
```

---

### Step 5: MCP Tool Definition

**File mới**: `mcp_server/tools/job_search.py`

```python
"""MCP Tool — Real-time job search via jobspy."""
from __future__ import annotations

from typing import Annotated

from fastmcp.tools import tool
from pydantic import Field
from tenacity import retry, stop_after_attempt, wait_exponential

from mcp_server.services.jobspy_service import search_jobs


@tool(tags={"search", "realtime"})
@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=2, max=15))
async def search_jobs_realtime(
    query: Annotated[
        str,
        Field(description="Job title or keyword to search, e.g. 'Data Engineer', 'AI Research', 'Python Developer'"),
    ],
    location: Annotated[
        str,
        Field(description="City or region in Vietnam: 'Ho Chi Minh City', 'Ha Noi', 'Da Nang', 'Vietnam' (nationwide)"),
    ] = "Vietnam",
    sources: Annotated[
        str,
        Field(description="Comma-separated job sites to search: 'linkedin', 'indeed', 'glassdoor'"),
    ] = "linkedin,indeed",
    results_wanted: Annotated[
        int,
        Field(description="Max results to return", ge=1, le=50),
    ] = 15,
    hours_old: Annotated[
        int,
        Field(description="Only return jobs posted within N hours", ge=1, le=720),
    ] = 72,
    is_remote: Annotated[
        bool,
        Field(description="Set true to filter remote-only jobs"),
    ] = False,
) -> str:
    """
    Search real-time jobs on LinkedIn, Indeed, and Glassdoor for Vietnam IT market.

    Returns job listings with title, company, salary, location, URL, and description snippet.
    Use this tool when the user asks to find jobs, search for positions, or wants current job openings.
    """
    source_list = [s.strip() for s in sources.split(",") if s.strip()]

    result = await search_jobs(
        query=query,
        location=location,
        sources=source_list,
        results_wanted=results_wanted,
        hours_old=hours_old,
        is_remote=is_remote,
    )

    return result.model_dump_json(ensure_ascii=False)
```

---

### Step 6: Register Tool vào MCP Server

**File sửa**: `mcp_server/server.py`

```python
# Thêm import (sau các import hiện có):
from mcp_server.tools.job_search import search_jobs_realtime  # noqa: E402

# Thêm register (sau các mcp.add_tool hiện có):
mcp.add_tool(search_jobs_realtime)

# Update instructions:
mcp = FastMCP(
    "TalentPulse",
    instructions=(
        "TalentPulse MCP Server — Vietnam IT/AI job market analytics.\n"
        "Use get_system_stats or get_job_market_overview for general queries.\n"
        "Use query_skill_gap for skill recommendations based on user profile.\n"
        "Use search_jobs_realtime to search real-time jobs on LinkedIn, Indeed, Glassdoor.\n"  # NEW
        "Use run_alert_dispatch to trigger job alert pipeline."
    ),
    lifespan=lifespan,
)
```

---

### Step 7: LangChain Tool (Dashboard Backend)

**File mới**: `dashboard/backend/app/services/agent/tools/job_search_tools.py`

```python
"""LangChain tools — Real-time job search via MCP."""
from langchain_core.tools import tool

from app.services.agent.services.mcp_client import call_mcp_tool


@tool
async def search_jobs_realtime(query: str, location: str = "Vietnam") -> str:
    """Search real-time job listings on LinkedIn, Indeed, and Glassdoor for Vietnam market.

    Use when user asks to find jobs, search for positions, wants current job openings,
    or asks "có job nào không", "tìm việc", "search job".

    Args:
        query: Job title or keywords (e.g. "Data Engineer", "Python Developer", "AI Research")
        location: City in Vietnam (e.g. "Ho Chi Minh City", "Ha Noi", "Da Nang") or "Vietnam" for nationwide.
    """
    return await call_mcp_tool("search_jobs_realtime", {
        "query": query,
        "location": location,
    })
```

---

### Step 8: Wire Tool vào Agent

**File sửa**: `dashboard/backend/app/services/agent/chains/skill_advisor_chain.py`

```python
# Thêm import:
from app.services.agent.tools.job_search_tools import search_jobs_realtime

# Sửa tools list:
_agent = create_agent(
    model=llm,
    tools=[query_skill_gap, search_jobs_realtime],  # thêm search_jobs_realtime
    system_prompt=SYSTEM_PROMPT,
    middleware=[inject_user_profile],
    context_schema=AgentContext,
)
```

---

### Step 9: Update System Prompt

**File sửa**: `dashboard/backend/app/services/agent/prompts/skill_advisor_prompt.py`

```python
SYSTEM_PROMPT = """Bạn là AI Career Advisor của TalentPulse, chuyên tư vấn kỹ năng \
và lộ trình nghề cho ngành AI/Data tại Việt Nam.

## Nguyên tắc
- Trả lời bằng tiếng Việt, ngắn gọn, actionable, data-driven
- Khi user hỏi về skills/nên học gì → PHẢI gọi tool `query_skill_gap` để lấy data thị trường
- Khi user hỏi tìm việc, search job, có job nào → PHẢI gọi tool `search_jobs_realtime`
- Thông tin user profile đã được cung cấp sẵn trong context — sử dụng trực tiếp, không cần hỏi user
- Phân tích 2 hướng: GenAI/Applied AI vs Machine Learning thuần
- Mỗi recommend kèm: lý do, sức hút thị trường (số jobs, lương), lộ trình 2-3 bước

## Format trả lời khi tìm việc (search_jobs_realtime)
1. Tóm tắt: "Tìm thấy X jobs trên LinkedIn + Indeed"
2. Danh sách top jobs (max 10):
   STT. **Job Title** tại Company | Location | Salary (nếu có)
   → [Link](url)
   💡 Mô tả ngắn (1 câu)
3. Nếu user hỏi kèm location cụ thể → truyền vào param location
4. Nếu user hỏi broadly → location="Vietnam"
5. Giới hạn 15 kết quả mặc định

## Format trả lời khi recommend skills
1. Phân tích background user
2. Suggest hướng phù hợp (GenAI vs ML)
3. TOP 5 skills cần học, mỗi skill: lý do + market demand + learning path
4. Priority: must_have > should_have > nice_to_have
"""
```

---

### Step 10: Tests

#### MCP Server Tests

**File mới**: `mcp_server/tests/test_tools/test_job_search.py`

```python
"""Tests for search_jobs_realtime MCP tool."""
import json
from unittest.mock import AsyncMock, patch

import pandas as pd
import pytest

from mcp_server.services.jobspy_service import (
    _map_row_to_result,
    search_jobs,
)


def _make_df(rows: list[dict]) -> pd.DataFrame:
    defaults = {
        "title": "Data Engineer",
        "company": "Test Corp",
        "location": "Ho Chi Minh City",
        "job_url": "https://example.com/job/1",
        "job_url_direct": None,
        "date_posted": "2026-05-20",
        "job_type": "Full-time",
        "job_level": "Mid",
        "is_remote": False,
        "description": "Test description",
        "site": "linkedin",
        "min_amount": None,
        "max_amount": None,
        "currency": None,
        "interval": None,
        "skills": None,
        "company_industry": None,
    }
    for row in rows:
        for k, v in defaults.items():
            row.setdefault(k, v)
    return pd.DataFrame(rows)


@pytest.mark.asyncio
async def test_search_jobs_returns_results():
    mock_df = _make_df([
        {"title": "AI Engineer", "company": "VNG", "job_url": "https://li.com/1", "site": "linkedin"},
        {"title": "Data Scientist", "company": "FPT", "job_url": "https://indeed.com/2", "site": "indeed"},
    ])

    with patch("mcp_server.services.jobspy_service.scrape_jobs", return_value=mock_df):
        result = await search_jobs(query="AI Engineer", location="Ho Chi Minh City")

    assert result.success is True
    assert result.total_found == 2
    assert len(result.jobs) == 2
    assert result.jobs[0].title == "AI Engineer"
    assert result.jobs[0].employer == "VNG"


@pytest.mark.asyncio
async def test_search_jobs_empty_results():
    empty_df = pd.DataFrame()
    with patch("mcp_server.services.jobspy_service.scrape_jobs", return_value=empty_df):
        result = await search_jobs(query="Nonexistent Job")

    assert result.success is True
    assert result.total_found == 0
    assert result.jobs == []


@pytest.mark.asyncio
async def test_search_jobs_deduplication():
    mock_df = _make_df([
        {"job_url": "https://same.com/1", "title": "Job A"},
        {"job_url": "https://same.com/1", "title": "Job A Duplicate"},
    ])
    with patch("mcp_server.services.jobspy_service.scrape_jobs", return_value=mock_df):
        result = await search_jobs(query="Test")

    assert result.total_found == 1


@pytest.mark.asyncio
async def test_search_jobs_timeout():
    import asyncio

    def slow_scrape(**kwargs):
        import time
        time.sleep(10)
        return pd.DataFrame()

    with patch("mcp_server.services.jobspy_service.scrape_jobs", side_effect=slow_scrape):
        result = await search_jobs(query="Test", timeout=1)

    assert result.success is False
    assert "timed out" in result.source_errors[0].lower()


@pytest.mark.asyncio
async def test_search_jobs_source_error_graceful():
    def fail_scrape(**kwargs):
        raise RuntimeError("LinkedIn blocked")

    with patch("mcp_server.services.jobspy_service.scrape_jobs", side_effect=fail_scrape):
        result = await search_jobs(query="Test", sources=["linkedin", "indeed"])

    assert result.success is False


def test_map_row_salary_formatting():
    row = pd.Series({
        "title": "Engineer",
        "company": "Test",
        "job_url": "https://x.com/1",
        "location": "HCM",
        "site": "indeed",
        "min_amount": 20000000,
        "max_amount": 35000000,
        "currency": "VND",
        "interval": "monthly",
    })
    result = _map_row_to_result(row)
    assert "VND" in result.salary
    assert "20000000" in result.salary
```

#### LangChain Tool Tests

**File mới**: `dashboard/backend/tests/test_agent/test_job_search_tool.py`

```python
"""Tests for search_jobs_realtime LangChain tool."""
import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent.tools.job_search_tools import search_jobs_realtime


@pytest.mark.asyncio
async def test_search_jobs_realtime_calls_mcp():
    mock_response = json.dumps({
        "success": True,
        "total_found": 2,
        "jobs": [
            {"title": "AI Engineer", "employer": "VNG", "location": "HCM"},
            {"title": "Data Engineer", "employer": "FPT", "location": "HN"},
        ],
        "source_errors": None,
        "search_meta": {"query": "AI", "location": "Vietnam"},
    })

    with patch(
        "app.services.agent.tools.job_search_tools.call_mcp_tool",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await search_jobs_realtime.ainvoke({"query": "AI Engineer", "location": "Vietnam"})

    assert "AI Engineer" in result
    assert "VNG" in result
```

---

## 4. Files Tổng hợp

### Files mới (6 files):

| # | File | Mô tả |
|---|------|--------|
| 1 | `mcp_server/schemas/job_search.py` | Pydantic schemas cho search request/response |
| 2 | `mcp_server/services/jobspy_service.py` | Core search logic wrapping jobspy |
| 3 | `mcp_server/tools/job_search.py` | MCP tool definition |
| 4 | `mcp_server/tests/test_tools/test_job_search.py` | MCP tool tests |
| 5 | `dashboard/backend/app/services/agent/tools/job_search_tools.py` | LangChain tool wrapper |
| 6 | `dashboard/backend/tests/test_agent/test_job_search_tool.py` | LangChain tool tests |

### Files sửa (6 files):

| # | File | Thay đổi |
|---|------|----------|
| 1 | `mcp_server/requirements.txt` | Thêm `python-jobspy>=1.0` |
| 2 | `mcp_server/config.py` | Thêm JOBSPY_* settings |
| 3 | `mcp_server/server.py` | Register tool mới + update instructions |
| 4 | `dashboard/backend/app/services/agent/chains/skill_advisor_chain.py` | Wire tool vào agent |
| 5 | `dashboard/backend/app/services/agent/prompts/skill_advisor_prompt.py` | Update system prompt |
| 6 | `mcp_server/Dockerfile` | Thêm system deps nếu cần |

---

## 5. Vietnam-specific Config

### Location Mapping cho jobspy

```python
# Khi user nói:
"Ho Chi Minh City" / "HCM" / "TP.HCM"  → location="Ho Chi Minh City"
"Ha Noi" / "Hà Nội"                     → location="Ha Noi"
"Da Nang" / "Đà Nẵng"                   → location="Da Nang"
"Vietnam" / "toàn quốc"                 → location="Vietnam"

# jobspy config per source:
LinkedIn:   location=user_input (hoặc "Vietnam"),  country_indeed=None
Indeed:     location=user_input (city only),        country_indeed="vietnam"
Glassdoor:  location="Ho Chi Minh City" (fallback), country_indeed="vietnam"
```

### Supported Sources cho Vietnam

| Source | Vietnam Support | Notes |
|--------|----------------|-------|
| **LinkedIn** | Yes | Works well, returns quality results |
| **Indeed** | Yes | country_indeed="vietnam" required |
| **Glassdoor** | Limited | Needs city-level location, fewer VN jobs |

---

## 6. Verification Plan

### Step-by-step Testing

1. **Install check**:
   ```bash
   cd mcp_server && pip install python-jobspy && python -c "from jobspy import scrape_jobs; print('OK')"
   ```

2. **Unit tests**:
   ```bash
   cd mcp_server && pytest tests/test_tools/test_job_search.py -v
   cd dashboard/backend && pytest tests/test_agent/test_job_search_tool.py -v
   ```

3. **MCP server manual test**:
   ```bash
   # Start MCP server
   cd mcp_server && python -m mcp_server.server

   # Test qua MCP client
   python -c "
   import asyncio
   from fastmcp import Client
   async def test():
       async with Client('http://localhost:8080/mcp') as c:
           result = await c.call_tool('search_jobs_realtime', {
               'query': 'Data Engineer',
               'location': 'Ho Chi Minh City'
           })
           print(result)
   asyncio.run(test())
   "
   ```

4. **End-to-end test qua chat**:
   - Mở TalentPulse dashboard → Assistant page
   - Chat: "Tìm job Data Engineer ở HCM cho tôi"
   - Verify: AI trả về danh sách jobs từ LinkedIn + Indeed

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **jobspy bị rate limit/block** | Search fail | Medium | Retry 2 lần + timeout 60s + max 50 results |
| **Scraping chậm (15-30s)** | UX kém | High | `linkedin_fetch_description=False`, AI báo "đang tìm..." |
| **LinkedIn không trả VN results** | Ít jobs | Low | Fallback Indeed VN, log source_errors |
| **python-jobspy deps conflict** | Install fail | Low | Test trong Docker build, pin version |
| **jobspy sync block async loop** | Server hang | High | `asyncio.to_thread()` + timeout |
| **Glassdoor không cover VN** | Missing source | High | Default sources = "linkedin,indeed" (bỏ glassdoor) |

---

## 8. Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Infrastructure** | 30 min | Install jobspy, config, schemas |
| **Core Service** | 1 hr | jobspy_service.py với geo-handling |
| **MCP Tool** | 30 min | Tool definition + register |
| **LangChain Integration** | 30 min | Tool wrapper + agent wiring + prompt |
| **Tests** | 1 hr | Unit tests + integration tests |
| **Total** | **~3.5 hrs** | |

---

## 9. Future Enhancements (Out of Scope)

- [ ] **Job alert from real-time search**: Lưu search query, chạy định kỳ, notify qua Telegram khi có job mới
- [ ] **AI scoring**: Chấm điểm suitability cho mỗi real-time job dựa trên user profile
- [ ] **Cache layer**: Cache results 30 phút để tránh gọi lại nếu user hỏi cùng query
- [ ] **Glassdoor reviews**: Pull company ratings/reviews từ Glassdoor
- [ ] **Salary normalization**: Convert salary về VND monthly để so sánh
- [ ] **Integration với pipeline_data**: Lưu real-time jobs vào warehouse để enrich analytics
