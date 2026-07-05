import pytest
from pydantic import ValidationError
from app.services.cv_tailor.model import ResumeModel

MINIMAL = {
    "header": {"full_name": "Nguyen Minh Bao", "email": "b@x.com"},
    "education": [], "experience": [], "projects": [],
    "skills": [{"category": "Programming", "items": ["python"]}],
    "honors": [], "certifications": [],
}


def test_parses_minimal_valid_model():
    m = ResumeModel.model_validate(MINIMAL)
    assert m.header.full_name == "Nguyen Minh Bao"
    assert m.skills[0].category == "Programming"
    assert m.skills[0].items == ["python"]


def test_missing_required_header_raises():
    with pytest.raises(ValidationError):
        ResumeModel.model_validate({"education": []})


def test_rich_sections_parse():
    m = ResumeModel.model_validate({
        "header": {"full_name": "A", "email": "a@b.com"},
        "projects": [{"name": "P", "role": "Lead", "links": [{"label": "GH", "url": "http://x"}]}],
        "honors": ["Won prize"],
        "certifications": [{"title": "AWS", "issuer": "Amazon"}],
    })
    assert m.projects[0].links[0].url == "http://x"
    assert m.honors == ["Won prize"]
    assert m.certifications[0].issuer == "Amazon"
