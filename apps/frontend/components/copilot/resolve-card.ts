import type { Application } from "@/lib/api";

/**
 * Tên card → card, dùng cho mọi tool của dock.
 *
 * Thứ tự khớp là cố ý và dừng ở bậc đầu tiên có kết quả:
 *   1. id chính xác
 *   2. title chính xác  → 3. title chứa
 *   4. công ty chính xác → công ty chứa
 *   5. chữ cái đầu của title (>=2 ký tự, phải khớp TOÀN BỘ)
 *
 * Nới lỏng ở đây an toàn vì guard nhập nhằng không đổi: ≥2 card khớp thì trả
 * `ambiguous` để AI hỏi lại. Nới lỏng chỉ làm tăng số lần hỏi, không tăng số
 * lần ghi sai. Rủi ro duy nhất là biến một `not_found` thành ĐÚNG MỘT kết quả
 * sai — chặn bằng 2 luật ở bậc 5: phải khớp toàn bộ chữ cái đầu, và query phải
 * từ 2 ký tự. Đoán bừa nghĩa là chuyển nhầm cột một job mà user không hề biết
 * mình vừa mất dấu thứ gì.
 */
export type ResolveResult =
  | { ok: true; card: Application }
  | { ok: false; reason: "not_found"; candidates: [] }
  | { ok: false; reason: "ambiguous"; candidates: Application[] };

const NOT_FOUND: ResolveResult = { ok: false, reason: "not_found", candidates: [] };

/** Số ký tự tối thiểu để bậc 5 chịu chạy — 1 chữ cái khớp quá nhiều thứ. */
const MIN_INITIALS_LEN = 2;

/**
 * Chuẩn hoá để so khớp: bỏ dấu tiếng Việt, lowercase, gộp khoảng trắng.
 * Bỏ dấu vì user gõ nhanh thường không bỏ dấu ("sunjin viet nam").
 * `đ` không phân rã được bằng NFD nên phải thay tay, sau khi đã lowercase.
 */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Chữ cái đầu của mỗi từ trong title. Tách theo mọi ký tự không phải chữ/số
 * (khoảng trắng, `/`, `|`, `＆`, `-`) và KHÔNG lọc stopword: lọc sẽ tạo hai bộ
 * chữ cái đầu cho cùng một title và user không đoán được bộ nào đang dùng.
 */
function initials(title: string): string {
  return norm(title)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

/**
 * 1 kết quả → khớp; ≥2 → ambiguous NGAY (không rơi xuống tầng rộng hơn, vì
 * tập rộng hơn cũng vẫn nhập nhằng); 0 → null để caller thử bậc tiếp theo.
 */
function decide(matches: Application[]): ResolveResult | null {
  if (matches.length === 1) return { ok: true, card: matches[0] };
  if (matches.length > 1) return { ok: false, reason: "ambiguous", candidates: matches };
  return null;
}

export function resolveCard(apps: Application[], query: string): ResolveResult {
  const q = norm(query);
  if (!q) return NOT_FOUND;

  const byId = apps.find((a) => a.id === query.trim());
  if (byId) return { ok: true, card: byId };

  const stages: Application[][] = [
    apps.filter((a) => norm(a.title) === q),
    apps.filter((a) => norm(a.title).includes(q)),
    apps.filter((a) => a.company_name != null && norm(a.company_name) === q),
    apps.filter((a) => a.company_name != null && norm(a.company_name).includes(q)),
  ];
  if (q.length >= MIN_INITIALS_LEN) {
    stages.push(apps.filter((a) => initials(a.title) === q));
  }

  for (const matches of stages) {
    const result = decide(matches);
    if (result) return result;
  }

  return NOT_FOUND;
}

/** Một dòng cho mỗi ứng viên, đủ để AI hỏi lại user chọn cái nào. */
export function describeCandidates(candidates: Application[]): string {
  return candidates
    .map((c) => `- "${c.title}"${c.company_name ? ` tại ${c.company_name}` : ""} (${c.status}, id=${c.id})`)
    .join("\n");
}
