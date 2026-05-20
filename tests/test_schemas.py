import pytest
from pydantic import ValidationError

from mcp_server.schemas.user import UserProfile
from mcp_server.schemas.skill import SkillGapRow, SkillDemandRow, SkillTrend
from mcp_server.schemas.analytics import (
    SystemStats,
    JobOverview,
    CategoryCount,
    SalaryRow,
    CompanyRow,
    JobMarketOverview,
)
from mcp_server.schemas.operations import AlertDispatchResult


# ─── UserProfile ────────────────────────────────────────


class TestUserProfile:

    def test_defaults(self):
        p = UserProfile()
        assert p.skills == []
        assert p.experience_level is None
        assert p.desired_salary_range is None

    def test_full(self):
        p = UserProfile(
            skills=["python", "sql"],
            desired_titles=["Data Engineer"],
            experience_level="senior",
            preferred_cities=["Ho Chi Minh"],
            desired_salary_range="20M - 35M VND",
        )
        assert len(p.skills) == 2
        assert p.experience_level == "senior"

    def test_json_roundtrip(self):
        p = UserProfile(skills=["docker"], desired_titles=["DevOps"])
        json_str = p.model_dump_json()
        p2 = UserProfile.model_validate_json(json_str)
        assert p2.skills == ["docker"]


# ─── Skill schemas ──────────────────────────────────────


class TestSkillGapRow:

    def test_with_salary(self):
        r = SkillGapRow(skill="python", skill_category="ai_ml", n_jobs=100, avg_salary_m=25.3)
        assert r.avg_salary_m == 25.3

    def test_null_salary(self):
        r = SkillGapRow(skill="go", skill_category="programming_languages", n_jobs=5)
        assert r.avg_salary_m is None


class TestSkillTrend:

    def test_trend_calc(self):
        t = SkillTrend(skill="rag", trend_pct=42.5, latest_jobs=30)
        assert t.trend_pct == 42.5
        assert t.latest_jobs == 30


# ─── Analytics schemas ──────────────────────────────────


class TestSystemStats:

    def test_defaults(self):
        s = SystemStats()
        assert s.total_users == 0
        assert s.alerts_today == 0

    def test_from_dict(self):
        s = SystemStats(total_users=50, active_users=40, telegram_linked=30,
                        alerts_today=10, alerts_this_week=60, total_alerts=500)
        assert s.total_users == 50


class TestJobMarketOverview:

    def test_nested(self):
        o = JobMarketOverview(
            overview=JobOverview(total_active_jobs=100, avg_salary_m=20.5),
            top_categories=[CategoryCount(job_category="AI", n_jobs=40)],
            top_cities=[CategoryCount(city_canonical="HCM", n_jobs=60)],
        )
        assert o.overview.total_active_jobs == 100
        assert len(o.top_categories) == 1

    def test_json_roundtrip(self):
        o = JobMarketOverview(overview=JobOverview(total_active_jobs=50))
        json_str = o.model_dump_json()
        o2 = JobMarketOverview.model_validate_json(json_str)
        assert o2.overview.total_active_jobs == 50


class TestSalaryRow:

    def test_percentiles(self):
        r = SalaryRow(job_level="senior", city_canonical="HCM", n_jobs=20,
                      p25_m=18.0, p50_m=25.0, p75_m=35.0)
        assert r.p50_m == 25.0


class TestCompanyRow:

    def test_basic(self):
        c = CompanyRow(company_name="VNG", active_jobs=15, avg_salary_m=22.0,
                       primary_city="Ho Chi Minh")
        assert c.company_name == "VNG"


# ─── Operations schemas ─────────────────────────────────


class TestAlertDispatchResult:

    def test_success(self):
        r = AlertDispatchResult(status="success", alerts_sent=23,
                                message="Dispatched 23 alerts")
        assert r.alerts_sent == 23

    def test_error(self):
        r = AlertDispatchResult(status="error", message="Connection refused")
        assert r.status == "error"
        assert r.alerts_sent == 0
