from __future__ import annotations
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from app.services.cv_tailor.escaper import latex_escape, escape_url
from app.services.cv_tailor.model import ResumeModel

_TPL_DIR = Path(__file__).parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TPL_DIR)),
    block_start_string="<%", block_end_string="%>",
    variable_start_string="<<", variable_end_string=">>",
    comment_start_string="<#", comment_end_string="#>",
    trim_blocks=True, lstrip_blocks=True, autoescape=False,
    undefined=StrictUndefined,
)
_env.filters["e"] = latex_escape
_env.filters["url"] = escape_url


def render_tex(model: ResumeModel) -> str:
    return _env.get_template("base_rover.tex.j2").render(model=model)
