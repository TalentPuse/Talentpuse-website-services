from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, status
from sqlalchemy import delete, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.cv_document import CvDocument
from app.models.user import User
from app.schemas.cv import CvDocumentResponse, CvExtractResponse
from app.services.cv_tailor.build import ensure_document, render_pdf_bytes
from app.services.cv_parser import (
    MAX_FILE_SIZE,
    download_from_s3,
    extract_text,
    parse_cv,
    upload_to_s3,
)

logger = logging.getLogger(__name__)

# Từ vựng kỹ năng thị trường chỉ đổi khi dbt chạy lại (hàng ngày). `v1` trong
# key để lần sau đổi định dạng thì chỉ cần bump lên v2, khỏi phải xoá cache tay.
_MARKET_SKILLS_KEY = "cv:market_skills:v1"
_MARKET_SKILLS_TTL = 3600

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

    # Extract text TRUOC khi ghi storage. PyMuPDF la CPU-bound — offload sang
    # worker thread. Validate xong moi upload_to_s3: truoc day upload chay
    # TRUOC buoc nay nen file loi/protect van bi ghi vao MinIO vinh vien du
    # request tra 400 (khong co job don rac nao xoa lai object mo coi do).
    try:
        text = await asyncio.to_thread(extract_text, pdf_bytes)
    except Exception:
        logger.exception("PDF text extraction failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể đọc file PDF. File có thể bị lỗi hoặc protect.",
        )

    # Upload to MinIO chi sau khi da xac nhan doc duoc file. MinIO client la
    # dong bo va network-bound, chay o thread rieng — khong thi mot upload
    # chan het cac request khac.
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    object_name = f"cvs/{user.id}_{timestamp}.pdf"
    s3_url = await asyncio.to_thread(upload_to_s3, pdf_bytes, object_name)

    # Persist the file URL and the extracted text so AI features (skill-advisor,
    # interview coach, future copilot) can read the actual CV, not just profile fields.
    #
    # cv_file_url CHI duoc cap trong nhanh "text" thanh cong — truoc day day la
    # hai cau if doc lap nen truong hop PDF hop le nhung khong trich duoc text
    # (anh scan, extract_text tra chuoi rong ma khong nem loi) se lam cv_file_url
    # tro sang file MOI trong khi cv_text van la CV CU: hai truong mo ta hai CV
    # khac nhau. Gop lai de cap nhat ca hai hoac khong cai nao.
    if text:
        user.cv_text = text
        if s3_url:
            user.cv_file_url = s3_url
        # A new CV invalidates any previously rendered document so the /assistant
        # preview rebuilds from the fresh text on next open.
        await db.execute(delete(CvDocument).where(CvDocument.user_id == user.id))
        await db.commit()

    # Từ vựng kỹ năng mà tin tuyển dụng THỰC SỰ đang dùng, đưa vào prompt để CV
    # và job nói cùng một thứ tiếng. Đo trên một CV thật: số kỹ năng khớp được
    # với kho tăng từ 13 lên 26, không mất kỹ năng nào của ứng viên.
    #
    # Bọc try/except là BẮT BUỘC: mart_skill_demand thuộc kho dbt, không phải
    # schema app. Kho lỗi hoặc chưa build thì upload CV vẫn phải chạy — thiếu
    # từ vựng chỉ làm khớp job kém đi, còn ném lỗi là hỏng cả tính năng.
    # Cache 1 giờ: từ vựng này chỉ đổi theo nhịp dbt chạy (hàng ngày), nên đọc
    # lại kho ở MỌI lần upload CV là lãng phí. Redis chết thì cache_get_json trả
    # None và ta rơi xuống truy vấn kho như cũ — không nhánh nào hỏng.
    market_skills: list[str] | None = await cache_get_json(_MARKET_SKILLS_KEY)
    try:
        if not market_skills:
            rows = await db.execute(
                sa_text("select skill from dbt_dev_gold.mart_skill_demand order by n_jobs desc limit 200")
            )
            market_skills = [r[0].strip().lower() for r in rows.all() if r[0] and r[0].strip()] or None
            if market_skills:
                await cache_set_json(_MARKET_SKILLS_KEY, market_skills, _MARKET_SKILLS_TTL)
    except Exception:
        logger.warning("mart_skill_demand unavailable; parsing CV without market vocabulary", exc_info=True)
        # Postgres abort cả transaction khi một câu lệnh lỗi: mọi truy vấn sau
        # đó trên cùng session sẽ chết với "current transaction is aborted".
        # Hiện endpoint không còn dùng `db` phía dưới, nhưng để nguyên session
        # hỏng là đặt bẫy cho người thêm truy vấn sau này.
        try:
            await db.rollback()
        except Exception:
            logger.warning("rollback after market-vocab lookup failed", exc_info=True)

    # Parse with the LLM. The OpenAI client is synchronous with a 120s timeout —
    # offload so it never blocks the single-worker event loop.
    result = await asyncio.to_thread(parse_cv, text, market_skills)
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
        logger.info("CV document unavailable for user %s (chua co cv_text)", user.id)
        raise HTTPException(
            status_code=409,
            detail="Chưa có CV — hãy upload CV ở trang Hồ sơ trước.",
        )
    except RuntimeError:
        # Khong nuot exception: 502 nay tung khong de lai dau vet nao trong log,
        # phai vao container tai hien moi biet la LLM hay Tectonic that bai.
        logger.exception("CV render failed for user %s", user.id)
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
    to reach the internal MinIO URL. Serves the pre-rendered PDF from storage
    (fast); only recompiles as a fallback. Call GET /api/cv/document first."""
    # Kiem tra row CvDocument TRUOC khi tin PDF trong storage. upload_cv xoa
    # row nay khi co CV moi (xem tren) nhung KHONG xoa object da render truoc
    # do o MinIO, nen doc thang tu storage (nhu code cu) se tra ve CV CU sau
    # khi user da upload CV moi.
    #
    # Khong co cot rieng "cv_uploaded_at" nen dung User.updated_at lam moc so
    # sanh (onupdate=func.now() da tu cap moi lan cv_text doi) — day la giai
    # phap don gian nhat khong can migration. Han che: user sua profile
    # (khong lien quan CV) sau khi document duoc build cung lam updated_at
    # nhay, kich rebuild oan mot lan — chap nhan duoc, con hon serve nham CV cu.
    # Boc try/except quanh buoc kiem tra do tuoi: day chi la mot toi uu (dung
    # cache khi con hop le), khong phai duong bat buoc — loi o day (vd DB tam
    # thoi gian doan) khong duoc lam sap request, cu roi xuong nhanh build lai
    # ben duoi (render_pdf_bytes se tu bao loi rieng cua no neu DB that su hong).
    is_cache_fresh = False
    try:
        row = (await db.execute(
            select(CvDocument).where(CvDocument.user_id == user.id))).scalar_one_or_none()
        is_cache_fresh = (
            row is not None
            and row.updated_at is not None
            and user.updated_at is not None
            and row.updated_at >= user.updated_at
        )
    except Exception:
        logger.warning("CvDocument freshness check failed for user %s, se build lai", user.id, exc_info=True)

    pdf = None
    if is_cache_fresh:
        pdf = await asyncio.to_thread(download_from_s3, f"cv-pdf/{user.id}.pdf")
    if pdf is None:
        try:
            pdf = await render_pdf_bytes(db, user)
        except ValueError:
            logger.info("No rendered CV for user %s", user.id)
            raise HTTPException(status_code=409, detail="Chưa có CV đã render.")
        except RuntimeError:
            logger.exception("CV re-render failed for user %s", user.id)
            raise HTTPException(status_code=502, detail="Không render được CV, thử lại sau.")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="cv.pdf"'},
    )
