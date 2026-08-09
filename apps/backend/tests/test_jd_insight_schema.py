"""Schema extract JDI — validate dung enum, gioi han extras, bo qua field la."""
import copy

import pytest
from pydantic import ValidationError

from app.schemas.jd_insight import JdInsight

MINIMAL = {
    "job": {"source": "topcv", "source_job_id": "1", "title": "AI Engineer", "company_name": "X",
            "job_level": "Mid-level", "job_category": "AI Engineer", "city_canonical": "HCMC"},
    "summary": {"role_summary": "Lam AI", "seniority_hint": "mid"},
    "skills": {"hard": ["Python"], "soft": [], "tools": ["Docker"], "languages": [], "certifications": []},
    "requirements": {"years_experience": {"min": 3, "max": None, "raw": "3 YOE+"},
                     "education": {"level": "university", "major": None},
                     "work_type": "fulltime", "remote": "hybrid", "other": []},
    "responsibilities": ["Xay dung model"],
    "benefits": ["Bao hiem"],
    "keywords": ["LLM"],
    "extras": [],
}


def test_validate_minimal():
    m = JdInsight.model_validate(MINIMAL)
    assert m.skills.hard == ["Python"]


def test_seniority_invalid_bi_tu_choi():
    data = copy.deepcopy(MINIMAL)
    data["summary"]["seniority_hint"] = "boss"
    with pytest.raises(ValidationError):
        JdInsight.model_validate(data)


def test_extras_qua_10_items_bi_tu_choi():
    data = copy.deepcopy(MINIMAL)
    data["extras"] = [{"aspect": f"a{i}", "value": "x"} for i in range(11)]
    with pytest.raises(ValidationError):
        JdInsight.model_validate(data)


def test_extras_accepts_10_items():
    data = copy.deepcopy(MINIMAL)
    data["extras"] = [{"aspect": f"a{i}", "value": "x"} for i in range(10)]
    assert len(JdInsight.model_validate(data).extras) == 10


@pytest.mark.parametrize("raw_value,expected", [(0.5, 1), ("0.5", 1), (3.4, 3), ("2.7", 3)])
def test_years_experience_float_bi_lam_tron(raw_value, expected):
    data = copy.deepcopy(MINIMAL)
    data["requirements"]["years_experience"] = {"min": raw_value}
    m = JdInsight.model_validate(data)
    assert m.requirements.years_experience.min == expected
