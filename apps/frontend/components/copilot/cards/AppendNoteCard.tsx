"use client";
import type { DockToolCardProps } from "../copilot-bridge";

/**
 * Card cho `append_note`. `result` có thể là JSON (handler mới) HOẶC chuỗi
 * thuần (handler cũ) — phải chịu được cả hai, vì card là lớp bổ sung và không
 * được vỡ khi handler chưa kịp đổi.
 *
 * `parsePayload` chỉ đảm bảo kết quả JSON.parse là MỘT OBJECT — nó KHÔNG đảm
 * bảo các field bên trong đúng kiểu (không có zod validate ở runtime này,
 * xem ghi chú trong copilot-bridge.tsx). `message`/`line`/`card` vẫn có thể là
 * object, mảng, số... nếu agent hoặc một handler tương lai lỡ gửi sai hình
 * dạng. Bug đã từng xảy ra ở MoveApplicationCard theo đúng lớp này: một giá
 * trị không phải string lọt xuống JSX khiến React throw "Objects are not
 * valid as a React child" — và vì app này KHÔNG có ErrorBoundary nào, throw
 * đó làm trắng luôn cả trang /applications (dock render cùng cấp với nội
 * dung trang). Vì vậy MỌI field đọc từ payload hay từ parameters đều phải qua
 * `typeof x === "string"` trước khi tới JSX — không có ngoại lệ.
 */
type NotePayload = { message?: unknown; line?: unknown; card?: unknown };

function parsePayload(result: string | undefined): NotePayload | null {
  if (!result) return null;
  try {
    const parsed: unknown = JSON.parse(result);
    return parsed !== null && typeof parsed === "object" ? (parsed as NotePayload) : null;
  } catch {
    return null; // chuỗi thuần, không phải JSON — hợp lệ
  }
}

/** Ép về string hoặc null — chặn mọi giá trị không phải string trước khi vào JSX. */
function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export default function AppendNoteCard({ parameters, status, result }: DockToolCardProps) {
  const cardName = asStringOrNull(parameters.card);

  if (status !== "complete") {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
        Đang ghi chú{cardName ? ` vào "${cardName}"` : ""}…
      </div>
    );
  }

  const payload = parsePayload(result);
  const shownName = asStringOrNull(payload?.card) ?? cardName;
  const line = asStringOrNull(payload?.line);
  const message = asStringOrNull(payload?.message);
  // `result` là string | undefined theo DockToolCardProps nên an toàn để render
  // thẳng làm fallback cuối cùng khi cả payload.message lẫn line đều vắng/sai kiểu.
  const fallbackText = message ?? result;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2 p-3">
      {shownName && <span className="text-sm font-medium text-text">{shownName}</span>}
      {line ? (
        <p className="rounded-md bg-surface px-2 py-1 font-mono text-xs text-text">{line}</p>
      ) : (
        fallbackText && <p className="text-xs leading-relaxed text-text-muted">{fallbackText}</p>
      )}
    </div>
  );
}
