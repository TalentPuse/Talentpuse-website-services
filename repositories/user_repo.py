from __future__ import annotations

from mcp_server.repositories.base import BaseRepository
from mcp_server.schemas.user import UserProfile


class UserRepository(BaseRepository):

    async def get_by_id(self, user_id: str) -> UserProfile | None:
        row = await self._fetchrow(
            """
            SELECT skills, desired_titles, experience_level,
                   preferred_cities, desired_salary_min, desired_salary_max
            FROM app.users WHERE id = $1
            """,
            user_id,
        )
        if not row:
            return None

        return UserProfile(
            skills=row["skills"] or [],
            desired_titles=row["desired_titles"] or [],
            experience_level=row["experience_level"],
            preferred_cities=row["preferred_cities"] or [],
            desired_salary_range=(
                f"{row['desired_salary_min']}M - {row['desired_salary_max']}M VND"
                if row["desired_salary_min"]
                else None
            ),
        )
