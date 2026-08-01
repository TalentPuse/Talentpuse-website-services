# Job Fit Suite — thiết kế

**Ngày:** 2026-08-01
**Phạm vi:** cả 4 nhóm tính năng (user chọn "cả 4 nhóm trong 1 spec")
**Trạng thái:** chờ duyệt

---

## 1. Vấn đề

Người dùng nêu bốn mong muốn:

1. Bấm vào card job → hiện thông tin chi tiết (JD, thông tin liên quan, **độ match với hồ sơ**)
2. Rerank job theo mức phù hợp, và **nói cho người dùng biết nên focus job nào**
3. Thiết kế lại chỗ Insight cho "wow" hơn
4. AI soạn mail + tra cứu thông tin một công ty bất kỳ

Luận điểm kiếm tiền của người dùng: *"để user quản lý các job họ apply là mình ăn tiền"*.

**Phản biện đã nêu, người dùng vẫn giữ hướng, nên spec đi theo hướng của người dùng
nhưng ghi lại đây để sau này đo:** quản lý job là tính năng *giữ chân*, không phải
tính năng *người ta rút ví*. Người tìm việc trả tiền để **được phỏng vấn**, không
phải để có bảng Kanban đẹp. Vì vậy spec đặt các thứ trực tiếp tăng tỉ lệ được gọi
phỏng vấn (điểm phù hợp, khoảng cách kỹ năng, thư ứng tuyển) ở tầng tính phí, còn
bảng quản lý ở tầng miễn phí để kéo người dùng vào.

---

## 2. Sự thật đo được từ kho dữ liệu

Đo ngày 2026-08-01 trên `tp-postgres`. **Đây là xương sống của spec — mọi lựa chọn
thiết kế bên dưới đều truy về bảng này.**

> **Đính chính 2026-08-01 (phát hiện khi thi công Task 5):** bản đầu của spec này
> ghi "6432 tin đang mở" ở khắp mục 2. Đó là số **DÒNG**, không phải số **TIN**.
> `fct_jobs_daily` là bảng **snapshot hàng ngày** — mỗi tin có nhiều dòng
> `is_active = true`, mỗi dòng một `snapshot_date`. Số tin phân biệt thật là
> **3056** (hệ số nhân bản ~2,1). Các bảng dưới đã tính lại trên tin phân biệt.
> **Mọi tỉ lệ và mọi kết luận thiết kế giữ nguyên** — chỉ con số tuyệt đối bị
> thổi phồng. Sai sót này còn gây một lỗi thật trong `facts.py` (một khoá trả về
> 2–3 `JobFacts`), đã sửa ở commit `99c4509`.

### 2.1 Độ phủ kỹ năng có cấu trúc lệch hẳn theo nguồn

| Nguồn | Tin phân biệt | Có kỹ năng trong `silver_skill_long` | (số dòng thô) |
|---|---:|---:|---:|
| itviec | 375 | 375 (100%) | 651 |
| vietnamworks | 586 | 582 (99%) | 1345 |
| topcv | 153 | 81 (53%) | 306 |
| **linkedin** | **1942** | **0 (0%)** | 4130 |
| **Tổng** | **3056** | **1038 (34%)** | 6432 |

LinkedIn vẫn là **1942/3056 = 64% kho** — đúng tỉ lệ đã nêu ban đầu.

**Hệ quả:** chấm điểm kỹ năng chỉ dựa vào `silver_skill_long` sẽ đẩy **toàn bộ 4130
tin LinkedIn — 64% kho — xuống đáy bảng xếp hạng**, không phải vì chúng không hợp
mà vì ETL chưa trích kỹ năng cho nguồn đó. Đó là biến một lỗ hổng pipeline thành
một lời nói dối với người dùng. Không chấp nhận được.

### 2.2 Mô tả công việc phủ 100% và bù trừ cho lỗ hổng trên

Quét kỹ năng theo biên từ trong `job_description_text + job_requirement_text`, với
bộ 15 kỹ năng thật của một hồ sơ có sẵn:

| Nguồn | Tin có ≥1 kỹ năng khớp trong text | Kỹ năng khớp TB |
|---|---:|---:|
| itviec | 454/651 (70%) | 2.09 |
| linkedin | 2610/4130 (63%) | 1.80 |
| topcv | 232/306 (76%) | 2.35 |
| vietnamworks | 233/1345 (17%) | 0.42 |

