# Board Copilot v1.5 — Design Spec

**Ngày:** 2026-07-25 · **Trạng thái:** đã duyệt · **Phạm vi:** `apps/frontend` (chính), `apps/backend` (prompt)

Tiếp nối [`2026-07-23-board-copilot-design.md`](2026-07-23-board-copilot-design.md) (v1 đã ship).
Ba việc: khớp tên card thông minh hơn, soạn mail follow-up, và bắc cầu sang luyện phỏng vấn.
Tất cả vẫn nằm sau flag `NEXT_PUBLIC_COPILOT_DOCK`.

---

## 1. Bối cảnh

v1 đã chạy: 3 tool ghi board (`move_application`, `add_application`, `append_note`), Insight tab,
2 tool thị trường đọc warehouse. Manual testing 2026-07-25 lộ ra một điểm cụt:

> Nói *"kéo con **BA** qua phỏng vấn"* → AI trả lời *"Không tìm thấy card nào khớp BA"* và phải hỏi lại.

Nguyên nhân: `resolveCard` chỉ khớp `id` → `title` chính xác → `title` chứa. `"ba"` không phải
substring của `"business analyst"`, và tên công ty không được xét. Đây không phải lỗi guard —
guard làm đúng việc; vấn đề là **phạm vi khớp quá hẹp** so với cách người dùng thật gọi tên job.

Hai việc còn lại là Tầng 4 mà spec v1 xếp sang v1.5.

## 2. Quyết định đã chốt (với user, 2026-07-25)

