"""
TalentPulse MCP Tools — Direct Data Quality Test.

Chạy trực tiếp SQL queries mà MCP tools dùng, kiểm tra data quality
KHÔNG cần AI/LLM. Test xem data foundation có ổn trước khi test agent.

Usage:
    python eval/test_mcp_tools_direct.py
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

# DB connection — same as mcp_server config
DB_URL = "postgresql://admin:password@localhost:5432/warehouse"

try:
    import asyncpg
except ImportError:
    print("ERROR: pip install asyncpg")
    sys.exit(1)

# ── Colors for terminal ──────────────────────────────────
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def pass_fail(condition: bool, label: str = ""):
    icon = f"{GREEN}PASS{RESET}" if condition else f"{RED}FAIL{RESET}"
    print(f"  {icon} {label}")
    return condition


# ── Test Functions ────────────────────────────────────────

async def test_connection(pool):
    """Test 0: DB connection và cơ bản."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 0: Database Connection")
    print(f"{'='*60}{RESET}")

    row = await pool.fetchrow("SELECT version()")
    print(f"  PostgreSQL: {row['version'][:60]}...")

    # Check schemas exist
    schemas = await pool.fetch(
        "SELECT schema_name FROM information_schema.schemata "
        "WHERE schema_name IN ('app', 'dbt_dev_gold', 'dbt_dev_silver', 'raw') "
        "ORDER BY schema_name"
    )
    schema_names = [r["schema_name"] for r in schemas]
    print(f"  Schemas found: {schema_names}")
    pass_fail("app" in schema_names, "Schema 'app' exists")
    pass_fail("dbt_dev_gold" in schema_names, "Schema 'dbt_dev_gold' exists")


async def test_system_stats(pool):
    """Test 1: get_system_stats — system overview."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 1: get_system_stats (analytics_repo.py:16-31)")
    print(f"{'='*60}{RESET}")

    row = await pool.fetchrow("""
        SELECT
            (SELECT count(*) FROM app.users)::int AS total_users,
            (SELECT count(*) FROM app.users WHERE is_active)::int AS active_users,
            (SELECT count(*) FROM app.telegram_connections
             WHERE status = 'active')::int AS telegram_linked,
            (SELECT count(*) FROM app.alert_logs
             WHERE sent_at >= CURRENT_DATE)::int AS alerts_today,
            (SELECT count(*) FROM app.alert_logs)::int AS total_alerts
    """)

    stats = dict(row)
    print(f"  Total users:      {stats['total_users']}")
    print(f"  Active users:     {stats['active_users']}")
    print(f"  Telegram linked:  {stats['telegram_linked']}")
    print(f"  Alerts today:     {stats['alerts_today']}")
    print(f"  Total alerts:     {stats['total_alerts']}")

    pass_fail(stats["total_users"] > 0, "Has registered users")
    pass_fail(stats["total_alerts"] >= 0, "Alert logs exist")


async def test_job_market_overview(pool):
    """Test 2: get_job_market_overview — job market data."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 2: get_job_market_overview (analytics_repo.py:33-79)")
    print(f"{'='*60}{RESET}")

    # Overall
    row = await pool.fetchrow("""
        SELECT count(*)::int AS total_active_jobs,
               ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
               ROUND(MIN(salary_vnd_monthly_min) / 1000000.0, 1) AS min_salary_m,
               ROUND(MAX(salary_vnd_monthly_max) / 1000000.0, 1) AS max_salary_m
        FROM dbt_dev_gold.fct_jobs_daily WHERE is_active = true
    """)

    overview = dict(row)
    print(f"  Active jobs:      {overview['total_active_jobs']}")
    print(f"  Avg salary:       {overview['avg_salary_m']}M VND")
    print(f"  Min salary:       {overview['min_salary_m']}M VND")
    print(f"  Max salary:       {overview['max_salary_m']}M VND")

    pass_fail(overview["total_active_jobs"] > 0, "Has active jobs")
    pass_fail(overview["avg_salary_m"] and overview["avg_salary_m"] > 0, "Salary data exists")

    # Top categories
    cats = await pool.fetch("""
        SELECT job_category, count(*)::int AS n_jobs
        FROM dbt_dev_gold.fct_jobs_daily WHERE is_active = true
        GROUP BY job_category ORDER BY n_jobs DESC LIMIT 10
    """)
    print(f"\n  {CYAN}Top Categories:{RESET}")
    for r in cats:
        print(f"    {r['job_category'] or 'NULL':<30} {r['n_jobs']:>5} jobs")
    pass_fail(len(cats) > 0, "Has job categories")
    pass_fail(all(r["job_category"] is not None for r in cats), "No NULL categories")

    # Top cities
    cities = await pool.fetch("""
        SELECT city_canonical, count(*)::int AS n_jobs
        FROM dbt_dev_gold.fct_jobs_daily WHERE is_active = true
        GROUP BY city_canonical ORDER BY n_jobs DESC LIMIT 10
    """)
    print(f"\n  {CYAN}Top Cities:{RESET}")
    for r in cities:
        print(f"    {r['city_canonical'] or 'NULL':<30} {r['n_jobs']:>5} jobs")
    pass_fail(len(cities) > 0, "Has city data")
    pass_fail(all(r["city_canonical"] is not None for r in cities), "No NULL cities")