VietnamWorks yếu ở text nhưng mạnh ở cấu trúc (99%); LinkedIn ngược lại. **Hai
nguồn tín hiệu bù trừ nhau** — dùng cả hai (`structured OR text`) thì độ phủ đều
trên mọi nguồn và artifact theo nguồn biến mất.

### 2.3 Khớp chuỗi con không dùng được

| Cách khớp | Số tin khớp "ai" | Số tin khớp "sql" |
|---|---:|---:|
| `ILIKE '%x%'` | 5974 (93%) | 1861 |
| `~* '\mx\M'` (biên từ) | 2702 (42%) | 1572 |

`ILIKE '%ai%'` khớp 93% số tin vì nó ăn trong "em**ai**l", "tr**ai**ning",
"m**ai**ntain". **Bắt buộc dùng biên từ `\m...\M`**, và phải escape metachar regex
vì kỹ năng thật chứa `/`, `+`, `.`, `-` (`ci/cd`, `c++`, `node.js`, `vega-lite`).

### 2.4 Chi phí truy vấn

Quét biên từ tốn **~250ms cho mỗi kỹ năng trên toàn bộ 6432 tin** (đo: 15 kỹ năng
= 3705ms). Tuyến tính theo số kỹ năng.

**Hệ quả kiến trúc:** không bao giờ chấm điểm cả kho trong một request. Luôn truyền
vào một danh sách job cụ thể (một trang kết quả ≤ 50 tin), hoặc một shortlist đã lọc
sẵn bằng cột rẻ.

### 2.5 Từ vựng

| Trường | Giá trị |
|---|---|
| `fct_jobs_daily.city_canonical` | HCMC (3099), Hanoi (2100), rỗng (1077), Da Nang (77), Hai Phong (34), Can Tho (18), Binh Duong (12), Dong Nai (10), Bac Ninh (5) |
| `fct_jobs_daily.job_level` | Mid-level (3157), Senior (1608), Fresher/Entry level (838), Manager (523), Intern/Student (166), Director+ (140) |
| `app.users.experience_level` | `student` \| `fresher` \| `experienced` \| `manager` |
| `silver_skill_long.skill_weight` | chỉ nhận 0 (2838) hoặc 100 (2968) — nhị phân, không phải thang liên tục |

`experience_level` và `job_level` là **hai bộ từ vựng khác nhau**, phải có bảng nối.

---

## 3. Kiến trúc chung

```
                    ┌──────────────────────────────────┐
                    │  job_fit.score_jobs()            │
                    │  SQL + Python thuần, KHÔNG LLM   │
                    │  vào: user + [(source, sjid)]    │
                    │  ra : điểm 0-100 + lý do + gaps  │
                    └───────────────┬──────────────────┘
                                    │ (một engine duy nhất)
         ┌──────────────┬───────────┼───────────┬──────────────┐
         ▼              ▼           ▼           ▼              ▼
   Panel chi tiết   Rerank     "Focus job    Insight      Trang công ty
   (nhóm 1)        (nhóm 1)     nào" (n.1)   (nhóm 3)      (nhóm 4)
                                                 │
                                                 ▼
                                          Soạn thư (nhóm 2)
                                     dùng missing_skills để
                                     thư nói đúng chỗ mạnh/yếu
```

**Nguyên tắc xuyên suốt: số liệu tính bằng code, LLM chỉ viết câu văn.**
Đây là cách `recommendations.py` đã làm và nó đúng. LLM không được tự tính toán —
nó nhận số đã tính sẵn và diễn đạt lại.

---

## 4. Nhóm 1 — Bộ chấm điểm + panel chi tiết + rerank + focus

### 4.1 Bộ chấm điểm

Module mới `app/services/job_fit.py` (bản nháp đã viết dưới tên `job_match.py`,
cần đổi tên và sửa theo mục 8).

**Năm tiêu chí, trọng số tương đối:**

| Tiêu chí | Trọng số | Nguồn dữ liệu |
|---|---:|---|
| skills | 45 | `silver_skill_long` **HOẶC** biên từ trong JD text |
| title | 20 | `desired_titles` × `fct_jobs_daily.title` |
| city | 15 | `preferred_cities` (chuẩn hoá) × `city_canonical` |
| salary | 12 | `desired_salary_min/max` × `salary_vnd_monthly_min/max/avg` |
| level | 8 | `experience_level` × `job_level` qua bảng nối |