1. Phạm vi: 3 việc (#1 khớp card, #2 mail follow-up, #3 phỏng vấn từ card). Không làm CV-theo-JD
   và Job Scout ở đợt này.
2. #2 **không gửi mail thật** — chỉ soạn nháp trong chat.
3. #3 **không tạo session từ dock** — chỉ điều hướng kèm `target_role` điền sẵn.
4. Giữ nguyên mọi ràng buộc v1: AI không được xoá card, `append_note` chỉ nối thêm,
   nhập nhằng phải hỏi lại, không bịa số liệu.

---

## 3. #1 — Khớp card thông minh

### Bậc khớp (thứ tự ưu tiên, dừng ở bậc đầu tiên có kết quả)

| Bậc | Khớp gì | Ví dụ | Trạng thái |
|---|---|---|---|
| 1 | `id` chính xác | `8f2c8a8b-…` | đã có |
| 2 | `title` chính xác (bỏ hoa thường, trim) | "Data Analyst" | đã có |
| 3 | `title` chứa | "databricks" → AI ＆DATA Scientist/Databricks | đã có |
| 4 | `company_name` chính xác, rồi chứa | "SUNJIN" → Data Analyst | **mới** |
| 5 | Chữ cái đầu của các từ trong `title` | "BA" → **B**usiness **A**nalyst | **mới** |

Chuẩn hoá dùng chung cho mọi bậc từ 2 trở đi: lowercase, trim, **gộp khoảng trắng liên tiếp
thành một**, và **bỏ dấu tiếng Việt** (NFD + strip combining marks). Bỏ dấu để "phong van"
khớp "Phỏng vấn" và "SUNJIN VIET NAM" khớp "SUNJIN VIỆT NAM" — người dùng gõ nhanh thường
không bỏ dấu.

### Vì sao nới lỏng ở đây an toàn

Guard nhập nhằng không đổi: mọi bậc, nếu ≥2 card khớp thì trả `ambiguous` kèm danh sách ứng
viên và AI **phải hỏi lại**. Nới lỏng chỉ làm tăng số lần hỏi lại, không tăng số lần ghi sai.

Rủi ro thật sự duy nhất: nới lỏng biến một `not_found` thành **đúng một** kết quả sai. Chặn bằng
hai luật:

- **Bậc 5 chỉ nhận khớp toàn bộ.** `"BA"` khớp `"Business Analyst"` (B+A). `"BA"` **không**
  khớp `"Business Analyst Senior"` (B+A+S). Khớp một phần chữ cái đầu bị loại — nếu không,
  `"DE"` sẽ khớp cả `"Data Engineer"` lẫn `"Data Engineer Senior"` theo cách khó đoán.
- **Bậc 5 cần từ 2 chữ cái trở lên.** Một chữ cái ("D") khớp quá nhiều thứ, và người dùng
  không bao giờ gọi job bằng một chữ.

### Định nghĩa chính xác

**"Từ" ở bậc 5:** tách `title` theo mọi ký tự **không phải chữ/số** (khoảng trắng, `/`, `|`,
`＆`, `-`), bỏ token rỗng, lấy ký tự đầu của mỗi token còn lại. **Không lọc stopword** — giữ cả
"in", "and". Lý do: lọc stopword tạo ra hai bộ chữ cái đầu cho cùng một title (có lọc / không
lọc) và người dùng không thể đoán bộ nào đang dùng. Không lọc thì luật đơn giản và đoán được.
Hệ quả: `"AI ＆DATA Scientist/Databricks in Japan and VN"` có chữ cái đầu là `adsdijav` —
không ai gõ vậy, vô hại.

**Bậc có 2 tầng con (bậc 2 và bậc 4):** thử "chính xác" trước; nếu chính xác cho **≥2** kết quả
thì trả `ambiguous` **ngay**, không rơi xuống tầng "chứa". Rơi xuống sẽ làm tập kết quả rộng
hơn tập đã nhập nhằng — vô nghĩa.

### Ranh giới bậc 4 vs bậc 5

Bậc 4 (công ty) đứng **trước** bậc 5 (chữ cái đầu) vì tên công ty là dữ liệu người dùng thấy
ngay trên card, còn chữ cái đầu là suy diễn. Nếu một truy vấn khớp cả hai bậc, bậc 4 thắng và
bậc 5 không chạy.

### Ca biên đã quyết

- Card có `company_name = null` → bỏ qua ở bậc 4, không lỗi.
- Query rỗng / chỉ khoảng trắng → `not_found` (như v1).
- Hai card cùng công ty ("Business Analyst" và "AI Engineer" đều ở Permate) → bậc 4 trả
  `ambiguous` với cả hai. Đúng ý muốn: AI hỏi *"job nào ở Permate?"*.

## 4. #2 — Soạn mail follow-up

**Không code mới.** Mọi dữ liệu cần thiết đã nằm trong context dock từ v1: `title`, `company`,
`status`, `days_since_applied`, và `notes` (nơi user/AI ghi tên HR, lịch hẹn). CopilotKit đã tự
render nút **Copy** cho mỗi câu trả lời của assistant.

Việc cần làm: thêm hướng dẫn vào `SYSTEM_PROMPT`
(`apps/backend/app/services/agent/prompts/skill_advisor_prompt.py`):

- Khi user xin soạn mail/tin nhắn follow-up cho một job → viết nháp **tiếng Việt**, dùng đúng
  tên job + công ty từ context, và tên người liên hệ nếu `notes` có.
- Nếu `notes` không có tên người liên hệ → dùng cách mở trung tính ("Kính gửi anh/chị phụ trách
  tuyển dụng"), **không bịa tên**.
- Độ dài: dưới 150 từ. Không kèm giải thích trước/sau — user chỉ cần bấm Copy.
- **Không bao giờ nói là đã gửi.** Nói rõ đây là bản nháp để user tự gửi.

**Cố ý không gửi mail thật.** Backend có sẵn Resend, nhưng gửi thay người dùng là hành động
không thu hồi được, cần địa chỉ người gửi của họ, và một mail sai gửi cho nhà tuyển dụng thì
không có nút Hoàn tác nào cứu được.

## 5. #3 — Luyện phỏng vấn từ card

### Vì sao không tạo session từ dock

`POST /api/interview-agent/sessions` cần `mode` (`technical` | `behavioral`). Dock không biết
user muốn mode nào, nên tạo session từ dock buộc phải **đoán hộ**, và mỗi lần user đổi ý sẽ để
lại một session mồ côi trong DB. Thay vào đó dock chỉ điều hướng và điền sẵn `target_role`;
user vẫn tự chọn mode như bình thường.

### Thay đổi

| File | Việc |
|---|---|
| `components/copilot/BoardCopilot.tsx` | Tool mới `start_interview_prep(card)` — resolve card, `router.push('/interview?role=<title>')`, trả 1 câu cho agent |
| `app/interview/page.tsx` | Đọc `useSearchParams().get("role")`, truyền xuống `InterviewModeSelect` |
| `components/interview/InterviewModeSelect.tsx` | Thêm prop `initialTargetRole?: string`, seed state nội bộ |

`InterviewModeSelect` hiện giữ `target_role` ở state nội bộ và chỉ nhận props `loading` +
`onStart(mode, {target_role?})`. Thêm một prop optional là đủ; không đổi `onStart`.

`start_interview_prep` là **tool đọc + điều hướng**, không ghi dữ liệu nào — nên không cần
toast Hoàn tác. Vẫn dùng `resolveCard` và vẫn hỏi lại khi nhập nhằng, giống mọi tool khác.

### Ca biên

- Không tìm thấy card → không điều hướng, trả message để AI hỏi lại.
- Card ở cột `rejected` → vẫn cho luyện (user có thể muốn rút kinh nghiệm), không chặn.
- `role` trong URL có ký tự đặc biệt (`AI ＆DATA Scientist/Databricks`) → phải
  `encodeURIComponent`; `/interview` đọc ra đã được decode sẵn bởi `useSearchParams`.

## 6. Test

- **`resolve-card.test.ts`** (pure, rẻ): mỗi bậc mới một ca thành công; bỏ dấu; gộp khoảng
  trắng; `company_name = null`; bậc 5 **từ chối** khớp một phần chữ cái đầu; bậc 5 từ chối
  query 1 chữ cái; hai card cùng công ty → `ambiguous`; bậc 4 thắng bậc 5 khi cả hai khớp.
- **`board-copilot.test.tsx`**: `start_interview_prep` gọi `router.push` với URL đã encode;
  không điều hướng khi `not_found` / `ambiguous`; không gọi API ghi nào.
- **Regression**: 64 test hiện có phải xanh nguyên. Đặc biệt các ca `not_found` của v1 — vài ca
  trong đó có thể **đổi kết quả** vì bậc mới; nếu ca nào đổi, phải sửa ca đó một cách có ý thức
  và ghi rõ lý do, không sửa cho qua.
- Gate: `npx tsc --noEmit` exit 0, `npm test` xanh.

## 7. Ngoài phạm vi

- Gửi mail thật (Resend) — xem §4.
- Chạy phỏng vấn ngay trong dock.
- Sửa `/interview` sâu hơn việc đọc `?role=` (deep-link tới một session cụ thể vẫn chưa có).
- CV theo JD, Job Scout tự hành, so sánh 2 offer — các ý tưởng đã ghi nhận, chưa xếp lịch.

## 8. Ghi chú liên quan

Defect đã biết, **không** thuộc phạm vi spec này: chat của dock rỗng sau reload vì
`GET /api/agent/threads/dock-<userId>/messages` trả 404 (`app/api/agui.py` đòi `thread_id` là
UUID và có `ChatRoom` cùng id). Agent vẫn nhớ history nên vẫn bị gửi lại và tính phí.
