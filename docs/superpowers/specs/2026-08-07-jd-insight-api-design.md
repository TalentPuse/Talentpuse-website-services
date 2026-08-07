# Bán Insight Data từ JD — API trả phí (JDI: Job Description Insight)

**Ngày:** 2026-08-07 · **Trạng thái:** design đã chốt · **Phạm vi:** backend web box + warehouse copy

## 1. Mục tiêu

Bán dữ liệu insight thị trường tuyển dụng Việt Nam dưới dạng **API trả phí**. Khách hàng
mua quyền truy cập (API key + quota tháng) để query insight đã được **LLM extract từ nội
dung JD thật** trong master data — không phải bán salary benchmark.

Giá trị cốt lõi: JD thô (8.015 job có text, trung bình 3.327 ký tự, 4+ nguồn crawl khác nhau)
chứa thông tin mà các field hiện có không phủ đều — **skills/benefits JSON chỉ có trên một phần
job** — nên phải extract lại từ text bằng LLM để ra một schema đồng nhất, dày, bán được.

## 2. Quyết định đã chốt (từ brainstorm)

- Bán **API access trả phí** (không bán file/dataset), **1 gói Insight duy nhất** (không bậc thang)
- **Bỏ salary** khỏi sản phẩm — tập trung vào nội dung JD
- **Payment THỦ CÔNG** (không tích hợp Stripe/payment gateway): khách liên hệ → tạo key tay → hóa đơn ngoài hệ thống
- Key/quota/usage tracking thiết kế chuẩn để sau này mở public self-serve mà không vỡ lại
- Mở rộng **backend hiện tại** (apps/backend), không tách service mới — cùng box, cùng nginx proxy `/api`

## 3. Schema extract — `jd_insight.data` (JSONB mỗi job)

```jsonc
{
  "job": { "source", "source_job_id", "title", "company_name", "job_level", "job_category", "city_canonical" },

  "summary": {
    "role_summary": "1-2 câu mô tả vai trò",
    "seniority_hint": "intern | fresher | junior | mid | senior | lead | manager"
  },

  "skills": {
    "hard": ["Python", "PyTorch", "NLP"],
    "soft": ["teamwork", "communication"],
    "tools": ["Kubernetes", "Docker", "Pega PRPC"],
    "languages": [{ "lang": "Tiếng Nhật", "level": "N2" }],
    "certifications": ["AWS Certified", "PMP"]
  },

  "requirements": {
    "years_experience": { "min": 3, "max": null, "raw": "3 YOE+" },
    "education": { "level": "university | college | none", "major": null },
    "work_type": "fulltime | contract | internship | parttime",
    "remote": "remote | hybrid | onsite",
    "other": ["ưu tiên kinh nghiệm ngân hàng"]
  },

  "responsibilities": ["3-6 trách nhiệm chính, giữ nguyên văn"],

  "benefits": ["chuẩn hóa nhóm: bảo hiểm, thưởng tháng 13, remote..."],

  "keywords": ["từ khóa đặc thù ngành: low-code, credit scoring, LLM"],

  "extras": [
    { "aspect": "deadline", "value": "Hạn nộp hồ sơ: 31/08/2026" },
    { "aspect": "working_hours", "value": "Mon–Fri 9:00–18:00" },
    { "aspect": "probation", "value": "Thử việc 2 tháng, 120% lương" }
  ]
}
```

**Nguyên tắc schema:**

- Field đóng (seniority, work_type, remote, education.level) là **enum** → aggregate được; text tự do nằm ở `raw`/`other`
- `requirements.years_experience.raw` giữ câu gốc — LLM sai còn bằng chứng đối chiếu
- `benefits`/`responsibilities` giữ nguyên văn, chỉ chuẩn hóa nhóm cho benefits
- Ranh giới rõ giữa 2 field "khác": `requirements.other` = **yêu cầu tuyển dụng đặc thù** không thuộc enum (vd "ưu tiên kinh nghiệm ngân hàng"); `extras` = **thông tin KHÔNG phải yêu cầu tuyển dụng** (deadline, giờ làm, team size, report-to, probation, salary_note, địa điểm) — tránh LLM nhét lung tung vào một chỗ
- `extras` là **catch-all**: LLM tự đặt `aspect` (snake_case, lowercase) + `value` (nguyên văn), giới hạn **tối đa 10 items**
- Skill **normalize lowercase + synonym map** — synonym map là **dict hằng số trong code** (tận dụng kinh nghiệm job_fit/facts.py: "ai" ↔ "artificial intelligence"), không phải bảng DB
- `keywords` — LLM nhặt từ khóa đặc thù ngành mà rule không làm nổi

