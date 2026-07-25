"""CV parsing: extract text from PDF, upload to MinIO, use LLM to extract structured profile data."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

SYSTEM_PROMPT = """\
Bạn là HR data extraction assistant. Phân tích CV/resume và trích xuất thông tin theo JSON schema.

Quy tắc:
- skills: chỉ lấy technical skills (programming languages, tools, frameworks, databases, cloud platforms). Normalize lowercase.
- desired_titles: infer từ work experience + skills, chọn max 5 job titles phù hợp nhất trên thị trường IT Việt Nam
- experience_level: căn cứ SỐ NĂM kinh nghiệm làm việc thực tế (tính cả thực tập, part-time, freelance).
  SỐ NĂM LUÔN QUYẾT ĐỊNH, chức danh chỉ là tham khảo.
  TUYỆT ĐỐI KHÔNG căn cứ việc ứng viên còn đang đi học: sinh viên đã đi làm vẫn xếp theo số năm đã làm.
  "student" (chưa từng đi làm, kể cả thực tập), "fresher" (<2yr), "experienced" (2-5yr),
  "manager" (>=5yr VÀ có quản lý team chính thức — chức danh kiểu "Team Lead" trong thực tập,
  đồ án hay câu lạc bộ KHÔNG tính là quản lý)
- preferred_cities: map thành canonical names: "HCMC", "Hanoi", "Da Nang", v.v. Nếu CV ghi "Ho Chi Minh" → "HCMC"
- salary: chỉ nếu CV mention rõ số tiền, convert sang triệu VND/tháng
- Trả về confidence cho mỗi field: "high" = ghi rõ trong CV, "medium" = infer hợp lý, "low" = đoán

JSON schema trả về:
{
  "full_name": "string | null",
  "email": "string | null",
  "phone": "string | null",
  "location": "string | null",
  "summary": "string | null — tóm tắt chuyên môn 1-2 câu",
  "experience_level": "student | fresher | experienced | manager | null",
  "years_of_experience": "number | null",
  "skills": ["string"],
  "desired_titles": ["string"],
  "preferred_cities": ["string"],
  "salary_min_m": "number | null — triệu VND/tháng",
  "salary_max_m": "number | null",
  "education": [
    {
      "university": "string | null",
      "major": "string | null",
      "degree": "string | null",
      "graduation_year": "number | null",
      "gpa": "number | null"
    }
  ],
  "work_experience": [
    {
      "title": "string",
      "company": "string",
      "start_date": "string | null — YYYY-MM",
      "end_date": "string | null — YYYY-MM hoặc 'present'",
      "highlights": ["string"]
    }
  ],
  "projects": [
    {
      "name": "string | null",
      "description": "string | null",
      "tech_stack": ["string"]
    }
  ],
  "certifications": ["string"],
  "languages": ["string"],
  "_confidence": {
    "skills": "high|medium|low",
    "desired_titles": "high|medium|low",
    "experience_level": "high|medium|low",
    "preferred_cities": "high|medium|low",
    "salary_min_m": "high|medium|low",
    "salary_max_m": "high|medium|low"
  }
}

Chỉ trả JSON, không thêm giải thích."""


@dataclass
class CvExtractResult:
    data: dict = field(default_factory=dict)
    raw_text_length: int = 0
    error: str | None = None


def extract_text(pdf_bytes: bytes) -> str:
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text()
        if text:
            pages.append(text.strip())
    doc.close()
    return "\n\n".join(pages)


def parse_cv(text: str) -> CvExtractResult:
    if not OPENAI_API_KEY:
        return CvExtractResult(error="OPENAI_API_KEY not configured")

    if not text.strip():
        return CvExtractResult(error="PDF không chứa text (có thể là file scan ảnh)")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Phân tích CV sau:\n\n{text}"},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            timeout=120,
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        return CvExtractResult(data=data, raw_text_length=len(text))
    except json.JSONDecodeError:
        logger.exception("LLM returned invalid JSON")
        return CvExtractResult(error="LLM trả về JSON không hợp lệ", raw_text_length=len(text))
    except Exception:
        logger.exception("LLM call failed")
        return CvExtractResult(error="Không thể phân tích CV, thử lại sau", raw_text_length=len(text))


def upload_to_s3(pdf_bytes: bytes, object_name: str) -> str | None:
    """Upload PDF bytes to S3/MinIO, return the object URL or None on failure."""
    from app.core.config import S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME

    if not S3_SECRET_KEY:
        logger.warning("S3_SECRET_KEY not configured, skipping upload")
        return None

    try:
        from minio import Minio
        from io import BytesIO
        from urllib.parse import urlparse

        parsed = urlparse(S3_ENDPOINT_URL)
        secure = parsed.scheme == "https"
        endpoint = parsed.netloc or parsed.path

        client = Minio(
            endpoint,
            access_key=S3_ACCESS_KEY,
            secret_key=S3_SECRET_KEY,
            secure=secure,
        )
        if not client.bucket_exists(S3_BUCKET_NAME):
            client.make_bucket(S3_BUCKET_NAME)

        client.put_object(
            S3_BUCKET_NAME,
            object_name,
            BytesIO(pdf_bytes),
            length=len(pdf_bytes),
            content_type="application/pdf",
        )

        return f"{S3_ENDPOINT_URL}/{S3_BUCKET_NAME}/{object_name}"
    except Exception:
        logger.exception("S3 upload failed")
        return None


def download_from_s3(object_name: str) -> bytes | None:
    """Fetch an object's bytes from S3/MinIO. None if unconfigured/missing."""
    from app.core.config import S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME

    if not S3_SECRET_KEY:
        return None

    resp = None
    try:
        from minio import Minio
        from urllib.parse import urlparse

        parsed = urlparse(S3_ENDPOINT_URL)
        client = Minio(
            parsed.netloc or parsed.path,
            access_key=S3_ACCESS_KEY,
            secret_key=S3_SECRET_KEY,
            secure=parsed.scheme == "https",
        )
        resp = client.get_object(S3_BUCKET_NAME, object_name)
        return resp.read()
    except Exception:
        return None
    finally:
        if resp is not None:
            resp.close()
            resp.release_conn()
