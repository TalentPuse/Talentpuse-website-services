import pytest

from tests.conftest import make_record
from mcp_server.repositories.analytics_repo import AnalyticsRepository


@pytest.fixture
def repo():
    return AnalyticsRepository()


class TestSystemStats:

    @pytest.mark.asyncio
    async def test_returns_stats(self, repo, mock_db):
        mock_db.fetchrow.return_value = make_record({
            "total_users": 50,
            "active_users": 40,
            "telegram_linked": 30,
            "alerts_today": 10,
            "alerts_this_week": 60,
            "total_alerts": 500,
        })

        result = await repo.system_stats()

        assert result.total_users == 50
        assert result.active_users == 40
        assert result.telegram_linked == 30
        assert result.alerts_today == 10


class TestJobMarketOverview:

    @pytest.mark.asyncio
    async def test_overview_no_filters(self, repo, mock_db):
        mock_db.fetchrow.return_value = make_record({
            "total_active_jobs": 500,
            "avg_salary_m": 22.5,
            "min_salary_m": 8.0,
            "max_salary_m": 60.0,
        })
        mock_db.fetch.side_effect = [
            [make_record({"job_category": "AI Engineer", "city_canonical": None, "n_jobs": 120})],
            [make_record({"job_category": None, "city_canonical": "Ho Chi Minh", "n_jobs": 300})],
        ]

        result = await repo.job_market_overview()

        assert result.overview.total_active_jobs == 500
        assert result.overview.avg_salary_m == 22.5
        assert len(result.top_categories) == 1
        assert result.top_categories[0].job_category == "AI Engineer"
        assert len(result.top_cities) == 1
        assert result.top_cities[0].city_canonical == "Ho Chi Minh"

    @pytest.mark.asyncio
    async def test_overview_with_filters(self, repo, mock_db):
        mock_db.fetchrow.return_value = make_record({
            "total_active_jobs": 120,
            "avg_salary_m": 28.0,
            "min_salary_m": 15.0,
            "max_salary_m": 50.0,
        })
        mock_db.fetch.side_effect = [[], []]

        result = await repo.job_market_overview(category="AI Engineer", city="Ho Chi Minh")

        assert result.overview.total_active_jobs == 120
        # Verify filters passed as params
        call_args = mock_db.fetchrow.call_args
        assert "AI Engineer" in call_args[0]
        assert "Ho Chi Minh" in call_args[0]


class TestSalary:

    @pytest.mark.asyncio
    async def test_salary_returns_rows(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({
                "job_level": "senior", "city_canonical": "HCM",
                "n_jobs": 20, "p25_m": 18.0, "p50_m": 25.0, "p75_m": 35.0,
            }),
        ]

        result = await repo.salary()

        assert len(result) == 1
        assert result[0].job_level == "senior"
        assert result[0].p50_m == 25.0

    @pytest.mark.asyncio
    async def test_salary_with_level_filter(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.salary(job_level="senior")

        call_args = mock_db.fetch.call_args
        assert "senior" in call_args[0][1:]


class TestTopCompanies:

    @pytest.mark.asyncio
    async def test_companies_returns_rows(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({
                "company_name": "VNG", "active_jobs": 15,
                "avg_salary_m": 22.0, "primary_city": "Ho Chi Minh",
            }),
            make_record({
                "company_name": "FPT", "active_jobs": 12,
                "avg_salary_m": 20.0, "primary_city": "Ha Noi",
            }),
        ]

        result = await repo.top_companies(limit=10)

        assert len(result) == 2
        assert result[0].company_name == "VNG"
        assert result[0].active_jobs == 15

    @pytest.mark.asyncio
    async def test_companies_empty(self, repo, mock_db):
        mock_db.fetch.return_value = []

        result = await repo.top_companies()

        assert result == []
