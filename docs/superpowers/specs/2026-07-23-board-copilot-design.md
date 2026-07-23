# Board Copilot — Design Spec (`/applications` v1)

**Ngày:** 2026-07-23 · **Trạng thái:** đã duyệt · **Phạm vi:** `apps/frontend` (chính), `apps/backend` (2 agent tool)

**Quan hệ với spec trước:** thu hẹp và cập nhật [`2026-07-16-ai-copilot-dock-design.md`](2026-07-16-ai-copilot-dock-design.md).
Spec 16/07 định làm dock cho cả `/jobs` và `/applications`; spec này chốt **chỉ `/applications`, làm sâu**, và
bổ sung use case dựa trên những gì đã lên sau ngày đó (Kanban kéo-thả, luồng saved-từ-job-board).
Những mục spec cũ vẫn còn hiệu lực và **không lặp lại ở đây**: approach A (CopilotKit-native), kiến trúc AG-UI,
thread riêng cho dock (§9), flag & rollback (§10). `/jobs` chưa bị bỏ — hoãn sang đợt sau.

---

## 1. Bối cảnh

Hạ tầng đã sẵn sàng, phần còn thiếu chỉ là đấu nối:

- **Task 1–2 của plan 16/07 đã code xong:** `copilot-bridge.tsx` (`useDockTool` / `useDockContext`, đã verify
  round-trip tool tới agent), `CopilotDockProvider.tsx`, `CopilotDock.tsx` (collapse + tab Chat/Insight +
  mobile sheet), `DockChat.tsx`.
- **Dock không hiện vì chưa trang nào mount `CopilotDock`** — không phải lỗi.
- `POST /api/applications/ai-summary` **đã viết xong** và đã tự đánh dấu job `applied` quá 7 ngày; chưa UI nào gọi.
- Cột `job_applications.notes` (Text) **có trong model nhưng UI Kanban không hiển thị/sửa**.
- MCP đã có `get_salary_analysis`, `get_top_companies`, `query_skill_gap`, `get_skill_trends`.

Trường dữ liệu mỗi card: `source, source_job_id, title, company_name, city, source_url, salary_million,
status, applied_at, notes, created_at, updated_at`. Status hợp lệ: `saved · applied · interviewing · offer · rejected`.

## 2. Quyết định đã chốt (với user, 2026-07-23)

1. **Phạm vi:** chỉ `/applications`, làm sâu. `/jobs` hoãn.
2. **Use case v1:** Tầng 1 (điều khiển board) + Tầng 2 (đọc hiểu pipeline) + Tầng 3 (deal lương, soi công ty).
   Tầng 4 (bắc cầu phỏng vấn/CV) để v1.5.
3. **Bố cục:** dock đẩy board, cột `min-width: 260px`, hết chỗ thì board cuộn ngang — không bóp méo cột.
4. **Xác nhận:** không hỏi trước; mọi thao tác ghi kèm toast Hoàn tác 8s; `append_note` nối thêm chứ không đè.
5. **AI không được xoá card.** Không expose tool delete (giữ nguyên từ spec 16/07 §6).

## 3. Kiến trúc

Không thêm endpoint backend nào cho action. Handler chạy trong browser và gọi đúng hàm UI sẵn có, nên hành vi
của AI khớp 100% với thao tác tay — kể cả optimistic update và rollback.

```
app/applications/page.tsx
  └ CopilotDockProvider                    (đã có — Task 2)
      ├ <BoardCopilot .../>                MỚI — null-render: context + 3 tool
      ├ <ApplicationBoard .../>            SỬA — min-w cột + overflow-x
      └ <CopilotDock page="applications"   (đã có — Task 2)
                     insight={<DockInsight/>}/>   MỚI
                          │
              useDockTool ▼  (bridge đã có — Task 1)
        /api/copilotkit ──► /api/agent (LangGraph + checkpoint Postgres)
                               └ market_tools.py  MỚI ──► MCP warehouse
```

## 4. File

