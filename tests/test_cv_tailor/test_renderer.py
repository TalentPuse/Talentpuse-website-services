from app.services.cv_tailor.model import ResumeModel
from app.services.cv_tailor.renderer import render_tex

MODEL = ResumeModel.model_validate({
    "header": {"full_name": "A & B", "email": "a@b.com", "github": "https://github.com/x"},
    "experience": [{"company": "C%o", "title": "Dev", "start": "2022", "end": "now",
                    "bullets": ["Cut cost by 50%"]}],
    "projects": [{"name": "Proj#1", "role": "Lead",
                  "links": [{"label": "Repo", "url": "https://x.com/a#b"}]}],
    "skills": [{"category": "Core", "items": ["python", "sql"]}],
    "honors": ["Top 1 & proud"],
    "certifications": [{"title": "AWS", "issuer": "Amazon", "date": "2026"}],
})


def test_render_escapes_and_keeps_preamble():
    tex = render_tex(MODEL)
    assert r"\documentclass[letterpaper,10.5pt]{article}" in tex
    assert r"\pdfgentounicode" not in tex  # pdfTeX-only; crashes/garbles under Tectonic/XeTeX
    assert r"\usepackage{helvet}" in tex
    assert "A \\& B" in tex           # header escaped
    assert "C\\%o" in tex             # company escaped
    assert "Cut cost by 50\\%" in tex  # bullet escaped
    assert "python, sql" in tex       # skills joined
    assert "Top 1 \\& proud" in tex   # honors escaped
    assert "Proj\\#1" in tex          # project name escaped
    assert r"https://x.com/a\#b" in tex  # url # escaped, not backslash-textbackslash


def test_section_headers_present():
    tex = render_tex(MODEL)
    for sec in ["EXPERIENCE", "PROJECTS", "TECHNICAL SKILLS", "HONORS", "CERTIFICATIONS"]:
        assert "\\section{" + sec in tex or sec in tex


def test_preamble_prefix_from_template():
    tex = render_tex(MODEL)
    assert tex.split(r"\begin{document}")[0].lstrip().startswith("%")
