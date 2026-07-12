import pytest
from unittest.mock import AsyncMock, patch

from mcp_server.schemas.user import UserProfile
from mcp_server.schemas.skill import SkillGapRow


class TestQuerySkillGapTool:

    @pytest.mark.asyncio
    async def test_returns_formatted_output(self):
        from mcp_server.tools.skills import query_skill_gap

        mock_rows = [
            SkillGapRow(skill="pytorch", skill_category="ai_ml", n_jobs=45, avg_salary_m=28.0),
            SkillGapRow(skill="langchain", skill_category="frameworks_libraries", n_jobs=32, avg_salary_m=35.0),
        ]

        with patch("mcp_server.tools.skills._skill_repo") as mock_repo:
            mock_repo.gap = AsyncMock(return_value=mock_rows)
            result = await query_skill_gap(user_skills="python,sql")

        assert "pytorch" in result
        assert "langchain" in result
        assert "45 jobs" in result
        assert "28.0M VND" in result

    @pytest.mark.asyncio
    async def test_empty_skills_input(self):
        from mcp_server.tools.skills import query_skill_gap

        result = await query_skill_gap(user_skills="")

        assert "Please provide" in result

    @pytest.mark.asyncio
    async def test_no_gap_data(self):
        from mcp_server.tools.skills import query_skill_gap

        with patch("mcp_server.tools.skills._skill_repo") as mock_repo:
            mock_repo.gap = AsyncMock(return_value=[])
            result = await query_skill_gap(user_skills="python,sql,docker")

        assert "No skill gap data" in result


class TestGetUserProfileTool:

    @pytest.mark.asyncio
    async def test_user_found(self):
        from mcp_server.tools.skills import get_user_profile

        profile = UserProfile(
            skills=["python", "sql"],
            desired_titles=["Data Engineer"],
            experience_level="senior",
        )

        with patch("mcp_server.tools.skills._user_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=profile)
            result = await get_user_profile(user_id="user-123")

        assert "python" in result
        assert "senior" in result

    @pytest.mark.asyncio
    async def test_user_not_found(self):
        from mcp_server.tools.skills import get_user_profile

        with patch("mcp_server.tools.skills._user_repo") as mock_repo:
            mock_repo.get_by_id = AsyncMock(return_value=None)
            result = await get_user_profile(user_id="nonexistent")

        assert "not found" in result