## 4. Extraction pipeline

- **LLM**: OpenRouter (`OPENAI_API_KEY`/`OPENAI_BASE_URL`/`OPENAI_MODEL` — deepseek-v4-flash), prompt yêu cầu trả JSON đúng schema, temperature thấp
- **Nguồn**: `dbt_dev_silver.silver_job_detail` (job_description_text + job_requirement_text) — bản copy trên web box
- **Incremental hàng ngày**: chỉ extract job CHƯA có hoặc `is_active` mới — tránh extract lại toàn bộ
- **Backfill 8.015 job hiện tại**: chạy nền vài giờ (8k call LLM, mô hình rẻ), không chặn request
- **Idempotent + versioned**: upsert theo `(source, source_job_id)`, lưu `model_version` — đổi prompt/schema là extract lại có chủ đích
- **Scheduler**: Prefect flow trên web box (hạ tầng đã có) — chạy sau sync data hàng ngày

## 5. Storage

```sql
CREATE TABLE app.jd_insight (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source varchar(50) NOT NULL,
    source_job_id varchar NOT NULL,
    data jsonb NOT NULL,
    model_version text NOT NULL,
    extracted_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source, source_job_id)
);

CREATE TABLE app.api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,          -- tên khách hàng
    key_hash text NOT NULL UNIQUE,       -- sha256(key) — không lưu key thô
    quota_month int NOT NULL DEFAULT 10000,  -- số request/ tháng
    used_count int NOT NULL DEFAULT 0,   -- đếm request tháng hiện tại
    quota_reset_at timestamptz NOT NULL, -- mốc reset quota
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

## 6. API bán hàng (prefix `/api/v1`, nginx proxy `/api` sẵn có)

**Auth:** header `X-API-Key: <key>` → middleware:
1. Hash key, tra `app.api_keys` (active)
2. Reset quota nếu qua `quota_reset_at`
3. `used_count >= quota_month` → **429**
4. Tăng `used_count` (best-effort, không chặn request khi update fail)

**Quota reset:** theo **đầu tháng** (quota_reset_at = ngày 1 tháng kế tiếp lúc tạo key; khi hết hạn → reset used_count=0, quota_reset_at = đầu tháng sau). Không dùng rolling window — khách dễ hiểu "mỗi tháng X request".

**Rate limit:** đơn giản theo key (vd 60 req/phút) — Redis đã có sẵn.

**Endpoints:**

| Endpoint | Mô tả |
|---|---|
| `GET /api/v1/skills/top?category=&city=` | Top skill hard + % JD yêu cầu |
| `GET /api/v1/tools/top?category=` | Top tools/frameworks |
| `GET /api/v1/languages/top` | Ngoại ngữ phổ biến (kèm level) |
| `GET /api/v1/benefits/top` | Phúc lợi phổ biến (đã chuẩn hóa nhóm) |
| `GET /api/v1/requirements/experience?category=` | Phân bố YOE |
| `GET /api/v1/jobs/{source}/{source_job_id}/insight` | Chi tiết extract 1 job (giống path style /api/jobs hiện có) |

- Aggregate: **SQL on-the-fly over JSONB** (8k rows nhỏ) + cache Redis 1h — chưa cần materialized views
- Filter theo category/city/level đọc từ `data.job.*`
- **Admin** (manual billing): tạo key / đổi quota / xem usage — endpoint admin đơn giản + SQL tay, không cần dashboard

## 7. Testing

- Unit test: prompt→JSON validate đúng schema (fixture JD mẫu từ 4 nguồn thật)
- Test extract pipeline: upsert idempotent, model_version, skip đã extract
- Test API: key sai → 401, hết quota → 429, key inactive → 401, aggregate đúng số liệu trên fixture
- Test sync qua warehouse data thật (subset)

## 8. Ngoài phạm vi (YAGNI)

- Payment tự động (Stripe) — khi nào có khách đông
- Dashboard self-serve cho khách — giai đoạn đầu khách nhận key qua email
- Export file/CSV
- Gói bậc thang / trả theo usage chính xác

## 9. Rủi ro / lưu ý

- **Chất lượng extract phụ thuộc LLM**: cần đánh giá mẫu trước khi backfill toàn bộ (extract thử 20-30 job, review bằng tay)
- **Chi phí LLM backfill**: 8k call — dùng model rẻ, chạy dần vài ngày
- **Data tươi**: insight chỉ tốt khi warehouse sync chạy — phụ thuộc pipeline hiện có
- Schema đổi sau này: bump `model_version`, extract lại job bị ảnh hưởng
