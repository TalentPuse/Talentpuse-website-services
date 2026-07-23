import type { Application } from "@/lib/api";

/**
 * Tên card → card, dùng cho mọi tool ghi dữ liệu của dock.
 *
 * Thứ tự khớp là cố ý: id → title chính xác → title chứa. Bước "chứa" chỉ
 * được dùng khi CHỈ CÓ MỘT ứng viên; ≥2 thì trả `ambiguous` để AI hỏi lại.
 * Đoán bừa ở đây nghĩa là chuyển nhầm cột một job mà user không hề biết mình
 * vừa mất dấu thứ gì — đắt hơn nhiều so với việc hỏi thêm một câu.
 */
export type ResolveResult =
  | { ok: true; card: Application }
  | { ok: false; reason: "not_found"; candidates: [] }
  | { ok: false; reason: "ambiguous"; candidates: Application[] };

const NOT_FOUND: ResolveResult = { ok: false, reason: "not_found", candidates: [] };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveCard(apps: Application[], query: string): ResolveResult {
  const q = norm(query);
  if (!q) return NOT_FOUND;

  const byId = apps.find((a) => a.id === query.trim());
  if (byId) return { ok: true, card: byId };

  const exact = apps.filter((a) => norm(a.title) === q);
  if (exact.length === 1) return { ok: true, card: exact[0] };
  if (exact.length > 1) return { ok: false, reason: "ambiguous", candidates: exact };

  const partial = apps.filter((a) => norm(a.title).includes(q));
  if (partial.length === 1) return { ok: true, card: partial[0] };
  if (partial.length > 1) return { ok: false, reason: "ambiguous", candidates: partial };

  return NOT_FOUND;
}

/** Một dòng cho mỗi ứng viên, đủ để AI hỏi lại user chọn cái nào. */
export function describeCandidates(candidates: Application[]): string {
  return candidates
    .map((c) => `- "${c.title}"${c.company_name ? ` tại ${c.company_name}` : ""} (${c.status}, id=${c.id})`)
    .join("\n");
}
