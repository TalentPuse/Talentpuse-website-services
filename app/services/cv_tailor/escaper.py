"""Deterministic single-pass LaTeX escaping. Never run on already-rendered LaTeX."""
from __future__ import annotations

# One char-by-char pass (a sequential str.replace would double-escape the
# backslashes it inserts).
_MAP = {
    "\\": r"\textbackslash{}",
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}",
    "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
}


def latex_escape(s: str) -> str:
    return "".join(_MAP.get(ch, ch) for ch in s)


def escape_url(u: str) -> str:
    """URLs go inside \href{...}; only # and % break them."""
    return u.replace("#", r"\#").replace("%", r"\%")