| File | Trạng thái | Vai trò |
|---|---|---|
| `components/copilot/BoardCopilot.tsx` | mới | null-render; `useDockContext` + 3 `useDockTool` |
| `components/copilot/resolve-card.ts` | mới | pure fn khử nhập nhằng tên card → id |
| `components/copilot/DockInsight.tsx` | mới | nudge strip + tỉ lệ chuyển đổi + tóm tắt |
| `components/copilot/__tests__/resolve-card.test.ts` | mới | unit |
| `components/copilot/__tests__/board-copilot.test.tsx` | mới | unit handler |
| `app/applications/page.tsx` | sửa | bọc provider, render `BoardCopilot` + `CopilotDock` |
| `components/applications/ApplicationBoard.tsx` | sửa | `min-w-[260px]` mỗi cột + `overflow-x-auto` |
| `apps/backend/app/services/agent/tools/market_tools.py` | mới | `salary_benchmark`, `company_hiring` |
| `apps/backend/app/services/agent/chains/skill_advisor_chain.py` | sửa | thêm 2 tool vào `_BASE_TOOLS` |
| `apps/backend/tests/test_agent/test_market_tools.py` | mới | unit |

## 5. Tầng 1 — Ba tool điều khiển board

| Tool | Tham số | Handler làm gì |
|---|---|---|
| `move_application` | `card` (tên hoặc id), `status` | gọi `changeStatus()` sẵn có — optimistic + PATCH + rollback |
| `add_application` | `title`, `company?`, `city?`, `salary_million?`, `status`, `applied_at?`, `source_url?` | dùng lại flow của `AddApplicationDialog` |
| `append_note` | `card`, `note` | PATCH `notes`, **nối thêm** dòng `[DD/MM] <note>` vào cuối |

**`add_application` dùng `source="manual"`, `source_job_id=NULL`** — bảng có partial unique index
`(user_id, source, source_job_id) WHERE source_job_id IS NOT NULL`, nên card thêm bằng lời không bao giờ
đụng constraint đó và cũng không vô tình gộp với card đến từ job board.

**`append_note` không bao giờ đè.** Ghi chú user tự viết là dữ liệu không tái tạo được; nối thêm khiến rủi ro
mất chữ bằng 0 mà không cần thêm bước hỏi đáp. Card hiện badge khi `notes` khác rỗng.

**Khử nhập nhằng** (`resolve-card.ts`, thuần, có test):

1. khớp `id` chính xác → trả về ngay
2. khớp `title` chính xác (không phân biệt hoa thường, trim) → trả về
3. khớp chứa (substring, không phân biệt hoa thường)
4. **0 kết quả** → handler trả `{error: "not_found", candidates: []}`
5. **≥2 kết quả** → handler trả `{error: "ambiguous", candidates: [{id, title, company, status}]}`

Ở bước 5 AI **phải hỏi lại**, cấm tự đoán. Đây là ranh giới cứng: một card bị chuyển nhầm cột thì user không
biết mình vừa mất dấu thứ gì.

## 6. Ngữ cảnh đưa cho AI (`useDockContext`)

- Đếm theo cột.
- Danh sách card: `{id, title, company, status, city, salary_million, source, applied_at, days_since_applied}`.
- **Không** đưa `cv_text`, không đưa gì ngoài dữ liệu user tự nhập hoặc tự lưu.

## 7. Tầng 2 — Insight tab

Ba khối, xếp theo độ rẻ. Chỉ khối 3 tốn LLM.

1. **Nudge strip** — job `applied` quá 7 ngày chưa cập nhật. Tính **client-side** từ context, không gọi LLM.
   Tối đa 2 dòng, dismiss được, nhớ theo ngày (`localStorage`).
2. **Tỉ lệ chuyển đổi** — group theo `source` và phễu status. Thuần JS.
3. **Tóm tắt pipeline** — `POST /api/applications/ai-summary`. Auto 1 lần/session + nút làm mới thủ công,
   cache `sessionStorage`.

