# CopilotKit verify — Phase 0

> Nguồn: skill chính chủ đã cài tại `.agents/skills/{react-core,runtime,copilotkit-integrations,copilotkit-upgrade}/` (từ `npx skills add CopilotKit/CopilotKit/skills -y copilotkit`) + type definitions thực tế trong `node_modules/@copilotkit/*@1.62.3` và `node_modules/@ag-ui/*`. KHÔNG trả lời từ memory — mọi câu đều trích dẫn file nguồn cụ thể.
>
> **Lưu ý nền tảng quan trọng:** package `@copilotkit/react-core` ship CẢ v1 (export gốc `@copilotkit/react-core`) LẪN v2 (`@copilotkit/react-core/v2`). Skill khuyến nghị dứt khoát dùng v2: *"Always use `CopilotKit` imported from `@copilotkit/react-core/v2`... Do not use `CopilotKit` from the package root (legacy v1)."* (`react-core/references/provider-setup.md:9`). Toàn bộ câu trả lời dưới đây giả định Task 6-7 dùng `@copilotkit/react-core/v2`.

---

## 1. `<CopilotKit>` forward JWT xuống runtime bằng prop nào (`headers`?)?

**→ ĐÚNG, tên prop là `headers`.**

```ts
headers?: Record<string, string> | (() => Record<string, string>);
```

Nguồn: `node_modules/@copilotkit/react-core/dist/copilotkit-Bp6BD8xe.d.mts:2972` (interface `CopilotKitProviderProps`, dùng bởi `<CopilotKit>` từ `/v2`).

Ví dụ dùng đúng (skill): `.agents/skills/react-core/references/provider-setup.md` — mục "HIGH — Inline object props rebuilt every render":
```tsx
const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
<CopilotKit runtimeUrl="/api/copilotkit" headers={headers} properties={properties} />;
```

**⚠️ Nuance quan trọng cho JWT xoay vòng (rotating token):** skill cảnh báo KHÔNG dùng prop `headers` với `useMemo(() => ..., [])` (deps rỗng) cho token đổi theo phiên — nó "capture token tại mount và không bao giờ refresh". Thay vào đó dùng setter mệnh lệnh `copilotkit.setHeaders()` từ `useCopilotKit()`:
```tsx
const { copilotkit } = useCopilotKit();
useEffect(() => {
  copilotkit.setHeaders({ ...copilotkit.headers, Authorization: token ? `Bearer ${token}` : null });
}, [copilotkit, token]);
```
Nguồn: `react-core/references/provider-setup.md` mục "Stable headers for rotating auth tokens" (dòng 93-128).

**Xác nhận end-to-end (server-side):** runtime thực sự forward header `Authorization` (và mọi `x-*` không nằm trong denylist mặc định) từ request gốc vào agent clone trên MỖI request, tự động — không cần code thêm ở Task 6-7:
- `configureAgentForRequest()`: `agent.headers = mergeForwardableHeaders(agent.headers, request, ...)` — `node_modules/@copilotkit/runtime/dist/v2/runtime/handlers/shared/agent-utils.mjs:65`
- Policy mặc định forward `authorization` + `x-*` (trừ danh sách chặn `x-forwarded-*`, `x-amz-*`, `x-vercel-*`, …) — `node_modules/@copilotkit/runtime/dist/v2/runtime/handlers/header-utils.mjs:18-46,117-127`
- Agent clone này (per-request, không phải instance chia sẻ) tới từ `cloneAgentForRequest()` cùng file, dòng 30-40.

---

## 2. `LangGraphHttpAgent` nhận `headers` per-request? Import path chính xác?

**→ Import path: `import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";`**

Xác nhận từ 2 nguồn khớp nhau:
- Skill: `.agents/skills/copilotkit-integrations/references/integrations/langgraph.md:113-144` (mẫu Next.js route `src/app/api/copilotkit/[[...slug]]/route.ts`, dùng cho self-hosted FastAPI/AG-UI LangGraph server, port mặc định 8123, có dấu `/` cuối URL).
- Type thực tế: `node_modules/@copilotkit/runtime/dist/langgraph.d.mts:3` re-export `LangGraphHttpAgent` từ `./lib/runtime/agent-integrations/langgraph/agent.mjs`, và file đó (`agent.d.mts:5,24`) chỉ re-export nguyên con từ `@ag-ui/langgraph` (không override) — class thật: `declare class LangGraphHttpAgent extends HttpAgent {}` (`node_modules/@ag-ui/langgraph/dist/index.d.mts:287`).

**→ CÓ, nhận `headers` per-request — nhưng cơ chế khác với LangGraphAgent (deploymentUrl variant):**

