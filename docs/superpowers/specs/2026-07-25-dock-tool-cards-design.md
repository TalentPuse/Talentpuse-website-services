# Dock Tool Cards (Generative UI) — Design Spec

**Ngày:** 2026-07-25 · **Trạng thái:** đã duyệt · **Phạm vi:** `apps/frontend` · **Flag:** `NEXT_PUBLIC_COPILOT_DOCK`

Tiếp nối [`2026-07-23-board-copilot-design.md`](2026-07-23-board-copilot-design.md) (v1 đã ship) và
[`2026-07-25-dock-v1_5-design.md`](2026-07-25-dock-v1_5-design.md).
Mục tiêu: kết quả tool của dock hiện ra thành **card UI thật** thay vì chỉ một dòng chữ.

---

## 1. Bối cảnh

Dock hiện có 4 frontend tool (`move_application`, `add_application`, `append_note`, và
`start_interview_prep` ở v1.5). Mỗi tool chỉ trả về **một chuỗi** cho agent đọc lại, nên trong chat
người dùng chỉ thấy văn bản — không thấy card nào. Xác nhận bằng test tay 2026-07-25.

Nghiên cứu API (đối chiếu trực tiếp với `node_modules/@copilotkit/react-core@1.62.3`, không tin docs):

| API | Có trong 1.62.3 | Ghi chú |
|---|---|---|
| `useRenderTool({ name, parameters, render })` | ✅ | Renderer riêng theo tên tool, **tách khỏi handler** |
| `useDefaultRenderTool()` | ✅ | Card mặc định cho mọi tool |
| `useHumanInTheLoop` | ✅ | Card có nút, agent treo chờ `respond(...)` |
| `ToolCallStatus` (enum) | ❌ | `v2` barrel export 0 lần — dùng string literal |
| A2UI (`@copilotkit/a2ui-renderer`) | ✅ nhưng **không dùng** | Xem §7 |

`render` **bổ sung**, không thay thế: chuỗi handler vẫn tới agent qua ToolMessage, đồng thời vào prop
`result` của renderer. Nên thêm card **không** làm hỏng luồng hội thoại hiện có.

## 2. Quyết định đã chốt

1. **Ba giai đoạn A → B → C**, mỗi giai đoạn ship được độc lập (§3).
2. **Wrapper thứ hai** `useDockToolCard`, **không** nhét `render` vào `useDockTool` (§4).
3. **Giữ mô hình "không hỏi + Hoàn tác 8s"** của v1. Human-in-the-loop **ngoài phạm vi spec này** —
   nó đảo ngược một quyết định người dùng đã chốt ở v1, nên phải là quyết định riêng, không lẫn vào
   một đợt làm UI.
4. **Không dùng A2UI** (§7).

---

## 3. Ba giai đoạn

### Giai đoạn A — `useDefaultRenderTool()`

Một dòng trong `CopilotDockProvider` (hoặc `DockChat`). Cả 4 tool có card mặc định ngay.

Mục đích thật của giai đoạn này là **kiểm chứng đường renderer chạy được trong dock** trước khi đầu
tư viết card riêng. Cụ thể phải xác nhận: renderer không-`agentId` có bắt được tool call của agent
`talentpuse_assistant` hay không. Nếu không, mọi card riêng ở giai đoạn B đều vô ích — và biết điều
đó sau một dòng code rẻ hơn nhiều so với sau một card hoàn chỉnh.

### Giai đoạn B — `useDockToolCard` + card `move_application`

Card đọc **chỉ** từ `parameters` (tham số tool) và `result` (chuỗi handler trả về). **Không** đổi
handler. `move_application` được chọn vì là thao tác dùng nhiều nhất và dữ liệu cần thiết đã nằm sẵn
trong tham số.

### Giai đoạn C — Handler trả object, card giàu dữ liệu

Nới `DockTool.handler` từ `Promise<string>` sang `Promise<string | object>`. Runtime tự
`JSON.stringify` object, nên card `JSON.parse(result)` được, còn agent nhận JSON đó qua ToolMessage.

**Quy ước bắt buộc khi trả object:** phải có field `message: string` chứa đúng câu mà agent nên nói
lại. Kèm một dòng vào `SYSTEM_PROMPT`: *"Khi tool trả JSON, dùng field `message` để trả lời; KHÔNG
đọc lại JSON thô cho user."* Không có quy ước này, agent sẽ dán JSON vào mặt người dùng.

Chỉ chuyển sang object những tool thật sự cần dữ liệu card không suy ra được từ `parameters`.

---

## 4. `useDockToolCard` — vì sao là wrapper thứ hai

`copilot-bridge.tsx` là file duy nhất được import hook CopilotKit. Nó hiện forward
`{ name, description, parameters, handler }` và **bỏ rơi** `render`, `followUp`, `agentId`, `available`.

**Không gộp `render` vào `useDockTool`.** `useFrontendTool` và `useRenderTool` ghi vào **cùng một key
registry** (`":name"`), nên đăng ký cả hai cho một tool sẽ đá nhau với thứ tự không xác định. Hai
wrapper tách biệt, mỗi tool dùng đúng một cái cho mỗi mục đích:

```ts
// Đã có — không đổi
export function useDockTool(tool: DockTool): void;

// Mới
export type DockToolCardProps = {
  name: string;
  toolCallId: string;
  parameters: Record<string, unknown>;   // PARTIAL khi đang stream — xem §5
  status: "inProgress" | "executing" | "complete";
  result?: string;
};
export function useDockToolCard(card: {
  name: string;
  render: (props: DockToolCardProps) => React.ReactNode;
}): void;
```

`status` khai báo bằng **string literal**, không import `ToolCallStatus` — enum đó không được export
từ `react-core/v2` (grep = 0), chỉ có ở `@copilotkit/core` là phantom dependency.

