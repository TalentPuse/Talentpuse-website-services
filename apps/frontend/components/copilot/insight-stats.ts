import type { Application } from "@/lib/api";

/**
 * Ba phép tính của Insight tab — CỐ Ý không dùng LLM.
 *
 * "Apply 8 job chưa có phỏng vấn nào" là một luật xác định: hỏi model cùng
 * câu đó mỗi lần mở trang vừa tốn tiền vừa cho câu trả lời mỗi lần một khác.
 * Chỉ khối tóm tắt (DockInsight, gọi /api/applications/ai-summary) mới đáng
 * dùng LLM, vì nó thật sự cần diễn đạt tự nhiên.
 */
export type StaleCard = { id: string; title: string; days: number };
export type SourceStat = { source: string; total: number; interviewPlus: number };

const STALE_DAYS = 7;
const FUNNEL_MIN_APPLIED = 8;
const ADVANCED = new Set(["interviewing", "offer"]);

export function findStaleApplied(apps: Application[], today: Date = new Date()): StaleCard[] {
  return apps
    .filter((a) => a.status === "applied" && a.applied_at)
    .map((a) => ({
      id: a.id,
      title: a.title,
      days: Math.floor((today.getTime() - new Date(a.applied_at as string).getTime()) / 86_400_000),
    }))
    .filter((s) => s.days > STALE_DAYS)
    .sort((x, y) => y.days - x.days);
}

export function sourceBreakdown(apps: Application[]): SourceStat[] {
  const map = new Map<string, SourceStat>();
  for (const a of apps) {
    const row = map.get(a.source) ?? { source: a.source, total: 0, interviewPlus: 0 };
    row.total += 1;
    if (ADVANCED.has(a.status)) row.interviewPlus += 1;
    map.set(a.source, row);
  }
  return [...map.values()];
}

export function funnelDiagnosis(apps: Application[]): string | null {
  const applied = apps.filter((a) => a.status === "applied").length;
  const advanced = apps.filter((a) => ADVANCED.has(a.status)).length;
  if (applied < FUNNEL_MIN_APPLIED || advanced > 0) return null;
  return `Bạn đã apply ${applied} job mà chưa có phỏng vấn nào — có thể CV hoặc mức vị trí đang nhắm chưa khớp. Thử hỏi trợ lý xem nên chỉnh gì.`;
}