`LangGraphHttpAgent` kế thừa `HttpAgent` từ `@ag-ui/client`, có field mutable `headers: Record<string, string>` (config ban đầu qua `HttpAgentConfig.headers?: Record<string, string>` — `node_modules/@ag-ui/client/dist/index.d.mts:31-35,364-366`). Field này KHÔNG phải tham số của `runAgent()` mỗi lần gọi — nó là property trên agent instance. Nhưng CopilotKit runtime tự ghi đè property này TRÊN MỘT CLONE-PER-REQUEST trước khi chạy (xem mục 1: `configureAgentForRequest` dòng 65 `agent.headers = mergeForwardableHeaders(...)`), rồi `HttpAgent.requestInit()` spread `this.headers` vào fetch thật:
```js
// node_modules/@ag-ui/client/dist/index.mjs — class Fe extends Pe (exported as HttpAgent)
requestInit(e){return{method:'POST',headers:{...this.headers,"Content-Type":'application/json',Accept:'text/event-stream'},...}}
```
→ Kết luận: JWT set qua `<CopilotKit headers={...}>` ở FE SẼ tới được LangGraph self-hosted server qua `LangGraphHttpAgent`, tự động, không cần cấu hình `headerFactory` thủ công (field đó — dùng cho `LangGraphAgent`/deploymentUrl variant — chỉ cần khi có custom `Client` tự quản lý, xem cảnh báo tại `@ag-ui/langgraph/dist/index.d.mts:128-136`).

---

## 3. `<CopilotKit>` có prop `threadId` trỏ LangGraph thread không (Phase 1 cần)?

**→ KHÔNG.** `CopilotKitProviderProps` (interface đầy đủ dùng cho `<CopilotKit>` v2, `copilotkit-Bp6BD8xe.d.mts:2969-3100`) KHÔNG có field `threadId`. Đã đọc toàn bộ interface (132 dòng) để xác nhận không sót.

`threadId` thay vào đó là tham số của **từng agent/chat surface riêng lẻ**, không phải của provider gốc:
- `useAgent({ agentId: "default", threadId: "main", ... })` — `.agents/skills/react-core/references/agent-access.md:30-38`
- `<CopilotChat agentId="default" threadId={activeId} />` — `.agents/skills/react-core/references/threads.md:76-103`

**⚠️ CONTRADICTION RISK cho Task 6-7:** nếu plan giả định `<CopilotKit threadId={...}>` ở mức provider — SAI, prop này không tồn tại ở đó. Phải đặt `threadId` trên `useAgent(...)` hoặc component chat cụ thể (`<CopilotChat>`), mỗi component/hook có thể có `threadId` khác nhau. Lưu ý thêm: hai component cùng dùng `(agentId, threadId)` giống nhau sẽ CHIA SẺ state (cache theo WeakMap) — xem "MEDIUM — Two components using the same (agentId, threadId) expecting isolation" (`agent-access.md:259-288`).

---

## 4. `useCopilotAction`'s render có nhận `result` của backend tool không (Phase 2 cần)?

**→ CÓ**, cho cả v1 (`useCopilotAction`) và tương đương v2 (`useRenderTool` / `useFrontendTool({render})`).

- v2 — `RenderToolCompleteProps<S>`: `result: string` khi `status === "complete"` — `copilotkit-Bp6BD8xe.d.mts:2222-2229`. Ví dụ skill (`react-core/references/rendering-tool-calls.md:33-53`):
  ```tsx
  useRenderTool({
    name: "searchDocs",
    parameters: z.object({ query: z.string() }),
    render: ({ status, parameters, result }) => {
      if (status === "inProgress") return <Skeleton />;
      if (status === "executing") return <Card>Searching "{parameters.query}"…</Card>;
      return <Card>{result}</Card>; // result có sẵn khi complete
    },
  });
  ```
- v1 — `CompleteState<T>`: `result: any` khi `status === "complete"` — `copilotkit-Bp6BD8xe.d.mts:25-28` (cùng file, phần định nghĩa `ActionRenderProps` legacy).

**Lưu ý API name:** nếu Task 6-7 viết code mới nên dùng `useRenderTool` (v2, `@copilotkit/react-core/v2`) thay vì `useCopilotAction` (v1, package root) — theo bảng migrate của skill: `useCopilotAction({render})` → `useFrontendTool({render})` hoặc `useRenderTool` (render-only) (`copilotkit-upgrade/SKILL.md:139`). Status là camelCase (`"inProgress" | "executing" | "complete"`), KHÔNG phải kebab-case `"in-progress"` — lỗi phổ biến bị skill cảnh báo riêng (`rendering-tool-calls.md:156-182`).

---

## 5. API append message chủ động (digest CTA, Phase 1) tên gì?

