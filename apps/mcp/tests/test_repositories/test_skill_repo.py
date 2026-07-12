import pytest

from tests.conftest import make_record
from mcp_server.repositories.skill_repo import SkillRepository


@pytest.fixture
def repo():
    return SkillRepository()


class TestSkillGap:

    @pytest.mark.asyncio
    async def test_gap_returns_results(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({"skill": "pytorch", "skill_category": "ai_ml", "n_jobs": 45, "avg_salary_m": 28.0}),
            make_record({"skill": "langchain", "skill_category": "frameworks_libraries", "n_jobs": 32, "avg_salary_m": 35.0}),
        ]

        result = await repo.gap(exclude_skills=("python", "sql"))

        assert len(result) == 2
        assert result[0].skill == "pytorch"
        assert result[0].n_jobs == 45
        assert result[1].skill == "langchain"
        assert result[1].avg_salary_m == 35.0

    @pytest.mark.asyncio
    async def test_gap_empty(self, repo, mock_db):
        mock_db.fetch.return_value = []

        result = await repo.gap(exclude_skills=("python",))

        assert result == []

    @pytest.mark.asyncio
    async def test_gap_with_category_filter(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({"skill": "pytorch", "skill_category": "ai_ml", "n_jobs": 45, "avg_salary_m": 28.0}),
        ]

        result = await repo.gap(exclude_skills=("python",), category="ai_ml", limit=10)

        assert len(result) == 1
        # Verify category filter passed as $3 (args: exclude_skills, limit, category)
        call_args = mock_db.fetch.call_args
        assert call_args[0][3] == "ai_ml"

    @pytest.mark.asyncio
    async def test_gap_null_salary(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({"skill": "rust", "skill_category": "programming_languages", "n_jobs": 3, "avg_salary_m": None}),
        ]

        result = await repo.gap(exclude_skills=("python",))

        assert result[0].avg_salary_m is None


class TestSkillDemand:

    @pytest.mark.asyncio
    async def test_demand_returns_results(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({"skill": "python", "skill_category": "programming_languages", "n_jobs": 200, "pct_of_jobs": 45.5, "avg_salary_m": 22.0}),
        ]

        result = await repo.demand(limit=15)

        assert len(result) == 1
        assert result[0].skill == "python"
        assert result[0].pct_of_jobs == 45.5

    @pytest.mark.asyncio
    async def test_demand_with_category(self, repo, mock_db):
        mock_db.fetch.return_value = []

        await repo.demand(category="ai_ml", limit=10)

        call_args = mock_db.fetch.call_args
        assert call_args[0][2] == "ai_ml"


class TestSkillTrends:

    @pytest.mark.asyncio
    async def test_trends_basic(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({"skill": "rag", "skill_category": "ai_ml", "week": "2026-05-05", "n_jobs_that_week": 10, "avg_salary_m": 30.0}),
            make_record({"skill": "rag", "skill_category": "ai_ml", "week": "2026-05-12", "n_jobs_that_week": 15, "avg_salary_m": 32.0}),
            make_record({"skill": "llm", "skill_category": "ai_ml", "week": "2026-05-05", "n_jobs_that_week": 20, "avg_salary_m": 25.0}),
            make_record({"skill": "llm", "skill_category": "ai_ml", "week": "2026-05-12", "n_jobs_that_week": 18, "avg_salary_m": 24.0}),
        ]

        result = await repo.trends(weeks=2)

        assert len(result) == 2
        # rag trending up 50%, llm trending down -10%
        rag = next(r for r in result if r.skill == "rag")
        llm = next(r for r in result if r.skill == "llm")
        assert rag.trend_pct == 50.0
        assert rag.latest_jobs == 15
        assert llm.trend_pct == -10.0

    @pytest.mark.asyncio
    async def test_trends_no_data(self, repo, mock_db):
        mock_db.fetch.return_value = []

        result = await repo.trends()

        assert result == []

    @pytest.mark.asyncio
    async def test_trends_single_week_skipped(self, repo, mock_db):
        mock_db.fetch.return_value = [
            make_record({"skill": "rust", "skill_category": "programming_languages", "week": "2026-05-12", "n_jobs_that_week": 5, "avg_salary_m": 40.0}),
        ]

        result = await repo.trends()

        # Only 1 data point → skipped (needs >= 2 weeks)
        assert result == []
