from __future__ import annotations

from collections import defaultdict

from mcp_server.repositories.base import BaseRepository
from mcp_server.schemas.skill import SkillGapRow, SkillDemandRow, SkillTrend


class SkillRepository(BaseRepository):

    async def gap(
        self,
        exclude_skills: tuple[str, ...],
        limit: int = 20,
    ) -> list[SkillGapRow]:
        # Normalize to lowercase for case-insensitive exclusion
        lowered = tuple(s.lower() for s in exclude_skills)
        args: list = [lowered, limit]

        rows = await self._fetch(
            """
            SELECT skill, n_jobs,
                   ROUND(avg_salary_vnd / 1e6) AS avg_salary_m
            FROM dbt_dev_gold.mart_skill_demand
            WHERE n_jobs >= 3
              AND NOT (LOWER(skill) = ANY($1))
            ORDER BY n_jobs DESC
            LIMIT $2
            """,
            *args,
        )

        return [
            SkillGapRow(
                skill=r["skill"],
                skill_category="",
                n_jobs=r["n_jobs"],
                avg_salary_m=float(r["avg_salary_m"]) if r["avg_salary_m"] else None,
            )
            for r in rows
        ]

    async def demand(
        self,
        limit: int = 15,
    ) -> list[SkillDemandRow]:
        rows = await self._fetch(
            """
            SELECT skill, n_jobs,
                   ROUND(pct_of_jobs, 2) AS pct_of_jobs,
                   ROUND(avg_salary_vnd / 1e6) AS avg_salary_m
            FROM dbt_dev_gold.mart_skill_demand
            WHERE n_jobs >= 3
            ORDER BY n_jobs DESC LIMIT $1
            """,
            limit,
        )

        return [
            SkillDemandRow(
                skill=r["skill"],
                skill_category="",
                n_jobs=r["n_jobs"],
                pct_of_jobs=float(r["pct_of_jobs"]) if r["pct_of_jobs"] else None,
                avg_salary_m=float(r["avg_salary_m"]) if r["avg_salary_m"] else None,
            )
            for r in rows
        ]

    async def trends(self, weeks: int = 4, limit: int = 15) -> list[SkillTrend]:
        rows = await self._fetch(
            """
            SELECT skill, skill_category, week, n_jobs_that_week, avg_salary_m
            FROM dbt_dev_gold.mart_skill_trend
            WHERE week >= CURRENT_DATE - ($1 || ' weeks')::interval
            ORDER BY skill, week
            """,
            weeks,
        )

        if not rows:
            return []

        grouped: dict = defaultdict(lambda: {"weeks": [], "category": None})
        for r in rows:
            entry = grouped[r["skill"]]
            entry["category"] = r["skill_category"]
            entry["weeks"].append({
                "n_jobs": r["n_jobs_that_week"],
                "salary": float(r["avg_salary_m"]) if r["avg_salary_m"] else None,
            })

        results: list[SkillTrend] = []
        for skill, data in grouped.items():
            if len(data["weeks"]) < 2:
                continue
            first = data["weeks"][0]["n_jobs"]
            last = data["weeks"][-1]["n_jobs"]
            pct = round((last - first) / first * 100, 1) if first > 0 else 0
            results.append(SkillTrend(
                skill=skill,
                category=data["category"],
                trend_pct=pct,
                latest_jobs=last,
                latest_salary_m=data["weeks"][-1]["salary"],
            ))

        results.sort(key=lambda x: abs(x.trend_pct), reverse=True)
        return results[:limit]