**Chuẩn hoá lại theo tiêu chí có dữ liệu.** Điểm cuối:

```
score = round(100 × Σ(wᵢ × sᵢ) / Σ(wᵢ))   với i chạy trên các tiêu chí CÓ dữ liệu
```

Lý do bắt buộc: một tin không ghi lương sẽ bị trừ 12 điểm dù điều đó chẳng nói gì
về độ phù hợp — đó là phạt người dùng vì lỗ hổng của kho dữ liệu. Chuẩn hoá lại giữ
mọi điểm số trên cùng một thang bất kể tin đó có bao nhiêu trường.

**Hai cơ sở tính điểm kỹ năng, phải phân biệt rõ cho UI:**

| Cơ sở | Khi nào | Công thức | Câu UI nói |
|---|---|---|---|
| `required` | Tin có kỹ năng cấu trúc (33%) | `\|user ∩ job\| / \|job\|` | "Khớp 5/7 kỹ năng tin này yêu cầu" |
| `mentioned` | Tin không có (67%, gồm cả LinkedIn) | `min(hits, 6) / 6` | "Mô tả công việc nhắc tới 4 kỹ năng của bạn" |

Bão hoà ở 6 vì quá ngưỡng đó, nhắc thêm cũng không chứng tỏ hợp hơn. Con số 6 là
**lựa chọn thiết kế chưa được kiểm chứng bằng dữ liệu người dùng thật** — xem mục 11.

**Lọc nhiễu:** loại các kỹ năng quá chung khỏi hồ sơ trước khi quét:
`ai, it, data, cloud, database, english, software, communication, teamwork`.
Cố ý **hẹp hơn** `recommendations._SKILL_STOPWORDS` — danh sách bên đó còn loại cả
tên vị trí (`data engineer`, `backend developer`) vì nó trả lời "nên học gì", mà tên
vị trí thì không học được. Ở đây ngược lại: hồ sơ ghi "data engineer" và JD cũng ghi
"data engineer" là tín hiệu khớp rất mạnh, phải giữ.

**Chặn số kỹ năng quét ở 30**, ưu tiên kỹ năng dài (đặc trưng hơn). Lý do: chi phí
250ms/kỹ năng. Hồ sơ thật trung vị < 15 kỹ năng; người nhập 80 kỹ năng thì 30 cái
dài nhất vẫn là 30 cái phân biệt tốt nhất.

**Hồ sơ rỗng:** không có tiêu chí nào → **không trả điểm**, trả `null` kèm lời mời
điền hồ sơ. Bịa một con số cho hồ sơ trống là phản tác dụng — nó dạy người dùng rằng
điểm số này vô nghĩa.

### 4.2 Panel chi tiết job

`GET /api/jobs/{source}/{source_job_id}` — endpoint mới, cần đăng nhập.

Trả về, lấy từ `silver_job_detail` (đã có sẵn 100% các trường này):

- `job_description_text`, `job_requirement_text` — JD đầy đủ
- `benefits`, `skills`, `industries`, `job_function` (jsonb)
- `years_of_experience`, `employment_type`, `working_days`, `working_from_hour`/`to_hour`
- `company_logo_url`, `company_size_label`, `primary_address`
- `salary_*`, `posted_at`, `expired_at`, `num_of_views`, `num_of_applications`
- `source_url` — link ứng tuyển gốc
- **`match`**: đối tượng điểm từ 4.1 (hoặc `null` nếu hồ sơ rỗng)

**Bảo mật — bắt buộc:** `job_description_text` là **HTML/text do bên thứ ba cung
cấp**, chưa bao giờ được render trong app. Frontend **không được** dùng
`dangerouslySetInnerHTML` cho trường này. Render như văn bản thuần, ngắt dòng bằng
CSS. Đây là bề mặt XSS lưu trữ mới nếu làm sai.

**Frontend:** panel trượt từ phải (`Sheet`), không phải trang mới — người dùng đang
lướt danh sách, đẩy họ sang trang khác làm mất ngữ cảnh và mất vị trí cuộn.
URL đồng bộ qua `?job=<source>:<sjid>` để chia sẻ được và Back đóng panel.

