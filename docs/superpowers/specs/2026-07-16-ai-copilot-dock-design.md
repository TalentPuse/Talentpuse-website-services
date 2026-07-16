# AI Copilot Dock — Design Spec

**Ngày:** 2026-07-16 · **Trạng thái:** chờ duyệt · **Phạm vi repo:** `apps/frontend` (chính), `apps/backend` (verify/nhỏ)

## 1. Bối cảnh & mục tiêu

User muốn "một con AI ở cạnh phải màn hình" hỗ trợ task cơ bản và đưa insight. Khảo sát cho thấy hạ tầng đã có gần đủ:

- **CopilotKit + AG-UI chạy end-to-end**: `apps/frontend/app/api/copilotkit/route.ts` (runtime single-route, JWT từ cookie `tp_token`, custom `LangGraphCheckpointRunner` đã fix rehydration) → FastAPI `/api/agent` (LangGraph, checkpoint Postgres).
- **Agent skill-advisor** có MCP tools đọc warehouse thật.
- **2 endpoint insight mồ côi**: `GET /api/recommendations` (career roadmap — chưa UI nào gọi) và `POST /api/applications/ai-summary`.
- Trang `/jobs` (filter state React) và `/applications` (Kanban với `changeStatus` PATCH optimistic) — actions của copilot sẽ gọi đúng các hàm này.

**Mục tiêu v1:** dock AI bên phải ở `/jobs` và `/applications`, thấy ngữ cảnh trang, làm hộ task bằng ngôn ngữ tự nhiên, và chủ động đưa insight.

## 2. Quyết định đã chốt (với user)

1. **Quyền của AI:** thấy trang + hành động (không chỉ tư vấn).
2. **Phạm vi v1:** chỉ `/jobs` + `/applications`. `/assistant` giữ nguyên.
3. **Actions v1:** lọc job bằng lời · lưu/đánh dấu apply · kéo card Kanban bằng lời · insight chủ động.
4. **Menu bổ sung:** fit scoring + nudge (v1) · so sánh job / deal lương percentile / soi công ty (v1, agent-side) · CV tailor + interview bridge (v1.5) · Job Scout (tương lai).
5. **Approach:** A — CopilotKit-native dock, actions chạy trong browser qua `useCopilotAction`. Loại B (tự chế SSE protocol — phát minh lại tool-calling) và C (panel tĩnh — không đạt yêu cầu NL actions).

## 3. Kiến trúc

```
┌─ AppShell ─────────────────────────────────────────────────┐
│ SideNav │ main (jobs/applications)      │ CopilotDock      │
│         │  page state (filters/board) ◄─┤  CopilotChat     │
│         │       ▲ useCopilotAction      │  Insight tab     │
│         │       │ (handler = hàm UI)    │  Nudge strip     │
└─────────┴───────┼───────────────────────┴───────┬──────────┘
                  │        useCopilotReadable      │
                  ▼                                ▼
        /api/copilotkit (Next runtime) ──► /api/agent (LangGraph)
                                            ├─ MCP warehouse tools
                                            └─ Postgres checkpoints
```

- **Không endpoint backend mới cho actions** — handler của `useCopilotAction` chạy trong page, gọi đúng state setters / API client sẵn có, nên hành vi khớp 100% với thao tác tay.
- Insight tab gọi thẳng REST (`recommendations`, `ai-summary`) — không vòng qua LLM khi chỉ fetch.

## 4. Thành phần mới (frontend)

| File | Vai trò |
|---|---|
| `components/copilot/CopilotDock.tsx` | Khung dock: header, tab Chat/Insight, collapse (localStorage `tp_copilot_open`), mobile = nút nổi + sheet |
| `components/copilot/DockChat.tsx` | Bọc `CopilotChat` (threadId riêng cho dock) |
| `components/copilot/DockInsight.tsx` | Insight theo trang + nudge strip |
| `components/copilot/useJobsCopilot.ts` | readables + actions cho `/jobs` |
| `components/copilot/useBoardCopilot.ts` | readables + actions cho `/applications` |
| `lib/flags.ts` | thêm `COPILOT_DOCK = process.env.NEXT_PUBLIC_COPILOT_DOCK === "1"` |

Hai trang chỉ thêm: mount `<CopilotDock>` + gọi hook tương ứng. Layout đã flex nên board/list tự co (cột Kanban co theo — đã kiểm chứng hành vi flex ở session này).

## 5. Ngữ cảnh đưa cho AI (`useCopilotReadable`)

- **Chung:** route hiện tại; profile tóm tắt (desired_titles, skills, cities — không đưa dữ liệu nhạy cảm ngoài những gì user tự nhập).
- **/jobs:** filter đang set; trang hiện tại; danh sách job đang hiển thị `{source, source_job_id, title, company, city, salary_million, skills}` (tối đa 20 — đúng per_page).
- **/applications:** đếm theo cột + danh sách card `{id, title, company, status, applied_at, days_since_applied}`.

## 6. Actions v1 (`useCopilotAction`)

