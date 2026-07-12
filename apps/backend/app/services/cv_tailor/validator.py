from __future__ import annotations
import io
from pypdf import PdfReader


def page_count(pdf: bytes) -> int:
    return len(PdfReader(io.BytesIO(pdf)).pages)
