"""CV parsing: extract text from PDF, upload to MinIO, use LLM to extract structured profile data."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Do that tren DB (2026-07): 3 user co CV, do dai cv_text trung binh 237,553
# ky tu, lon nhat 705,718. Toan bo duoc gui cho LLM MOI lan parse (~60k token)
# va luu nguyen vao users.cv_text - MAX_FILE_SIZE chi chan kich thuoc file PDF
# upload, khong chan duoc do dai text trich ra (PDF nen/rac lam text bung no).
# 20000 ky tu vi: CV 3 trang day dac ~6-8k ky tu; 20k du cho CV hoc thuat dai
# 8-10 trang. 237k khong phai la noi dung CV that ma la rac con sot trong PDF.
MAX_CV_TEXT_CHARS = 20000

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


def _truncate_cv_text(text: str) -> str:
    """Cat text tai ranh gioi tu neu vuot MAX_CV_TEXT_CHARS, khong cat giua tu.

    Tach rieng khoi extract_text() de test duoc truc tiep tren chuoi text,
    khong phai dung PDF that.
    """
    if len(text) <= MAX_CV_TEXT_CHARS:
        return text

    original_length = len(text)
    truncated = text[:MAX_CV_TEXT_CHARS]
    # Chi lui ve khoang trang gan nhat khi diem cat THAT SU nam giua mot tu
    # (ky tu ke tiep trong text goc khong phai whitespace). Neu diem cat vua
    # khop ranh gioi tu thi giu nguyen - tru regex se xoa oan mot tu du da
    # tron ven, vi \S*$ khop ca truong hop khong con ky tu nao bi cat dang.
    if not text[MAX_CV_TEXT_CHARS].isspace():
        match = re.search(r"\s\S*$", truncated)
        if match:
            truncated = truncated[: match.start()]
    truncated = truncated.rstrip()
    logger.warning(
        "cv_text vuot nguong MAX_CV_TEXT_CHARS, da cat: %d -> %d ky tu (nguong=%d)",
        original_length,
        len(truncated),
        MAX_CV_TEXT_CHARS,
    )
    return truncated


def extract_text(pdf_bytes: bytes) -> str:
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text()
        if text:
            pages.append(text.strip())
    doc.close()
    full_text = "\n\n".join(pages)
    return _truncate_cv_text(full_text)


def _market_vocab_instruction(market_skills: list[str] | None) -> str:
    """Ghép thêm từ vựng kỹ năng mà tin tuyển dụng THỰC SỰ đang dùng.

    Lý do tồn tại: phía job và phía CV đều là văn bản tự do do LLM sinh ra, từ
    hai prompt khác nhau, nên trước đây chỉ trùng nhau do may — đo trên một CV
    thật: 69 kỹ năng trích ra thì chỉ 12 cái có mặt trong kho job, tức 83% vô
    dụng cho việc chấm điểm. Chuẩn hoá qua bảng synonym KHÔNG cứu được (đo thử
    chỉ thêm đúng 1 kỹ năng) vì 58/91 kỹ năng phía job cũng nằm ngoài bảng đó.

    Cách chữa là BỔ SUNG chứ không thay thế: vẫn giữ nguyên stack thật của ứng
    viên để hiển thị, đồng thời thêm thuật ngữ thị trường tương ứng để khớp
    được. Người dùng LangGraph/LangChain vẫn giữ hai cái đó, nhưng có thêm
    "llm"/"ai" là những từ mà tin tuyển dụng dùng.
    """
    if not market_skills:
        return ""
    vocab = ", ".join(market_skills)
    return (
        "\n\nTỪ VỰNG KỸ NĂNG THỊ TRƯỜNG (trích từ tin tuyển dụng có thật):\n"
        f"{vocab}\n"
        "- Với trường `skills`: GIỮ NGUYÊN mọi kỹ năng thật của ứng viên, KHÔNG được bỏ bớt.\n"
        "- NGOÀI RA, bổ sung thêm những từ trong danh sách trên mà CV chứng minh được năng lực,\n"
        "  kể cả khi CV không viết đúng chữ đó. Ví dụ: dùng LangGraph/LangChain ⇒ thêm 'llm' và 'ai';\n"
        "  xây pipeline Spark/Airflow ⇒ thêm 'etl', 'big data'.\n"
        "- TUYỆT ĐỐI không thêm từ nào mà CV không có căn cứ — thà thiếu còn hơn bịa."
    )


def parse_cv(text: str, market_skills: list[str] | None = None) -> CvExtractResult:
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
                {"role": "system", "content": SYSTEM_PROMPT + _market_vocab_instruction(market_skills)},
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
