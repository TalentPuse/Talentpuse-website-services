from app.services.cv_tailor.model import ResumeModel
from app.services.cv_tailor.renderer import render_tex

MODEL = ResumeModel.model_validate({
    "header": {"full_name": "A & B", "email": "a@b.com"},
    "experience": [{"company": "C%o", "title": "Dev", "start": "2022", "end": "now",
                    "bullets": ["Cut cost by 50%"]}],
    "skills": {"technical": ["python", "sql"], "languages": ["English"]},
})


def test_render_escapes_and_keeps_preamble():
    tex = render_tex(MODEL)
    assert r"\documentclass[11pt]{article}" in tex
    assert r"\pdfgentounicode=1" in tex
    assert "A \\& B" in tex
    assert "C\\%o" in tex
    assert "Cut cost by 50\\%" in tex
    assert "python, sql" in tex


def test_preamble_prefix_from_template():
    tex = render_tex(MODEL)
    assert tex.split(r"\begin{document}")[0].strip().startswith(r"%% Adapted from")