| Action | Tham số | Handler làm gì | Xác nhận |
|---|---|---|---|
| `setJobFilters` | `{search?, city?, level?, source?, category?, has_salary?}` | set state filter của `/jobs` (đúng setters UI đang dùng), reset page=1 | Không — vô hại, thấy ngay |
| `captureJob` | `{source, source_job_id, status: "saved"\|"applied"}` | flow của `CaptureButton` (create; nếu đã `saved` mà yêu cầu `applied` → PATCH nâng cấp), cập nhật `trackedKeys` Map | Không — idempotent, toast + undo dễ |
| `moveApplication` | `{application_id, status}` | `changeStatus(id, status)` sẵn có (optimistic + PATCH + rollback) | Không — kéo lại được |
| — | — | **AI không được xoá** ở v1. Không expose action delete. | — |

**Khử nhập nhằng:** AI phải resolve tên → id từ readable context; nếu ≥2 card khớp, action handler trả về danh sách ứng viên để AI hỏi lại — không đoán.

## 7. Khả năng chat (agent-side, không cần UI mới)

- **Fit scoring:** "job này hợp tôi không?" — agent so skills hồ sơ (readable §5) với skills job, trả % + skill thiếu + talking points. Dùng thêm `cv_text` là việc phía agent/backend (không đưa cả CV vào context frontend) — xem §14.4.
- **Deal lương:** dùng `mart_salary_by_level` (percentile theo level+city) — *verify MCP tool đã expose mart này; nếu thiếu → thêm 1 read-tool vào `apps/mcp`*.
- **Soi công ty:** `mart_company_hiring`. Cùng điều kiện verify như trên.
- **So sánh job đã lưu:** từ readable board + chi tiết job qua MCP.

## 8. Insight tab + Nudge

- **/applications:** `POST /api/applications/ai-summary` (nút "Tóm tắt" + auto 1 lần/session, cache sessionStorage). Nudge: job `applied` >7 ngày chưa cập nhật.
- **/jobs:** `GET /api/recommendations` — lần đầu endpoint mồ côi này có UI. Hiện target_roles / market_fit / skill_gaps dạng card gọn + narrative.
- Nudge strip trên đầu dock: tối đa 2 dòng, dismiss được (nhớ theo ngày, localStorage).

## 9. Thread & persistence

- Dock dùng **threadId riêng** (vd `dock:{userId}`), persist qua LangGraph checkpointer — mở lại còn nguyên hội thoại. Không hiện trong room list `/assistant` (v1 chấp nhận 2 dòng hội thoại tách nhau; hợp nhất là việc của sau).

## 10. Flag & rollback

- `NEXT_PUBLIC_COPILOT_DOCK=1` bật dock — **độc lập** với `NEXT_PUBLIC_AI_HOME` (kill-switch của `/assistant`). Tắt flag → 2 trang trở về nguyên trạng, zero ảnh hưởng.

## 11. Lỗi & biên

- **Agent không nhận frontend tools** (rủi ro chính — xem §14): fallback là forward tools qua AG-UI đã được ag-ui-langgraph hỗ trợ; nếu graph hiện tại lờ tools đến từ request thì sửa nhỏ ở chain backend (merge request tools vào bind_tools).
- Action lỗi API → toast + AI nhận kết quả lỗi để nói lại cho user (handler return message).
- Card trùng tên → hỏi lại (§6).
- Insight endpoint lỗi → tab hiện retry, không chặn chat.
- `tp_token` hết hạn → dock hiện trạng thái đăng nhập lại, không crash trang.

## 12. Testing

- Unit: 2 hook copilot (action handlers gọi đúng hàm, disambiguation trả candidates).
- E2E tay theo kịch bản: lọc bằng lời → filter đổi; "lưu job X" → nút card đổi trạng thái; "chuyển X sang phỏng vấn" → card nhảy cột + reload còn nguyên (pattern verify như session này); tắt flag → biến mất.
- Typecheck + console sạch (baseline hiện có 1 warning forwardRef cũ, không tăng).

## 13. Roadmap

- **v1.5:** (a) **CV tailor theo job** — nối `cv_tailor` + container `tp-latex` (đã render PDF production) với job description → "may đo CV cho job này" ra PDF; (b) **Interview bridge** — nút/action tạo interview session với `target_role` + skills từ job/card.
- **Tương lai — Job Scout tự hành:** agent nền hằng ngày quét job mới → chấm fit → tự đưa top vào cột "Đã lưu" (opt-in) + báo Telegram. Tận dụng alert loop + Telegram + tracker. Kiến trúc dock không được chặn đường này: giữ action layer tách khỏi UI (hooks) để scout tái dùng logic capture.
- Ý tưởng đã ghi nhận nhưng chưa xếp lịch: trend theo thời gian từ snapshot `fct_jobs_daily`, weekly digest, paste-URL-tạo-card, cover letter.

## 14. Việc phải verify khi implement (trước khi code UI)

1. **ag-ui-langgraph có forward frontend tools vào graph không** — đọc `.agents/skills/copilotkit-agui` trong repo + research session 5c5e035c; thử 1 action echo trước.
2. **MCP tools hiện có** đã phủ `mart_salary_by_level` / `mart_company_hiring` chưa (`apps/mcp/tools/`).
3. Trạng thái `NEXT_PUBLIC_AI_HOME` trên prod (CopilotKit path đã bật thật chưa) — quyết định độ tin cậy của đường runtime.
4. Agent phía backend truy cập được hồ sơ user (skills, `cv_text`) qua tool/chain nào — cần cho fit scoring sâu; nếu chưa có thì v1 chỉ dùng skills từ readable, `cv_text` để v1.5.
