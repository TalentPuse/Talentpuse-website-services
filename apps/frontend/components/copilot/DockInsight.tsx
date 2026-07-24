"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { BoardData } from "@/app/applications/use-board-data";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi } from "@/lib/api";
import { findStaleApplied, funnelDiagnosis, sourceBreakdown } from "./insight-stats";

const DISMISS_KEY = "tp_dock_nudge_dismissed";
const SUMMARY_KEY = "tp_dock_summary";
// Key riêng cho trạng thái "đã fetch nhưng fail" — không thể tái dùng
// SUMMARY_KEY vì summary_md rỗng ("") là một kết quả THÀNH CÔNG hợp lệ, còn
// đây là đánh dấu THẤT BẠI; gộp chung hai ý nghĩa vào một giá trị sẽ không
// phân biệt được "" (thành công, rỗng) với "chưa từng fetch được".
const SUMMARY_FAILED_KEY = "tp_dock_summary_failed";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Gắn theo user.id để cache không bị đọc chéo tài khoản: user A logout, user B
// login cùng tab thì sessionStorage vẫn còn nhưng key khác nên bị coi là miss.
// Khi user chưa sẵn sàng (đang hydrate AuthContext) trả về null thay vì rơi về
// một chuỗi cố định — nếu không "tp_dock_summary:undefined" sẽ lại là key
// dùng chung cho mọi tài khoản, tái lập đúng lỗi rò rỉ ban đầu.
function summaryKeyFor(userId: string | null | undefined): string | null {
  return userId ? `${SUMMARY_KEY}:${userId}` : null;
}

// Cùng cách scoping với summaryKeyFor ở trên — cùng lý do (không rò rỉ/đụng
// chéo tài khoản, không đọc/ghi khi userId chưa sẵn sàng).
function failedKeyFor(userId: string | null | undefined): string | null {
  return userId ? `${SUMMARY_FAILED_KEY}:${userId}` : null;
}

export default function DockInsight({ board }: { board: BoardData }) {
  const { apps, token } = board;
  const { user } = useAuth();
  const summaryKey = summaryKeyFor(user?.id);
  const failedKey = failedKeyFor(user?.id);
  // Mặc định true để lần render đầu (trước khi đọc localStorage) không loé
  // nudge rồi tắt.
  const [dismissed, setDismissed] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  // Đánh dấu đã fetch xong (kể cả kết quả rỗng) — tách biệt với `summary`
  // để tránh nhầm "chưa fetch" (null) với "đã fetch ra chuỗi rỗng" (""),
  // xem C1 trong review.
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Chỉ true sau khi effect đọc sessionStorage đã chạy xong, để effect
  // auto-fetch bên dưới đợi đọc cache trước — tránh race C2 (fetch thừa
  // dù đã có cache) mà không cần đụng tới localStorage/sessionStorage
  // trong lazy initializer của useState (điều đó sẽ crash SSR).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === todayKey());
    const cached = summaryKey ? sessionStorage.getItem(summaryKey) : null;
    if (cached) {
      setSummary(cached);
      setHasFetched(true);
    } else if (failedKey && sessionStorage.getItem(failedKey)) {
      // Nhớ lại lượt fetch đã fail của session này — mỗi lần collapse/mở lại
      // dock (desktop) hoặc đóng/mở sheet (mobile) unmount hẳn component này,
      // xoá sạch state `failed` trong bộ nhớ. Nếu không đánh dấu lại từ
      // sessionStorage, effect auto-fetch bên dưới sẽ tưởng đây là lần đầu và
      // bắn lại một lượt gọi LLM CÓ TÍNH PHÍ mỗi lần user mở dock ra, dù
      // không hề bấm nút "Thử lại". Nút "Thử lại" tường minh vẫn hoạt động
      // bình thường vì nó gọi loadSummary() trực tiếp, không đi qua effect này.
      setFailed(true);
    }
    setHydrated(true);
  }, [summaryKey, failedKey]);

  const loadSummary = useCallback(async () => {
    if (!token || apps.length === 0) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await applicationsApi.aiSummary(token);
      setSummary(res.summary_md);
      setHasFetched(true);
      if (summaryKey) sessionStorage.setItem(summaryKey, res.summary_md);
      if (failedKey) sessionStorage.removeItem(failedKey);
    } catch {
      setFailed(true);
      if (failedKey) sessionStorage.setItem(failedKey, "1");
    } finally {
      setLoading(false);
    }
  }, [token, apps.length, summaryKey, failedKey]);

  // Tự chạy MỘT lần mỗi session; sau đó user tự bấm làm mới. Mỗi lần gọi là
  // một lượt LLM có tính phí, không đáng chạy lại mỗi khi tab được mount lại.
  // Gate bằng `hasFetched` (không phải `!summary`) vì summary_md rỗng ("")
  // vẫn là falsy — dùng `!summary` sẽ khiến effect bắn lại vô hạn (C1).
  // Đợi `hydrated` để chắc effect đọc sessionStorage ở trên đã chạy xong,
  // nếu không mỗi lần remount tab sẽ fetch thừa dù đã có cache (C2).
  useEffect(() => {
    if (hydrated && !hasFetched && !loading && !failed && apps.length > 0) void loadSummary();
  }, [hydrated, hasFetched, loading, failed, apps.length, loadSummary]);

  if (apps.length === 0) {
    return <p className="p-4 text-sm text-text-muted">Chưa có job nào được track. Thêm job đầu tiên rồi mình tóm tắt cho.</p>;
  }

  const stale = findStaleApplied(apps);
  const diagnosis = funnelDiagnosis(apps);
  const sources = sourceBreakdown(apps);

  return (
    <div className="flex flex-col gap-4 p-4">
      {!dismissed && (stale.length > 0 || diagnosis) && (
        <section className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 text-sm text-text">
              {stale.length > 0 && (
                <p>
                  <b>{stale.length}</b> job đã apply quá 7 ngày chưa cập nhật — cũ nhất là{" "}
                  <b>{stale[0].title}</b> ({stale[0].days} ngày).
                </p>
              )}
              {diagnosis && <p className="text-text-muted">{diagnosis}</p>}
            </div>
            <button
              type="button"
              onClick={() => { localStorage.setItem(DISMISS_KEY, todayKey()); setDismissed(true); }}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface"
            >
              Ẩn
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Theo nguồn</h3>
        <ul className="flex flex-col gap-1">
          {sources.map((s) => (
            <li key={s.source} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
              <span className="text-text">{s.source}</span>
              <span className="tabular-nums text-text-muted">{s.interviewPlus}/{s.total} vào phỏng vấn</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tóm tắt</h3>
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            aria-label="Làm mới tóm tắt"
            className="rounded-md p-1 text-text-muted hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </button>
        </div>
        {failed ? (
          // disabled={loading} để double-click không bắn 2 lượt LLM tính phí
          // chạy đua cùng ghi sessionStorage (I3).
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            className="text-sm text-brand-600 underline disabled:opacity-50"
          >
            Không tóm tắt được. Thử lại
          </button>
        ) : summary ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{summary}</p>
        ) : (
          <p className="text-sm text-text-muted">Đang tóm tắt…</p>
        )}
      </section>
    </div>
  );
}