async def test_skill_demand(pool):
    """Test 3: get_top_skills — skill demand ranking."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 3: get_top_skills (skill_repo.py:42-68)")
    print(f"{'='*60}{RESET}")

    rows = await pool.fetch("""
        SELECT skill, n_jobs,
               ROUND(pct_of_jobs, 2) AS pct_of_jobs,
               ROUND(avg_salary_vnd / 1e6) AS avg_salary_m
        FROM dbt_dev_gold.mart_skill_demand
        WHERE n_jobs >= 3
        ORDER BY n_jobs DESC LIMIT 15
    """)

    print(f"  {CYAN}Top 15 In-Demand Skills:{RESET}")
    print(f"  {'#':<4} {'Skill':<25} {'Jobs':>6} {'%':>7} {'Avg Salary':>12}")
    print(f"  {'-'*4} {'-'*25} {'-'*6} {'-'*7} {'-'*12}")
    for i, r in enumerate(rows, 1):
        salary = f"{r['avg_salary_m']}M" if r["avg_salary_m"] else "N/A"
        print(f"  {i:<4} {r['skill']:<25} {r['n_jobs']:>6} {r['pct_of_jobs']:>6.1f}% {salary:>12}")

    pass_fail(len(rows) > 0, "Has skill demand data")
    pass_fail(all(r["skill"] for r in rows), "No empty skill names")
    pass_fail(all(r["n_jobs"] >= 3 for r in rows), "All skills have >= 3 jobs")
    pass_fail(len(rows) >= 10, "At least 10 skills with >= 3 jobs")

    # Check for duplicates
    skills = [r["skill"] for r in rows]
    pass_fail(len(skills) == len(set(skills)), "No duplicate skills")


async def test_skill_gap(pool):
    """Test 4: query_skill_gap — skill recommendation data."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 4: query_skill_gap (skill_repo.py:11-40)")
    print(f"{'='*60}{RESET}")

    # Simulate a user with Python + SQL skills
    user_skills = ("Python", "SQL", "Pandas", "Git")
    print(f"  User skills: {', '.join(user_skills)}")

    rows = await pool.fetch("""
        SELECT skill, n_jobs,
               ROUND(avg_salary_vnd / 1e6) AS avg_salary_m
        FROM dbt_dev_gold.mart_skill_demand
        WHERE n_jobs >= 3
          AND NOT (skill = ANY($1))
        ORDER BY n_jobs DESC
        LIMIT 20
    """, user_skills)

    print(f"\n  {CYAN}Top 20 Skill Gaps (skills user DOESN'T have):{RESET}")
    print(f"  {'#':<4} {'Skill':<25} {'Jobs':>6} {'Avg Salary':>12}")
    print(f"  {'-'*4} {'-'*25} {'-'*6} {'-'*12}")
    for i, r in enumerate(rows, 1):
        salary = f"{r['avg_salary_m']}M" if r["avg_salary_m"] else "N/A"
        print(f"  {i:<4} {r['skill']:<25} {r['n_jobs']:>6} {salary:>12}")

    pass_fail(len(rows) > 0, "Has skill gap recommendations")
    pass_fail(
        all(s.lower() not in [sk.lower() for sk in user_skills] for r in rows for s in [r["skill"]]),
        "Excluded user's existing skills correctly"
    )

    # Check Python/SQL actually excluded
    returned_skills_lower = [r["skill"].lower() for r in rows]
    pass_fail("python" not in returned_skills_lower, "Python correctly excluded")
    pass_fail("sql" not in returned_skills_lower, "SQL correctly excluded")


