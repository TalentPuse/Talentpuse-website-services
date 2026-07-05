from __future__ import annotations

from pydantic import BaseModel


class CvExtractResponse(BaseModel):
    extracted: dict
    raw_text_length: int
    error: str | None = None


class CvDocumentResponse(BaseModel):
    model: dict
    pdf_url: str | None = None
    page_count: int | None = None