`DockToolCardProps` do bridge tự định nghĩa để component card **không phải** import CopilotKit —
giữ nguyên bất biến "chỉ bridge biết CopilotKit".

### Ba thứ wrapper phải tự lo

1. **`renderRef`** — y hệt bài học `handlerRef` đã có: renderer bị chốt lúc register, không tự làm
   mới theo render sau.
2. **Component identity ổn định** (`useMemo(..., [])` hoặc module-scope). Nếu type component đổi mỗi
   lần re-register, React unmount card và **mất hết `useState` bên trong nó**.
3. **`useEffect` cleanup** gọi `copilotkit.removeHookRenderToolCall(name)`. `useRenderTool` **không
   tự dọn** — thiếu cleanup thì renderer sống dai hơn trang `/applications`, nên card **tuyệt đối
   không được giữ ref tới state của page**.

---

## 5. Ràng buộc khi viết card

- **`parameters` KHÔNG được zod validate.** Runtime chỉ `partialJSONParse` khi stream, nên mọi field
  có thể `undefined` hoặc thiếu — **kể cả ở nhánh `status === "complete"`**. Guard từng field; không
  destructure thẳng rồi dùng.
- **Chỉ thiết kế 2 trạng thái thị giác**, không 3: `inProgress`/`executing` → cùng một khung đang
  chờ; `complete` → card đầy. Trạng thái `"executing"` có thể trôi qua nhanh hơn một lần paint.
- **Không có `status` lỗi.** Handler throw → `complete` với `result` là `"Error: ..."`. Các handler
  hiện tại đã tự bắt lỗi và trả câu tiếng Việt, nên card cứ hiển thị `result` là đủ; không cần đoán
  lỗi bằng cách so tiền tố chuỗi.
- **Class Tailwind phải là literal** — không ghép động (`bg-${color}-500`), vì purge sẽ cắt mất.
- Card dùng đúng token của board để nhìn đồng bộ: `bg-surface`, `bg-surface-2`, `border-border`,
  `text-text`, `text-text-muted`, `brand-*`, `ring-border`.
- **Không đặt tên `useComponent` trùng tên một tool thật** — nó sẽ **xoá handler** của tool đó.

## 6. Bốn card

| Tool | Card hiện gì | Giai đoạn |
|---|---|---|
| `move_application` | mini card (title, công ty, badge nguồn) + `cột cũ → cột mới` + nút Hoàn tác | B |
| `append_note` | đúng dòng note vừa thêm, kèm timestamp | C |
| `add_application` | preview job + lương so p25/p50/p75 từ warehouse | C |
| `start_interview_prep` | checklist chuẩn bị + percentile lương vị trí | C |

Card `move_application` ở giai đoạn B chỉ cần `parameters.card`, `parameters.status` và `result` —
không cần đổi handler. Nút Hoàn tác trên card là **thêm** vào toast, không thay toast.

**Không đề xuất card "skill công ty này hay đòi"** — kho dữ liệu **không có** chiều skill theo từng
công ty (đã xác minh khi làm `get_company_hiring`). Card cần dữ liệu không tồn tại thì chỉ dẫn tới
việc bịa.

## 7. Vì sao không dùng A2UI

`@copilotkit/a2ui-renderer@1.62.3` có mặt trong `node_modules` nhưng là **transitive dependency**,
không khai báo trong `package.json` — dùng nó tức là dựa vào một thứ tình cờ có mặt.

Ba lý do kỹ thuật, quan trọng hơn:

1. A2UI sinh ra **activity message độc lập**, không gắn `toolCallId` — không thể dùng làm card cho
   một tool call cụ thể, đúng thứ ta cần.
2. Tốn thêm **1-3 LLM call mỗi surface**, vì agent phải tự mô tả UI.
3. Bộ 18 component cơ bản của nó **thiếu Table, Badge, Progress** — đúng những thứ mọi card ở §6 cần
   — và style nằm ngoài design system của app.

Đổi lại chẳng được gì mà `useRenderTool` không làm được rẻ hơn và chắc hơn.

## 8. Test

- **Wrapper**: `useDockToolCard` đăng ký đúng tên; cleanup gọi `removeHookRenderToolCall` khi unmount;
  `renderRef` cho phép render mới chạy mà không cần re-register.
- **Card `move_application`**: render ở `status="inProgress"` với `parameters` **rỗng** không crash;
  render ở `complete` hiện đúng tên card và cột đích; nút Hoàn tác gọi đúng hàm.
- **Regression**: toàn bộ test hiện có phải xanh; 4 tool vẫn hoạt động khi **chưa** có card nào (card
  là lớp bổ sung, không phải điều kiện).
- Gate: `npx tsc --noEmit` exit 0, `npm test` xanh.

## 9. Ngoài phạm vi

- **Human-in-the-loop** cho `add_application` — đảo ngược quyết định "không hỏi + Hoàn tác" của v1,
  cần quyết định riêng. Nếu làm: nhánh Huỷ **bắt buộc** phải gọi `respond(...)`, không gọi là **treo
  thread vĩnh viễn**.
- A2UI (§7).
- Card cho `/jobs` — trang đó chưa có dock.
- Đổi giao diện chat ngoài phần card (theme, layout tin nhắn).

## 10. Ghi chú liên quan

Defect đã biết, **không** thuộc spec này: chat dock rỗng sau reload vì
`GET /api/agent/threads/dock-<userId>/messages` trả 404 (`app/api/agui.py` đòi `thread_id` là UUID và
có `ChatRoom` cùng id). Ảnh hưởng tới card: sau reload, **mọi card đều mất** cùng với history, dù
agent vẫn nhớ hội thoại. Card càng làm defect này dễ thấy hơn.
