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


class TestSalaryBenchmark:

    @pytest.mark.asyncio
    async def test_returns_rows(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({
                "job_category": "AI Engineer", "job_level": "senior",
                "city_canonical": "Ho Chi Minh", "region": "South",
                "n_visible_jobs": 12,
                "p25_m": 20.0, "p50_m": 28.0, "p75_m": 38.0,
                "avg_salary_m": 29.5, "min_salary_m": 15.0, "max_salary_m": 50.0,
            }),
        ]

        result = await repo.salary_benchmark()

        assert len(result) == 1
        assert result[0].job_category == "AI Engineer"
        assert result[0].p50_m == 28.0
        assert result[0].n_visible_jobs == 12

    @pytest.mark.asyncio
    async def test_empty(self, repo, mock_db):
        mock_db.fetch.return_value = []

        result = await repo.salary_benchmark(job_category="AI Engineer")

        assert result == []

    @pytest.mark.asyncio
    async def test_with_all_filters_passes_params(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.salary_benchmark(
            job_category="AI Engineer", job_level="senior", city="Ho Chi Minh"
        )

        call_args = mock_db.fetch.call_args
        assert "AI Engineer" in call_args[0][1:]
        assert "senior" in call_args[0][1:]
        assert "Ho Chi Minh" in call_args[0][1:]

    @pytest.mark.asyncio
    async def test_no_filters_no_params(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.salary_benchmark()

        call_args = mock_db.fetch.call_args
        assert call_args[0][1:] == ()

    @pytest.mark.asyncio
    async def test_single_filter_binds_to_dollar_one(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.salary_benchmark(job_level="senior")

        call_args = mock_db.fetch.call_args
        query = call_args[0][0]
        assert "job_level = $1" in query
        assert "job_category = $1" not in query
        assert "city_canonical = $1" not in query
        assert call_args[0][1:] == ("senior",)

    @pytest.mark.asyncio
    async def test_partial_filters_bind_in_declaration_order(self, repo, mock_db):
        mock_db.fetch.return_value = []

        # job_category and city set, job_level omitted: numbering must not drift
        # to reserve a slot for the skipped job_level filter.
        await repo.salary_benchmark(job_category="AI Engineer", city="Ho Chi Minh")

        call_args = mock_db.fetch.call_args
        query = call_args[0][0]
        assert "job_category = $1" in query
        assert "city_canonical = $2" in query
        assert "job_level = $" not in query
        assert call_args[0][1:] == ("AI Engineer", "Ho Chi Minh")


class TestCompanyHiring:

    @pytest.mark.asyncio
    async def test_returns_rows(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({
                "company_id": 42, "company_name": "VNG Corporation",
                "company_size": "1000+", "company_size_label": "Large",
                "primary_city": "Ho Chi Minh", "primary_region": "South",
                "n_jobs": 8, "avg_views": 320.5, "avg_apps": 45.2,
                "avg_salary_m": 25.0, "min_salary_m": 12.0, "max_salary_m": 45.0,
                "last_seen_at": None, "snapshot_date": None,
            }),
        ]

        result = await repo.company_hiring(company_name="vng")

        assert len(result) == 1
        assert result[0].company_name == "VNG Corporation"
        assert result[0].n_jobs == 8

    @pytest.mark.asyncio
    async def test_empty_when_no_match(self, repo, mock_db):
        mock_db.fetch.return_value = []

        result = await repo.company_hiring(company_name="nonexistent-co")

        assert result == []

    @pytest.mark.asyncio
    async def test_uses_parameterised_ilike(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.company_hiring(company_name="FPT")

        call_args = mock_db.fetch.call_args
        query = call_args[0][0]
        assert "ILIKE" in query
        assert "FPT" not in query  # value must be a bound param, not concatenated into SQL
        assert call_args[0][1] == "FPT"

    @pytest.mark.asyncio
    async def test_escapes_percent_wildcard(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.company_hiring(company_name="100%")

        call_args = mock_db.fetch.call_args
        assert call_args[0][1] == "100\\%"  # literal percent, not a LIKE wildcard

    @pytest.mark.asyncio
    async def test_escapes_underscore_wildcard(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.company_hiring(company_name="a_b")

        call_args = mock_db.fetch.call_args
        assert call_args[0][1] == "a\\_b"  # literal underscore, not a single-char wildcard

    @pytest.mark.asyncio
    async def test_escapes_backslash_itself(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.company_hiring(company_name="a\\b")

        call_args = mock_db.fetch.call_args
        assert call_args[0][1] == "a\\\\b"  # backslash escaped before % / _ escaping

    @pytest.mark.asyncio
    async def test_query_declares_escape_char(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.company_hiring(company_name="FPT")

        query = mock_db.fetch.call_args[0][0]
        assert "ESCAPE" in query
