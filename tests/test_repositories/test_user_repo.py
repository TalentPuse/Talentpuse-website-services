import pytest

from tests.conftest import make_record
from mcp_server.repositories.user_repo import UserRepository


@pytest.fixture
def repo():
    return UserRepository()


class TestUserRepository:

    @pytest.mark.asyncio
    async def test_get_by_id_found(self, repo, mock_db):
        mock_db.fetchrow.return_value = make_record({
            "skills": ["python", "sql"],
            "desired_titles": ["Data Engineer"],
            "experience_level": "senior",
            "preferred_cities": ["Ho Chi Minh"],
            "desired_salary_min": 20000000,
            "desired_salary_max": 35000000,
        })

        result = await repo.get_by_id("user-123")

        assert result is not None
        assert result.skills == ["python", "sql"]
        assert result.desired_titles == ["Data Engineer"]
        assert result.experience_level == "senior"
        assert result.desired_salary_range == "20000000M - 35000000M VND"
        mock_db.fetchrow.assert_called_once()
        assert mock_db.fetchrow.call_args[0][1] == "user-123"

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, repo, mock_db):
        mock_db.fetchrow.return_value = None

        result = await repo.get_by_id("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_id_null_fields(self, repo, mock_db):
        mock_db.fetchrow.return_value = make_record({
            "skills": None,
            "desired_titles": None,
            "experience_level": None,
            "preferred_cities": None,
            "desired_salary_min": None,
            "desired_salary_max": None,
        })

        result = await repo.get_by_id("user-456")

        assert result is not None
        assert result.skills == []
        assert result.desired_titles == []
        assert result.desired_salary_range is None
