from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.cv_document import CvDocument
from app.models.user import User
from app.schemas.cv import CvDocumentResponse, CvExtractResponse
from app.services.cv_tailor.build import ensure_document, render_pdf_bytes
from app.services.cv_parser import (
    MAX_FILE_SIZE,
    extract_text,
    parse_cv,
    upload_to_s3,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cv", tags=["cv"])


@router.post("/upload", response_model=CvExtractResponse)
async def upload_cv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CvExtractResponse:
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ hỗ trợ file PDF",
        )

    # Read file bytes
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File quá lớn, tối đa {MAX_FILE_SIZE // 1024 // 1024}MB",
        )
    if len(pdf_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File trống",
        )

    # Upload to MinIO. The MinIO client is synchronous and network-bound, so run
    # it off the event loop — otherwise a single upload blocks every other request.
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    object_name = f"cvs/{user.id}_{timestamp}.pdf"
    s3_url = await asyncio.to_thread(upload_to_s3, pdf_bytes, object_name)

    # Extract text from PDF. PyMuPDF is CPU-bound — offload to a worker thread.
    try:
        text = await asyncio.to_thread(extract_text, pdf_bytes)
    except Exception:
        logger.exception("PDF text extraction failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể đọc file PDF. File có thể bị lỗi hoặc protect.",
        )

    # Persist the file URL and the extracted text so AI features (skill-advisor,
    # interview coach, future copilot) can read the actual CV, not just profile fields.
    if s3_url:
        user.cv_file_url = s3_url
    if text:
        user.cv_text = text
        # A new CV invalidates any previously rendered document so the /assistant
        # preview rebuilds from the fresh text on next open.
        await db.execute(delete(CvDocument).where(CvDocument.user_id == user.id))
    if s3_url or text:
        await db.commit()

    # Parse with the LLM. The OpenAI client is synchronous with a 120s timeout —
    # offload so it never blocks the single-worker event loop.
    result = await asyncio.to_thread(parse_cv, text)
    if result.error:
        return CvExtractResponse(
            extracted={},
            raw_text_length=result.raw_text_length,
            error=result.error,
        )

    return CvExtractResponse(
        extracted=result.data,
        raw_text_length=result.raw_text_length,
    )


@router.get("/document", response_model=CvDocumentResponse)
async def get_cv_document(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CvDocumentResponse:
    try:
        return await ensure_document(db, user)
    except ValueError:
        raise HTTPException(
            status_code=409,
            detail="Chưa có CV — hãy upload CV ở trang Hồ sơ trước.",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=502,
            detail="Không render được CV, thử lại sau.",
        )


@router.get("/document/pdf")
async def get_cv_document_pdf(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Serve the rendered CV PDF same-origin (authed), so the browser never has
    to reach the internal MinIO URL. Re-renders deterministically from the
    stored model. Call GET /api/cv/document first to ensure the document exists."""
    try:
        pdf = await render_pdf_bytes(db, user)
    except ValueError:
        raise HTTPException(status_code=409, detail="Chưa có CV đã render.")
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Không render được CV, thử lại sau.")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="cv.pdf"'},
    )