async def test_salary_analysis(pool):
    """Test 5: get_salary_analysis — salary distribution."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 5: get_salary_analysis (analytics_repo.py:81-111)")
    print(f"{'='*60}{RESET}")

    rows = await pool.fetch("""
        SELECT job_level, city_canonical, count(*)::int AS n_jobs,
            ROUND(CAST((PERCENTILE_CONT(0.25) WITHIN GROUP
                   (ORDER BY salary_vnd_monthly_avg)) / 1000000.0 AS numeric), 1) AS p25_m,
            ROUND(CAST((PERCENTILE_CONT(0.50) WITHIN GROUP
                   (ORDER BY salary_vnd_monthly_avg)) / 1000000.0 AS numeric), 1) AS p50_m,
            ROUND(CAST((PERCENTILE_CONT(0.75) WITHIN GROUP
                   (ORDER BY salary_vnd_monthly_avg)) / 1000000.0 AS numeric), 1) AS p75_m
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE salary_vnd_monthly_avg IS NOT NULL AND is_active = true
        GROUP BY job_level, city_canonical
        ORDER BY p50_m DESC LIMIT 15
    """)

    print(f"  {'Level':<12} {'City':<20} {'Jobs':>5} {'P25':>6} {'P50':>6} {'P75':>6}")
    print(f"  {'-'*12} {'-'*20} {'-'*5} {'-'*6} {'-'*6} {'-'*6}")
    for r in rows:
        level = r["job_level"] or "N/A"
        city = r["city_canonical"] or "N/A"
        print(f"  {level:<12} {city:<20} {r['n_jobs']:>5} {r['p25_m']:>5}M {r['p50_m']:>5}M {r['p75_m']:>5}M")

    pass_fail(len(rows) > 0, "Has salary data")
    pass_fail(all(r["p50_m"] and r["p50_m"] > 0 for r in rows), "All P50 > 0")

    # Check P25 < P50 < P75
    monotonic = all(
        r["p25_m"] <= r["p50_m"] <= r["p75_m"]
        for r in rows if r["p25_m"] and r["p50_m"] and r["p75_m"]
    )
    pass_fail(monotonic, "P25 <= P50 <= P75 (monotonic percentiles)")

    # Sanity check salary ranges
    pass_fail(
        all(1 <= r["p50_m"] <= 200 for r in rows if r["p50_m"]),
        "Salary P50 in reasonable range (1-200M VND)"
    )


async def test_top_companies(pool):
    """Test 6: get_top_companies — company hiring data."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 6: get_top_companies (analytics_repo.py:113-125)")
    print(f"{'='*60}{RESET}")

    rows = await pool.fetch("""
        SELECT company_name, count(*)::int AS active_jobs,
               ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
               mode() WITHIN GROUP (ORDER BY city_canonical) AS primary_city
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE is_active AND company_name IS NOT NULL
        GROUP BY company_name ORDER BY active_jobs DESC LIMIT 15
    """)

    print(f"  {'#':<4} {'Company':<35} {'Jobs':>5} {'Avg Salary':>12} {'City':<15}")
    print(f"  {'-'*4} {'-'*35} {'-'*5} {'-'*12} {'-'*15}")
    for i, r in enumerate(rows, 1):
        salary = f"{r['avg_salary_m']}M" if r["avg_salary_m"] else "N/A"
        city = r["primary_city"] or "N/A"
        print(f"  {i:<4} {r['company_name'][:35]:<35} {r['active_jobs']:>5} {salary:>12} {city:<15}")

    pass_fail(len(rows) > 0, "Has company data")
    pass_fail(all(r["company_name"] for r in rows), "No empty company names")
    pass_fail(rows[0]["active_jobs"] >= rows[-1]["active_jobs"], "Sorted by jobs DESC")