### 4.3 Rerank + "nên focus job nào"

**Rerank:** thêm `sort=match` vào `GET /api/jobs`. Luồng:

1. Lọc bằng cột rẻ trên `fct_jobs_daily` (city / level / salary / category / từ khoá)
2. Lấy shortlist tối đa **300 tin** mới nhất thoả bộ lọc
3. Chấm điểm 300 tin đó (~0.3s theo phép đo 2.4)
4. Sắp xếp theo điểm, phân trang trên kết quả đã sắp

**Giới hạn phải nói thẳng ra trên UI:** "Đã chấm 300 tin mới nhất khớp bộ lọc".
Cắt bớt âm thầm sẽ đọc thành "đã xét hết kho" trong khi không phải.

**"Nên focus job nào":** không phải tính năng riêng, chỉ là 3 tin điểm cao nhất
trong số **đã lưu mà chưa apply**, kèm lý do. Dữ liệu đã có trong `app.job_applications`
(`status='saved'`). Không cần LLM.

---

## 5. Nhóm 2 — Soạn thư + nhắc follow-up

### 5.1 Hiện trạng đã kiểm chứng

Agent hiện có **đúng 8 công cụ** (`skill_advisor_chain._BASE_TOOLS`):
`query_skill_gap`, `get_cv_writing_guide`, `search_jobs_realtime`,
`list_my_applications`, `get_application_stats`, `edit_cv`, `salary_benchmark`,
`company_hiring`.

**Không có công cụ soạn thư. Không có công cụ tìm kiếm web.** `company_hiring` chỉ
tra kho dữ liệu của chính dự án, không phải internet.

*(Lưu ý kỹ thuật: danh sách `tools:` trong `agent.yaml` là **cấu hình chết** — không
code nào đọc nó. Thêm tool phải sửa `_BASE_TOOLS`.)*

### 5.2 Soạn thư ứng tuyển

Công cụ mới `draft_application_email(source, source_job_id, tone)`.

Đầu vào ghép từ dữ liệu đã có: `users.cv_text` (đã có, đã cắt ở 20k ký tự),
JD của tin, và **`missing_skills` / `matched_skills` từ bộ chấm điểm nhóm 1**.

Đó là lý do nhóm 2 phụ thuộc nhóm 1: thư biết người dùng **mạnh** ở đâu (nhấn vào)
và **thiếu** gì (né hoặc thừa nhận có kế hoạch học) thì mới hơn thư chung chung.

**Không tự gửi.** Trả bản nháp vào ô soạn để người dùng sửa rồi tự gửi. Gửi mail
thay mặt người dùng tới nhà tuyển dụng là hành động không thể thu hồi.

### 5.3 Nhắc follow-up

Thuần deterministic, không LLM: tin `status='applied'` và `applied_at` cách đây
> 7 ngày mà chưa đổi trạng thái → hiện nhắc.

**Điều kiện tiên quyết đã xong:** `applied_at` trước đây **không bao giờ được ghi**
khi người dùng kéo card sang "Đã apply" (`update_application` thiếu logic mà
`create_application` có). Đã sửa ở commit `6ac8f34`. Trước bản vá đó tính năng này
không thể chạy cho bất kỳ ai dùng kéo-thả — tức là đường phổ biến nhất.

**Dữ liệu cũ vẫn hỏng:** các bản ghi tạo trước bản vá vẫn có `applied_at = NULL`.
Cần migration lấp bằng `created_at` cho các dòng `status='applied' AND applied_at IS NULL`.
Đây là ước lượng, không phải ngày thật — chấp nhận được vì thay thế cho *không có gì*.

---

## 6. Nhóm 3 — Viết lại Insight

### 6.1 Vì sao phải viết lại (đã đọc code)

`application_summary.build_summary` (39 dòng) hiện **đưa toàn bộ danh sách đơn ứng
tuyển cho LLM và nhờ nó tóm tắt bằng 180 từ**. Ba vấn đề cụ thể:

1. **LLM tự làm toán.** Nó được yêu cầu "đánh dấu job đã quá 7 ngày" và tự đếm.
   Model đếm sai thì người dùng không có cách nào biết.
2. **Không có fallback.** Khác `recommendations._narrative` (có `_fallback_narrative`),
   hàm này gọi `llm.ainvoke` trần — LLM lỗi là cả thẻ Insight hỏng.
