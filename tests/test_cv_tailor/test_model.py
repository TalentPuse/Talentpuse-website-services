import pytest
from pydantic import ValidationError
from app.services.cv_tailor.model import ResumeModel

MINIMAL = {
    "header": {"full_name": "Nguyen Minh Bao", "email": "b@x.com"},
    "education": [], "experience": [], "projects": [],
    "skills": {"technical": ["python"], "languages": ["English"]},
}


def test_parses_minimal_valid_model():
    m = ResumeModel.model_validate(MINIMAL)
    assert m.header.full_name == "Nguyen Minh Bao"
    assert m.skills.technical == ["python"]


def test_missing_required_header_raises():
    with pytest.raises(ValidationError):
        ResumeModel.model_validate({"education": []})