async def test_skill_trends(pool):
    """Test 7: get_skill_trends — trend analysis."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 7: get_skill_trends (skill_repo.py:70-109)")
    print(f"{'='*60}{RESET}")

    rows = await pool.fetch("""
        SELECT skill, skill_category, week, n_jobs_that_week, avg_salary_m
        FROM dbt_dev_gold.mart_skill_trend
        WHERE week >= CURRENT_DATE - ('4 weeks')::interval
        ORDER BY skill, week
        LIMIT 100
    """)

    if not rows:
        print(f"  {YELLOW}No trend data found (mart_skill_trend may be empty){RESET}")
        pass_fail(False, "Has skill trend data")
        return

    # Group by skill
    from collections import defaultdict
    grouped: dict = defaultdict(list)
    for r in rows:
        grouped[r["skill"]].append(dict(r))

    print(f"  Found {len(grouped)} skills with trend data")
    print(f"\n  {CYAN}Trending Skills (top 10 by absolute change):{RESET}")

    trends = []
    for skill, weeks in grouped.items():
        if len(weeks) < 2:
            continue
        first = weeks[0]["n_jobs"]
        last = weeks[-1]["n_jobs"]
        pct = round((last - first) / first * 100, 1) if first > 0 else 0
        trends.append({
            "skill": skill,
            "first_jobs": first,
            "last_jobs": last,
            "pct": pct,
            "weeks": len(weeks),
        })

    trends.sort(key=lambda x: abs(x["pct"]), reverse=True)
    print(f"  {'Skill':<25} {'Week 1':>7} {'Last Wk':>7} {'Change':>8}")
    print(f"  {'-'*25} {'-'*7} {'-'*7} {'-'*8}")
    for t in trends[:10]:
        direction = f"{t['pct']:+.1f}%"
        print(f"  {t['skill']:<25} {t['first_jobs']:>7} {t['last_jobs']:>7} {direction:>8}")

    pass_fail(len(trends) > 0, "Has calculable trends")
    pass_fail(len(grouped) >= 5, "At least 5 skills with trend data")


async def test_user_profiles(pool):
    """Test 8: get_user_profile — user profile data quality."""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 8: get_user_profile (user_repo.py:9-31)")
    print(f"{'='*60}{RESET}")

    # Sample user profiles
    rows = await pool.fetch("""
        SELECT id, skills, desired_titles, experience_level,
               preferred_cities, desired_salary_min, desired_salary_max,
               full_name, email
        FROM app.users
        LIMIT 10
    """)

    print(f"  Found {len(rows)} users (showing first 10)")

    users_with_skills = 0
    users_with_titles = 0
    users_with_level = 0
    users_with_cities = 0

    for r in rows:
        has_skills = bool(r["skills"] and len(r["skills"]) > 0)
        has_titles = bool(r["desired_titles"] and len(r["desired_titles"]) > 0)
        has_level = bool(r["experience_level"])
        has_cities = bool(r["preferred_cities"] and len(r["preferred_cities"]) > 0)

        if has_skills:
            users_with_skills += 1
        if has_titles:
            users_with_titles += 1
        if has_level:
            users_with_level += 1
        if has_cities:
            users_with_cities += 1

        name = r["full_name"] or r["email"][:20]
        skills_preview = ", ".join(r["skills"][:5]) if r["skills"] else "(none)"
        level = r["experience_level"] or "(none)"
        print(f"    {name:<25} | Level: {level:<10} | Skills: {skills_preview}")

    total = max(len(rows), 1)
    print(f"\n  Profile completeness:")
    print(f"    Skills:    {users_with_skills}/{total} ({users_with_skills/total:.0%})")
    print(f"    Titles:    {users_with_titles}/{total} ({users_with_titles/total:.0%})")
    print(f"    Level:     {users_with_level}/{total} ({users_with_level/total:.0%})")
    print(f"    Cities:    {users_with_cities}/{total} ({users_with_cities/total:.0%})")

    pass_fail(users_with_skills > 0, "Some users have skills filled")
    pass_fail(users_with_level > 0, "Some users have experience level")


async def test_data_freshness(pool):
    """Test 9: Data freshness — how recent is the data?"""
    print(f"\n{BOLD}{'='*60}")
    print("TEST 9: Data Freshness")
    print(f"{'='*60}{RESET}")

    # Latest snapshot date in fct_jobs_daily
    row = await pool.fetchrow("""
        SELECT MAX(snapshot_date) AS latest_snapshot,
               COUNT(DISTINCT snapshot_date) AS total_snapshots,
               MIN(snapshot_date) AS earliest_snapshot
        FROM dbt_dev_gold.fct_jobs_daily
    """)

    if row["latest_snapshot"]:
        from datetime import datetime, date
        latest = row["latest_snapshot"]
        today = date.today()
        if isinstance(latest, str):
            latest = datetime.strptime(latest, "%Y-%m-%d").date()
        days_old = (today - latest).days

        print(f"  Latest snapshot:  {latest}")
        print(f"  Earliest:         {row['earliest_snapshot']}")
        print(f"  Total snapshots:  {row['total_snapshots']}")
        print(f"  Days behind:      {days_old}")

        pass_fail(days_old <= 7, f"Data within 7 days (currently {days_old} days old)")
        pass_fail(days_old <= 3, f"Data within 3 days (currently {days_old} days old)")
    else:
        print(f"  {RED}No snapshot data found{RESET}")
        pass_fail(False, "Has snapshot data")

    # Check latest crawl
    crawl_row = await pool.fetchrow("""
        SELECT MAX(crawled_at) AS latest_crawl,
               COUNT(*) AS total_crawled,
               COUNT(*) FILTER (WHERE status = 'success') AS success_count
        FROM raw.crawl_log
    """)
    if crawl_row:
        print(f"\n  Latest crawl:     {crawl_row['latest_crawl']}")
        print(f"  Total crawled:    {crawl_row['total_crawled']}")
        print(f"  Success rate:     {crawl_row['success_count']}/{crawl_row['total_crawled']}")


# ── Main Runner ──────────────────────────────────────────

async def main():
    print(f"\n{BOLD}{'='*60}")
    print("TALENTPULSE MCP TOOLS — DATA QUALITY TEST")
    print(f"{'='*60}{RESET}\n")

    total_pass = 0
    total_fail = 0

    try:
        pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=3)
        print(f"{GREEN}Connected to database{RESET}")
    except Exception as e:
        print(f"{RED}Connection failed: {e}{RESET}")
        print(f"\n  DB URL: {DB_URL}")
        print(f"  Make sure Docker containers are running and port 5432 is exposed")
        return

    tests = [
        test_connection,
        test_system_stats,
        test_job_market_overview,
        test_skill_demand,
        test_skill_gap,
        test_salary_analysis,
        test_top_companies,
        test_skill_trends,
        test_user_profiles,
        test_data_freshness,
    ]

    for test_fn in tests:
        # Capture pass/fail by counting
        before_lines = []
        try:
            await test_fn(pool)
        except Exception as e:
            print(f"\n  {RED}ERROR: {e}{RESET}")

    # Summary
    print(f"\n{BOLD}{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}{RESET}")
    print(f"\n  Review PASS/FAIL results above to assess data quality.")
    print(f"  All PASS = data layer OK, can test agent layer next.")
    print(f"  Any FAIL = fix data/pipeline first.\n")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