3. **Đầu vào từng luôn rỗng.** Nó đọc `applied_at`, mà trường đó là NULL cho mọi
   người dùng kéo-thả cho tới commit `6ac8f34`.

### 6.2 Thiết kế mới

**Số liệu tính bằng SQL, LLM chỉ viết một câu.**

Phần deterministic (luôn hiện, kể cả khi LLM chết):

- **Phễu:** đã lưu → đã apply → phỏng vấn → offer, kèm tỉ lệ chuyển đổi từng bước
- **Tỉ lệ phản hồi:** % đơn `applied` có chuyển sang trạng thái khác
- **Đơn nguội:** `applied` quá 7 ngày chưa đổi trạng thái (từ 5.3)
- **Nhịp độ:** số đơn/tuần, 8 tuần gần nhất
- **Việc bỏ lỡ:** số tin ≥ 80% phù hợp mà chưa lưu (từ nhóm 1)

LLM chỉ viết **một câu** nêu bật điều đáng chú ý nhất, dựa trên các số đã tính. Lỗi
LLM → bỏ câu đó, số liệu vẫn nguyên.

**"Wow" đến từ đâu:** không phải hiệu ứng động, mà từ việc nói được điều người dùng
chưa tự thấy — *"Bạn apply 12 job Senior nhưng hồ sơ ghi fresher; 9/12 job đó không
phản hồi"*. Đó là thứ chỉ làm được khi có số liệu thật.

---

## 7. Nhóm 4 — Trang công ty

**Không mua API tìm kiếm ở giai đoạn này.** Kho dữ liệu đã có `mart_company_hiring`:
`company_name`, `company_size_label`, `primary_city`, `primary_region`, `n_jobs`,
`avg_views`, `avg_apps`, `avg_salary_vnd`, `min/max_salary_vnd`, `last_seen_at`.

Trang công ty dựng từ đó, cộng danh sách tin đang mở của công ty (kèm điểm phù hợp
từ nhóm 1) và dải lương so với mặt bằng ngành.

**Nó trả lời được điều người tìm việc thật sự hỏi:** công ty này tuyển nhiều không,
trả bao nhiêu, tuyển vị trí gì, có đang tuyển đều không. Chi phí: 0 đồng.

Đánh giá lại chuyện mua API tìm kiếm **sau khi** trang này chạy và đo được người
dùng còn hỏi gì mà nó không trả lời được. Mua trước là mua trong bóng tối.

---

## 8. Mã đã có — tái dùng, không viết lại

| Đã có | Ở đâu | Cách dùng |
|---|---|---|
| `_CITY_CANON` | `recommendations.py:42` | Chuẩn hoá `preferred_cities` → `city_canonical` |
| `_SKILL_STOPWORDS` | `recommendations.py:29` | **Không** dùng trực tiếp — xem 4.1, cần danh sách hẹp hơn |
| `LEVEL_MAP` | `job_matcher.py:37` | **Phải hợp nhất.** Bản nháp `job_match._LEVEL_FIT` đang **nhân bản** kiến thức này. Hai bảng cùng mô tả một thứ mà lệch nhau (`fresher` bên `job_matcher` không gồm `Intern/Student`) là mầm bug. Cách hợp nhất: giữ một nguồn sự thật, `job_matcher` dùng bản phẳng, `job_fit` dùng bản có phân hạng exact/near. |
| `_avg_million_sql` | `recommendations.py:66` | Dùng cho nhóm 4 |
| `email.py` | `app/services/email.py` | Đường gửi mail (Resend) đã có cho 5.2 |
| `application_service` | `app/services/` | `list_applications`, `get_stats` cho nhóm 3 |

**Đặt tên:** bản nháp đang tên `job_match.py`, trong khi đã có `job_matcher.py` —
khác nhau đúng một chữ cái và làm hai việc khác nhau (`job_matcher` lọc nhị phân để
**gửi alert**, bản mới chấm điểm có thang để **hiển thị**). Tên này sẽ gây nhầm.
**Quyết định: đổi tên module mới thành `job_fit.py`.**

---

