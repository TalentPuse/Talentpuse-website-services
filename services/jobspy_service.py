"""JobSpy service — wraps python-jobspy for real-time job search."""
from __future__ import annotations

import asyncio
import time
from typing import Sequence

import pandas as pd
from jobspy import scrape_jobs

from mcp_server.schemas.job_search import JobSearchResponse, JobSearchResult

_GLASSDOOR_VN_CITY = "Ho Chi Minh City"
_VIETNAM_ALIASES = {"vietnam", "vn"}


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
        try:
            import json

            parsed = json.loads(skills_raw)
            if isinstance(parsed, list):
                return [str(s) for s in parsed]
        except (json.JSONDecodeError, ValueError):
            return [s.strip() for s in skills_raw.split(",") if s.strip()]
    return None


def _map_row_to_result(row: pd.Series) -> JobSearchResult:
    salary_parts: list[str] = []
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
    """Synchronous wrapper for jobspy.scrape_jobs().

    Runs each source separately for correct geo-filtering:
    - LinkedIn: location param only (no country_indeed)
    - Indeed: country_indeed="vietnam" + location (city)
    - Glassdoor: city-level location for VN
    """
    frames: list[pd.DataFrame] = []
    source_errors: list[str] = []

    site_configs = {
        "linkedin": {
            "site_name": ["linkedin"],
            "location": location or "Vietnam",
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
                "linkedin_fetch_description": False,
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
    """Search real-time jobs via jobspy."""
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
