from __future__ import annotations

from mcp_server.repositories.base import BaseRepository
from mcp_server.schemas.analytics import (
    SystemStats,
    JobMarketOverview,
    JobOverview,
    CategoryCount,
    SalaryRow,
    CompanyRow,
)


class AnalyticsRepository(BaseRepository):

    async def system_stats(self) -> SystemStats:
        row = await self._fetchrow(
            """
            SELECT
                (SELECT count(*) FROM app.users)::int AS total_users,
                (SELECT count(*) FROM app.users WHERE is_active)::int AS active_users,
                (SELECT count(*) FROM app.telegram_connections
                 WHERE status = 'active')::int AS telegram_linked,
                (SELECT count(*) FROM app.alert_logs
                 WHERE sent_at >= CURRENT_DATE)::int AS alerts_today,
                (SELECT count(*) FROM app.alert_logs
                 WHERE sent_at >= date_trunc('week', CURRENT_DATE))::int AS alerts_this_week,
                (SELECT count(*) FROM app.alert_logs)::int AS total_alerts
            """
        )
        return SystemStats(**dict(row))

    async def job_market_overview(
        self,
        category: str | None = None,
        city: str | None = None,
    ) -> JobMarketOverview:
        conditions = ["is_active = true"]
        params: list = []
        if category:
            conditions.append(f"job_category = ${len(params) + 1}")
            params.append(category)
        if city:
            conditions.append(f"city_canonical = ${len(params) + 1}")
            params.append(city)
        where = " AND ".join(conditions)

        row = await self._fetchrow(
            f"""
            SELECT count(*)::int AS total_active_jobs,
                   ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
                   ROUND(MIN(salary_vnd_monthly_min) / 1000000.0, 1) AS min_salary_m,
                   ROUND(MAX(salary_vnd_monthly_max) / 1000000.0, 1) AS max_salary_m
            FROM dbt_dev_gold.fct_jobs_daily WHERE {where}
            """,
            *params,
        )
        cat_rows = await self._fetch(
            f"""
            SELECT job_category, NULL::text AS city_canonical, count(*)::int AS n_jobs
            FROM dbt_dev_gold.fct_jobs_daily WHERE {where}
            GROUP BY job_category ORDER BY n_jobs DESC LIMIT 10
            """,
            *params,
        )
        city_rows = await self._fetch(
            f"""
            SELECT NULL::text AS job_category, city_canonical, count(*)::int AS n_jobs
            FROM dbt_dev_gold.fct_jobs_daily WHERE {where}
            GROUP BY city_canonical ORDER BY n_jobs DESC LIMIT 10
            """,
            *params,
        )

        return JobMarketOverview(
            overview=JobOverview(**dict(row)),
            top_categories=[CategoryCount(**dict(r)) for r in cat_rows],
            top_cities=[CategoryCount(**dict(r)) for r in city_rows],
        )

    async def salary(
        self,
        job_level: str | None = None,
        city: str | None = None,
    ) -> list[SalaryRow]:
        conditions = ["salary_vnd_monthly_avg IS NOT NULL"]
        params: list = []
        if job_level:
            conditions.append(f"job_level = ${len(params) + 1}")
            params.append(job_level)
        if city:
            conditions.append(f"city_canonical = ${len(params) + 1}")
            params.append(city)
        where = " AND ".join(conditions)

        rows = await self._fetch(
            f"""
            SELECT job_level, city_canonical, count(*)::int AS n_jobs,
                ROUND((PERCENTILE_CONT(0.25) WITHIN GROUP
                       (ORDER BY salary_vnd_monthly_avg)) / 1000000.0, 1) AS p25_m,
                ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP
                       (ORDER BY salary_vnd_monthly_avg)) / 1000000.0, 1) AS p50_m,
                ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP
                       (ORDER BY salary_vnd_monthly_avg)) / 1000000.0, 1) AS p75_m
            FROM dbt_dev_gold.fct_jobs_daily WHERE {where}
            GROUP BY job_level, city_canonical
            ORDER BY p50_m DESC LIMIT 30
            """,
            *params,
        )
        return [SalaryRow(**dict(r)) for r in rows]

    async def top_companies(self, limit: int = 15) -> list[CompanyRow]:
        rows = await self._fetch(
            """
            SELECT company_name, count(*)::int AS active_jobs,
                   ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
                   mode() WITHIN GROUP (ORDER BY city_canonical) AS primary_city
            FROM dbt_dev_gold.fct_jobs_daily
            WHERE is_active AND company_name IS NOT NULL
            GROUP BY company_name ORDER BY active_jobs DESC LIMIT $1
            """,
            limit,
        )
        return [CompanyRow(**dict(r)) for r in rows]