## 9. Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| Hồ sơ rỗng | Không trả điểm; UI mời điền hồ sơ. **Không** hiện 0% |
| `silver_skill_long` chưa build | `to_regclass` kiểm tra như `jobs.py:88` đã làm; chấm điểm chỉ bằng text |
| `silver_job_detail` thiếu tin | Tiêu chí skills = không có dữ liệu, chuẩn hoá lại 4 tiêu chí còn lại |
| Job hết hạn / không tồn tại | 404, **không** 500 |
| LLM lỗi (nhóm 2, 3) | Số liệu deterministic vẫn hiện đầy đủ; chỉ mất phần câu văn |
| Rerank quá 300 tin | Nói rõ trên UI, không cắt âm thầm |

---

## 10. Cách kiểm chứng

**Test đơn vị** (`_title_score`, `_salary_score`, `_level_score`, `_normalise`,
`_skill_score`) — thuần hàm, không cần DB. Ca bắt buộc:

- Hồ sơ rỗng → `None`, không phải 0
- `salary_min > salary_max` (dữ liệu thật đã có: `qa-bob@local.dev` có min=90000000,
  max=1000) → đổi chỗ, không bỏ qua
- Tin thiếu lương → tiêu chí bị loại, tổng trọng số giảm tương ứng
- Kỹ năng chứa metachar regex (`c++`, `ci/cd`, `node.js`) → không nổ regex

**Test tích hợp trên kho thật** — điều kiện chấp nhận đo được:

1. **Không còn artifact theo nguồn:** chấm mẫu ≥ 20 tin mỗi nguồn; điểm trung bình
   của LinkedIn không được thấp hơn nguồn cao nhất quá 15 điểm. *Đây là phép đo trực
   tiếp chống lại lỗi ở mục 2.1.*
2. **Chi phí:** chấm 50 tin < 600ms; chấm shortlist 300 tin < 1.5s
3. **Không tự khớp sai:** hồ sơ chỉ có kỹ năng nhiễu (`ai`, `data`) → tiêu chí
   skills bị loại, không phải 100%

**Test thủ công qua trình duyệt** trên `http://[::1]/` (KHÔNG dùng cổng 80 — đó là
tunnel VS Code trỏ vào production).

---

## 11. Rủi ro và quyết định còn mở

| Rủi ro | Mức | Ghi chú |
|---|---|---|
| Ngưỡng bão hoà `mentioned = 6` là số tôi chọn, chưa có dữ liệu người dùng | Trung bình | Đặt thành hằng số một chỗ để chỉnh sau khi có phản hồi thật |
| Trọng số 45/20/15/12/8 chưa hiệu chỉnh | Trung bình | Như trên. Cần một vòng đối chiếu với cảm nhận người thật |
| Shortlist 300 tin có thể bỏ sót tin hợp ở vị trí 301+ | Thấp | Nói rõ trên UI. Cách sửa dài hạn: bảng chỉ mục tsvector riêng ở schema `app` (dbt không xoá được) |
| `job_description_text` là dữ liệu bên thứ ba | **Cao** | Tuyệt đối không `dangerouslySetInnerHTML` — xem 4.2 |
| Spec phủ 4 nhóm nên nhóm 2–4 nông hơn nhóm 1 | Đã biết | Người dùng chọn gộp sau khi được cảnh báo. Nhóm 2–4 nên có plan riêng khi tới lượt |

---

## 12. Thứ tự thi công

| # | Việc | Phụ thuộc |
|---|---|---|
| 1 | `job_fit.py` + test đơn vị + test chống artifact theo nguồn | — |
| 2 | `GET /api/jobs/{source}/{sjid}` + panel trượt | 1 |
| 3 | `sort=match` + "nên focus job nào" | 1 |
| 4 | Insight viết lại (số liệu deterministic trước, câu LLM sau) | 1, `6ac8f34` |
| 5 | Migration lấp `applied_at` + nhắc follow-up | 4 |
| 6 | Công cụ soạn thư | 1, 5 |
| 7 | Trang công ty | 1 |

---

## 13. Việc còn treo, không thuộc spec này

- **Quét bảo mật toàn diện** — người dùng đã yêu cầu hai lần, chưa làm
- **9 commit chưa push** lên `origin develop`
- Việc phía người dùng: tạo GitHub Variable `NEXT_PUBLIC_COPILOT_DOCK=1`, tạo secret
  `APP_POSTGRES_PASSWORD`, xoá tài khoản test `%@local.dev` trên production, tắt
  port-forward 80 của VS Code