**Chẩn đoán tắc nghẽn là luật suy ra, không phải LLM:** `applied ≥ 8 && interviewing == 0` → gợi ý xem lại
CV hoặc mức vị trí đang nhắm. Một luật xác định thì luôn đúng và luôn giống nhau; hỏi LLM cùng câu đó mỗi lần
mở trang vừa tốn tiền vừa cho kết quả trôi.

## 8. Tầng 3 — Hai agent tool thị trường (backend)

| Tool | Tham số | Trả về |
|---|---|---|
| `salary_benchmark` | `title`, `city`, `level?` | percentile mức lương thật từ warehouse |
| `company_hiring` | `company` | xu hướng tuyển dụng của công ty |

Bọc quanh MCP `get_salary_analysis` / `get_top_companies` đã có.

**Phải verify TRƯỚC khi code** (kế thừa spec 16/07 §14.2): hai tool MCP đó có trả đúng cắt lát theo `level+city`
và theo tên công ty không. Nếu thiếu → thêm read-tool vào `apps/mcp` trước, đừng ép tool sai hình.

## 9. Bố cục

- `ApplicationBoard`: `overflow-x-auto`, mỗi cột `min-w-[260px]`.
- Dock 380px **đẩy** board (không đè). 1920 thấy đủ 5 cột; 1440 thấy ~3 cột rồi cuộn ngang.
- Mobile giữ nguyên nút nổi + sheet đã có ở `CopilotDock`.
- Token màu dùng bộ sẵn có: `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-text-muted`,
  `brand-*`, `ring-border`. Copy tiếng Việt, identifier tiếng Anh, brand viết "TalentPuse".

Chọn đẩy + cuộn thay vì để flex bóp cột: ở 1440 flex thuần cho ra cột 164px, tên job xuống 3 dòng và badge vỡ
bố cục. Chọn đẩy thay vì đè: dock đè sẽ che đúng cột `Offer`/`Từ chối` — khó chịu nhất đúng lúc AI đang nói về
card bị che.

## 10. Lỗi & biên

- Action lỗi API → toast lỗi + handler **trả message lỗi cho AI** để AI nói lại; không nuốt lỗi.
- Card trùng tên → hỏi lại (§5).
- `ai-summary` lỗi → khối 3 hiện nút thử lại; khối 1 và 2 vẫn chạy vì không phụ thuộc LLM.
- `tp_token` hết hạn → dock hiện trạng thái cần đăng nhập lại, không crash trang.
- Board rỗng → dock gợi ý thêm job đầu tiên thay vì tóm tắt rỗng.

## 11. Test

- **Unit `resolve-card`:** khớp chính xác · khớp chứa · nhập nhằng trả candidates · không tìm thấy.
- **Unit handler:** 3 handler gọi đúng hàm sẵn có; `append_note` nối thêm chứ không đè.
- **Unit backend:** 2 market tool.
- **E2E tay:** "chuyển X sang phỏng vấn" → card nhảy cột, reload còn nguyên · "thêm job…" → card mới ·
  "ghi chú…" → notes nối thêm, chữ cũ còn · Hoàn tác trả về trạng thái trước · tắt flag → dock biến mất sạch,
  board về nguyên trạng.
- Typecheck `npx tsc --noEmit` exit 0; console sạch.

## 12. Ngoài phạm vi

- Tầng 4 (tạo interview session từ card, may đo CV theo JD) → v1.5.
- `/jobs` dock → đợt sau, dùng lại nguyên `resolve-card` và lớp tool.
- `bulk_move` ("dọn hết job bị từ chối") → cần UI xác nhận nhiều card, chưa làm.
- Job Scout tự hành → giữ lớp tool tách khỏi UI để sau này tái dùng, nhưng không code ở v1.

## 13. Ghi chú liên quan

Audit 2026-07-23 phát hiện **kéo card bằng bàn phím không hoạt động** (`ApplicationBoard.tsx`:
`useSensor(KeyboardSensor)` thiếu `coordinateGetter`, vi phạm WCAG 2.1.1). Điều khiển bằng lời vá được một
phần, nhưng **không thay thế** — lỗi đó vẫn phải sửa riêng, ngoài phạm vi spec này.
