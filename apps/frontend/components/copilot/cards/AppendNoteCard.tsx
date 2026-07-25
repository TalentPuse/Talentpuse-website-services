"use client";
import type { DockToolCardProps } from "../copilot-bridge";

/**
 * Card cho `append_note`.
 *
 * `status` (prop) là lifecycle của tool-call CopilotKit (inProgress/executing/
 * complete) — "complete" chỉ có nghĩa "handler đã chạy xong", KHÔNG có nghĩa
 * "đã ghi chú thành công". Tool chỉ trả OBJECT JSON ở đúng MỘT nhánh thành
 * công; mọi nhánh KHÔNG ghi gì (ghi chú rỗng, chưa đăng nhập, không tìm thấy
 * card, nhập nhằng nhiều card, API lỗi) vẫn trả CHUỖI THƯỜNG như cũ. Card
 * phải tự phân biệt hai trường hợp đó bằng cách thử JSON.parse(result): parse
 * ra object nghĩa là THÀNH CÔNG, còn lại (chuỗi thường, kể cả parse lỗi, kể cả
 * chưa có result) nghĩa là CHƯA ghi được gì — KHÔNG được hiện tên card như đã
 * ghi xong trong trường hợp đó.
 *
 * `result` ở nhánh thất bại KHÔNG được render nguyên văn: nó viết cho AGENT
 * đọc, có thể chứa id nội bộ (uuid) của các card ứng viên — agent đã diễn giải
 * lại đúng tiếng Việt ngay bên dưới card rồi, card không cần và không được
 * lặp lại chuỗi đó.
 *
 * `parseSuccessPayload` chỉ đảm bảo kết quả JSON.parse là MỘT OBJECT — nó
 * KHÔNG đảm bảo các field bên trong đúng kiểu (không có zod validate ở
 * runtime này, xem ghi chú trong copilot-bridge.tsx). `message`/`line`/`card`
 * vẫn có thể là object, mảng, số... nếu agent hoặc một handler tương lai lỡ
 * gửi sai hình dạng. Bug đã từng xảy ra ở MoveApplicationCard theo đúng lớp
 * này: một giá trị không phải string lọt xuống JSX khiến React throw "Objects
 * are not valid as a React child" — và vì app này KHÔNG có ErrorBoundary nào,
 * throw đó làm trắng luôn cả trang /applications (dock render cùng cấp với
 * nội dung trang). Vì vậy MỌI field đọc từ payload hay từ parameters đều phải
 * qua `typeof x === "string"` trước khi tới JSX — không có ngoại lệ.
 */
type NotePayload = { message?: unknown; line?: unknown; card?: unknown };

/**
 * Trả payload nếu `result` parse được thành một JSON OBJECT (⇒ tool thành
 * công); trả `null` cho mọi trường hợp khác — chuỗi thường (handler báo KHÔNG
 * ghi được), JSON không phải object, hoặc `result` chưa có.
 */
function parseSuccessPayload(result: string | undefined): NotePayload | null {
  if (!result) return null;
  try {
    const parsed: unknown = JSON.parse(result);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as NotePayload)
      : null;
  } catch {
    return null; // chuỗi thuần — tool KHÔNG ghi được ghi chú như yêu cầu
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

  const payload = parseSuccessPayload(result);
  if (!payload) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
        Chưa ghi được ghi chú — xem trả lời bên dưới.
      </div>
    );
  }

  const shownName = asStringOrNull(payload.card) ?? cardName;
  const line = asStringOrNull(payload.line);
  const message = asStringOrNull(payload.message);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2 p-3">
      {shownName && <span className="text-sm font-medium text-text">{shownName}</span>}
      {line ? (
        <p className="rounded-md bg-surface px-2 py-1 font-mono text-xs text-text">{line}</p>
      ) : (
        message && <p className="text-xs leading-relaxed text-text-muted">{message}</p>
      )}
    </div>
  );
}