**→ Pattern chuẩn v2 (khuyến nghị dùng cho Task 6-7): `agent.addMessage()` + `copilotkit.runAgent({ agent })`.**

```tsx
const { agent } = useAgent({ agentId: "default" });
const { copilotkit } = useCopilotKit();

async function ask(text: string) {
  agent.addMessage({ id: crypto.randomUUID(), role: "user", content: text });
  await copilotkit.runAgent({ agent });
}
```
Nguồn: `.agents/skills/react-core/references/agent-access.md:54-64` (mục "Send a message and stream the response"). KHÔNG mutate `agent.messages` trực tiếp (`agent.messages.push(...)`) — bypass subscribers, UI không re-render (cảnh báo `agent-access.md:129-149`).

**⚠️ Phát hiện mâu thuẫn nội bộ trong skill — cần Task 6-7 lưu ý:**
Có một API `sendMessage` khác tồn tại thật trong package đã cài (`node_modules/@copilotkit/react-core/dist/index.d.mts:171`, kiểu `(message: Message, options?) => Promise<void>`), thuộc `useCopilotChat()` / `useCopilotChatHeadless_c()` — nhưng các hook này export từ **package ROOT** (`@copilotkit/react-core`, KHÔNG phải `/v2`). File nguồn của chính skill (`copilotkit-upgrade/references/breaking-changes.md:172-174`) nói thẳng: *"`useCopilotChat` -> removed. Replaced by `useAgent`"*, nhưng bảng deprecation-map cùng skill (`copilotkit-upgrade/references/deprecation-map.md:111`) lại ghi *"`appendMessage` → Use `sendMessage` or agent API"* — mâu thuẫn nội bộ. Vì `<CopilotKit>` của Task 6-7 phải mount từ `/v2` (câu hỏi 1 ở trên), và `useCopilotChat`/`sendMessage` sống ở root export (context v1) — CHƯA có bằng chứng 2 context này tương thích nhau. **Khuyến nghị: dùng `agent.addMessage()` + `copilotkit.runAgent()` (100% v2-native, có ví dụ rõ ràng), KHÔNG dùng `sendMessage`/`useCopilotChat` cho digest CTA.**

---

## Version cài: `@copilotkit/*` == **1.62.3**

```
@copilotkit/react-core@1.62.3
@copilotkit/react-ui@1.62.3   (dedupe react-core@1.62.3)
@copilotkit/runtime@1.62.3
```
Cài bằng `npm install --save-exact` — pin chính xác (không có `^`), xác nhận trong `package.json`. `npm ls` không báo UNMET/invalid peer dependency với react 18.3.1 / next 14.2.18 (chỉ có `npm audit` cảnh báo 14 vulnerabilities không liên quan tới việc cài đặt — pre-existing trong dependency tree, không xử lý ở task này).

---

## Kết luận ảnh hưởng Task 6-7

1. **JWT forward (câu 1-2): plan ĐÚNG nếu giả định prop `headers`** — nhưng phải dùng `copilotkit.setHeaders()` (không phải prop `headers` tĩnh với `useMemo([])`) nếu JWT xoay vòng trong phiên. Với `LangGraphHttpAgent` (self-hosted), không cần code thêm gì ở backend route — runtime tự forward `Authorization` header từ request gốc vào agent clone mỗi request.
2. **`threadId` (câu 3): SỬA CODE nếu plan Task 6-7 đặt `threadId` trên `<CopilotKit>`** — phải chuyển xuống `useAgent({agentId, threadId})` hoặc `<CopilotChat agentId threadId>`. Đây là điểm khả năng cao gây lỗi runtime (`<CopilotKit>` sẽ throw type error / prop bị bỏ qua) nếu Task 6 viết nhầm.
3. **`result` trong render (câu 4): plan ĐÚNG** nếu dùng `useRenderTool`/`useFrontendTool` (v2) — nhưng đổi tên hook từ `useCopilotAction` (v1) sang `useRenderTool`/`useFrontendTool` (v2) để khớp với provider `/v2` đã chọn ở câu 1. Nhớ dùng status camelCase.
4. **Append message chủ động (câu 5): dùng `agent.addMessage()` + `copilotkit.runAgent({agent})`**, KHÔNG dùng `sendMessage`/`useCopilotChat` — API đó thuộc root export (v1-compat), chưa xác minh tương thích với provider `/v2`. Nếu Task 6-7 plan giả định `sendMessage` là API chính — SỬA theo `agent.addMessage()`.
5. Toàn bộ Task 6-7 PHẢI import `CopilotKit` (và mọi hook liên quan) từ subpath `@copilotkit/react-core/v2`, không phải root `@copilotkit/react-core` — nhầm lẫn 2 export surface (v1 vs v2) là rủi ro lớn nhất phát hiện được trong quá trình verify này.
