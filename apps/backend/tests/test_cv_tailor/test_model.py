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


@pytest.mark.parametrize("bad_email", ["", "   ", None, "khong-phai-email"])
def test_blank_or_invalid_email_becomes_none(bad_email):
    """CV khong ghi email -> LLM tra "" -> truoc day EmailStr bat buoc khien
    GET /api/cv/document tra 502. Gio ha xuong None va van render duoc."""
    m = ResumeModel.model_validate({**MINIMAL, "header": {"full_name": "A", "email": bad_email}})
    assert m.header.email is None


def test_header_without_email_key_is_valid():
    m = ResumeModel.model_validate({**MINIMAL, "header": {"full_name": "A"}})
    assert m.header.email is None


def test_valid_email_is_kept():
    m = ResumeModel.model_validate({**MINIMAL, "header": {"full_name": "A", "email": "a@b.com"}})
    assert m.header.email == "a@b.com"


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
