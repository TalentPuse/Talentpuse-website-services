from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/pro", tags=["pro"])


async def require_pro(user: User = Depends(get_current_user)):
    if user.subscription_tier != "pro" and not user.is_admin:
        raise HTTPException(403, "Pro subscription required")
    return user


@router.get("/health")
async def health(user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    total = (await db.execute(text("SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"))).scalar() or 0
    extracted = (await db.execute(text("SELECT count(*) FROM app.jd_insight"))).scalar() or 0
    missing = max(total - extracted, 0)
    return {"total_jd": total, "extracted": extracted, "missing": missing, "missing_pct": round(missing*100/max(total,1),1), "llm": {"jd": "unknown", "openai": "unknown"}}
