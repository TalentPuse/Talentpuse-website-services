import pytest
from unittest.mock import AsyncMock, patch

from mcp_server.schemas.analytics import (
    SystemStats,
    JobOverview,
    CategoryCount,
    SalaryRow,
    CompanyRow,
    JobMarketOverview,
)
from mcp_server.schemas.skill import SkillDemandRow, SkillTrend


class TestGetSystemStatsTool:

    @pytest.mark.asyncio
    async def test_returns_json(self):
        from mcp_server.tools.analytics import get_system_stats

        stats = SystemStats(
            total_users=100,
            active_users=80,
            telegram_linked=50,
            alerts_today=12,
            alerts_this_week=70,
            total_alerts=800,
        )

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.system_stats = AsyncMock(return_value=stats)
            result = await get_system_stats()

        assert '"total_users":100' in result
        assert '"active_users":80' in result
        assert '"alerts_today":12' in result


class TestGetJobMarketOverviewTool:

    @pytest.mark.asyncio
    async def test_overview_no_filters(self):
        from mcp_server.tools.analytics import get_job_market_overview

        overview = JobMarketOverview(
            overview=JobOverview(total_active_jobs=500, avg_salary_m=22.5),
            top_categories=[CategoryCount(job_category="AI Engineer", n_jobs=120)],
            top_cities=[CategoryCount(city_canonical="Ho Chi Minh", n_jobs=300)],
        )

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.job_market_overview = AsyncMock(return_value=overview)
            result = await get_job_market_overview()

        assert '"total_active_jobs":500' in result
        assert '"AI Engineer"' in result
        assert '"Ho Chi Minh"' in result

    @pytest.mark.asyncio
    async def test_overview_with_filters(self):
        from mcp_server.tools.analytics import get_job_market_overview

        overview = JobMarketOverview(
            overview=JobOverview(total_active_jobs=120),
            top_categories=[],
            top_cities=[],
        )

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.job_market_overview = AsyncMock(return_value=overview)
            result = await get_job_market_overview(category="AI Engineer", city="Ho Chi Minh")

        assert '"total_active_jobs":120' in result
        mock_repo.job_market_overview.assert_called_once_with(
            category="AI Engineer", city="Ho Chi Minh"
        )


class TestGetTopSkillsTool:

    @pytest.mark.asyncio
    async def test_returns_json_array(self):
        from mcp_server.tools.analytics import get_top_skills

        rows = [
            SkillDemandRow(
                skill="python",
                skill_category="programming_languages",
                n_jobs=200,
                pct_of_jobs=45.5,
                avg_salary_m=22.0,
            ),
            SkillDemandRow(
                skill="docker",
                skill_category="devops",
                n_jobs=150,
                pct_of_jobs=34.0,
                avg_salary_m=25.0,
            ),
        ]

        with patch("mcp_server.tools.analytics._skill_repo") as mock_repo:
            mock_repo.demand = AsyncMock(return_value=rows)
            result = await get_top_skills()

        assert '"python"' in result
        assert '"docker"' in result
        assert '"pct_of_jobs":45.5' in result

    @pytest.mark.asyncio
    async def test_empty(self):
        from mcp_server.tools.analytics import get_top_skills

        with patch("mcp_server.tools.analytics._skill_repo") as mock_repo:
            mock_repo.demand = AsyncMock(return_value=[])
            result = await get_top_skills()

        assert result == "[]"

    @pytest.mark.asyncio
    async def test_with_category_filter(self):
        from mcp_server.tools.analytics import get_top_skills

        with patch("mcp_server.tools.analytics._skill_repo") as mock_repo:
            mock_repo.demand = AsyncMock(return_value=[])
            await get_top_skills(category="ai_ml", limit=10)

        mock_repo.demand.assert_called_once_with(category="ai_ml", limit=10)


class TestGetSalaryAnalysisTool:

    @pytest.mark.asyncio
    async def test_returns_salary_rows(self):
        from mcp_server.tools.analytics import get_salary_analysis

        rows = [
            SalaryRow(
                job_level="senior",
                city_canonical="HCM",
                n_jobs=20,
                p25_m=18.0,
                p50_m=25.0,
                p75_m=35.0,
            ),
        ]

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.salary = AsyncMock(return_value=rows)
            result = await get_salary_analysis()

        assert '"senior"' in result
        assert '"p50_m":25.0' in result

    @pytest.mark.asyncio
    async def test_with_level_filter(self):
        from mcp_server.tools.analytics import get_salary_analysis

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.salary = AsyncMock(return_value=[])
            await get_salary_analysis(job_level="senior", city="Ho Chi Minh")

        mock_repo.salary.assert_called_once_with(job_level="senior", city="Ho Chi Minh")


class TestGetTopCompaniesTool:

    @pytest.mark.asyncio
    async def test_returns_companies(self):
        from mcp_server.tools.analytics import get_top_companies

        rows = [
            CompanyRow(company_name="VNG", active_jobs=15, avg_salary_m=22.0, primary_city="Ho Chi Minh"),
            CompanyRow(company_name="FPT", active_jobs=12, avg_salary_m=20.0, primary_city="Ha Noi"),
        ]

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.top_companies = AsyncMock(return_value=rows)
            result = await get_top_companies()

        assert '"VNG"' in result
        assert '"FPT"' in result
        assert '"active_jobs":15' in result

    @pytest.mark.asyncio
    async def test_empty(self):
        from mcp_server.tools.analytics import get_top_companies

        with patch("mcp_server.tools.analytics._analytics_repo") as mock_repo:
            mock_repo.top_companies = AsyncMock(return_value=[])
            result = await get_top_companies()

        assert result == "[]"


class TestGetSkillTrendsTool:

    @pytest.mark.asyncio
    async def test_returns_trends(self):
        from mcp_server.tools.analytics import get_skill_trends

        rows = [
            SkillTrend(skill="rag", category="ai_ml", trend_pct=50.0, latest_jobs=15, latest_salary_m=32.0),
            SkillTrend(skill="llm", category="ai_ml", trend_pct=-10.0, latest_jobs=18, latest_salary_m=24.0),
        ]

        with patch("mcp_server.tools.analytics._skill_repo") as mock_repo:
            mock_repo.trends = AsyncMock(return_value=rows)
            result = await get_skill_trends()

        assert '"rag"' in result
        assert '"trend_pct":50.0' in result
        assert '"trend_pct":-10.0' in result

    @pytest.mark.asyncio
    async def test_no_data(self):
        from mcp_server.tools.analytics import get_skill_trends

        with patch("mcp_server.tools.analytics._skill_repo") as mock_repo:
            mock_repo.trends = AsyncMock(return_value=[])
            result = await get_skill_trends()

        assert "No trend data" in result

    @pytest.mark.asyncio
    async def test_with_params(self):
        from mcp_server.tools.analytics import get_skill_trends

        with patch("mcp_server.tools.analytics._skill_repo") as mock_repo:
            mock_repo.trends = AsyncMock(return_value=[])
            await get_skill_trends(weeks=2, limit=5)

        mock_repo.trends.assert_called_once_with(weeks=2, limit=5)
