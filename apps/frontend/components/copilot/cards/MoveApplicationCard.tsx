"use client";
import type { DockToolCardProps } from "../copilot-bridge";
import { STATUS_LABEL, STATUS_ORDER } from "@/components/applications/StatusSelect";
import type { ApplicationStatus } from "@/lib/api";

/**
 * Card cho tool `move_application`.
 *
 * Chỉ đọc `parameters` + `result` — KHÔNG đụng vào state của trang. Renderer
 * sống dai hơn trang /applications (useRenderTool không tự dọn), nên giữ ref
 * tới state page sẽ rò rỉ.
 *
 * `status` (prop) là lifecycle của tool-call CopilotKit (inProgress/executing/
 * complete) — "complete" chỉ có nghĩa "handler đã chạy xong", KHÔNG có nghĩa
 * "đã chuyển thành công". BoardCopilot chỉ trả OBJECT JSON ở đúng MỘT nhánh
 * thành công (quy ước dùng chung với append_note, ép bằng kiểu ở
 * DockTool.handler); mọi nhánh KHÔNG làm gì (status không hợp lệ, không tìm
 * thấy card, nhập nhằng nhiều card, đã ở đúng cột, API lỗi) vẫn trả CHUỖI
 * THƯỜNG. Card phải tự phân biệt hai trường hợp đó bằng cách thử
 * JSON.parse(result): parse ra object nghĩa là THÀNH CÔNG, còn lại (chuỗi
 * thường, kể cả parse lỗi, kể cả chưa có result) nghĩa là CHƯA làm được gì —
 * KHÔNG được vẽ mũi tên/badge/tên card như đã xong trong trường hợp đó.
 *
 * Ở nhánh thành công, đọc `card`/`to` từ PAYLOAD đã parse (kết quả THẬT) chứ
 * không phải từ `parameters` (thứ model YÊU CẦU) — nếu không, card sẽ vẽ như
 * đã chuyển xong ngay cả khi tool không tìm thấy card hoặc nhập nhằng.
 *
 * `result` ở nhánh thất bại KHÔNG được render nguyên văn: nó viết cho AGENT
 * đọc, có thể chứa id nội bộ (uuid) của các card ứng viên — agent đã diễn giải
 * lại đúng tiếng Việt ngay bên dưới card rồi, card không cần và không được
 * lặp lại chuỗi đó.
 *
 * `parameters` KHÔNG được zod validate (runtime chỉ partialJSONParse) nên mọi
 * field có thể thiếu — kể cả khi status="complete". `payload` sau JSON.parse
 * cũng KHÔNG được zod validate — mọi field đọc từ payload phải guard kiểu y
 * hệt parameters.
 */
export default function MoveApplicationCard({
  parameters,
  status,
  result,
}: DockToolCardProps) {
  const cardName = typeof parameters.card === "string" ? parameters.card : null;

  // Chỉ 2 trạng thái thị giác, không 3: "executing" có thể trôi qua nhanh hơn
  // một lần paint nên thiết kế riêng cho nó là công cốc. Ở trạng thái chờ,
  // chưa có kết quả thật nên vẫn phải dùng `parameters` (thứ model yêu cầu).
  if (status !== "complete") {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
        Đang chuyển{cardName ? ` "${cardName}"` : ""}…
      </div>
    );
  }

  const payload = parseSuccessPayload(result);
  if (!payload) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
        Chưa chuyển được — xem trả lời bên dưới.
      </div>
    );
  }

  const payloadCard = typeof payload.card === "string" ? payload.card : null;
  const target = typeof payload.to === "string" ? payload.to : null;
  const message = typeof payload.message === "string" ? payload.message : null;
  // Dùng `.includes` trên STATUS_ORDER (own-key membership) thay vì `target in
  // STATUS_LABEL`: `in` và bracket access đi qua CẢ prototype chain, không chỉ
  // 5 key riêng của object — nên target="__proto__" khiến `in` trả true và
  // STATUS_LABEL["__proto__"] trả về Object.prototype (một object, React sẽ
  // throw khi render). "toString"/"constructor"/... cũng vậy (trả về function).
  // Đừng "đơn giản hoá" lại thành `in` — nhánh else chỉ còn đúng ý nghĩa an
  // toàn khi kiểm tra own-key.
  const targetLabel = target && (STATUS_ORDER as readonly string[]).includes(target)
    ? STATUS_LABEL[target as ApplicationStatus]
    : target;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-text">{payloadCard ?? "Job"}</span>
        {targetLabel && (
          <>
            <span className="text-text-muted">→</span>
            <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-text ring-1 ring-inset ring-border">
              {targetLabel}
            </span>
          </>
        )}
      </div>
      {message && <p className="text-xs leading-relaxed text-text-muted">{message}</p>}
    </div>
  );
}

/**
 * Trả object nếu `result` parse được thành một JSON OBJECT (⇒ tool thành
 * công); trả `null` cho mọi trường hợp khác — chuỗi thường, JSON không phải
 * object (mảng/số/null...), hoặc `result` chưa có. Không phân biệt "chưa parse
 * được" với "chưa có result": cả hai đều phải vẽ card ở dạng trung lập "chưa
 * làm được gì" như nhau.
 */
function parseSuccessPayload(result: string | undefined): Record<string, unknown> | null {
  if (!result) return null;
  try {
    const parsed: unknown = JSON.parse(result);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null; // chuỗi thuần — tool KHÔNG làm được việc được yêu cầu
  }
}
