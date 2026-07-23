"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { BoardData } from "@/app/applications/use-board-data";
import { applicationsApi } from "@/lib/api";
import { findStaleApplied, funnelDiagnosis, sourceBreakdown } from "./insight-stats";

const DISMISS_KEY = "tp_dock_nudge_dismissed";
const SUMMARY_KEY = "tp_dock_summary";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DockInsight({ board }: { board: BoardData }) {
  const { apps, token } = board;
  // Mặc định true để lần render đầu (trước khi đọc localStorage) không loé
  // nudge rồi tắt.
  const [dismissed, setDismissed] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === todayKey());
    const cached = sessionStorage.getItem(SUMMARY_KEY);
    if (cached) setSummary(cached);
  }, []);

  const loadSummary = useCallback(async () => {
    if (!token || apps.length === 0) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await applicationsApi.aiSummary(token);
      setSummary(res.summary_md);
      sessionStorage.setItem(SUMMARY_KEY, res.summary_md);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token, apps.length]);

  // Tự chạy MỘT lần mỗi session; sau đó user tự bấm làm mới. Mỗi lần gọi là
  // một lượt LLM có tính phí, không đáng chạy lại mỗi khi tab được mount lại.
  useEffect(() => {
    if (!summary && !loading && !failed && apps.length > 0) void loadSummary();
  }, [summary, loading, failed, apps.length, loadSummary]);

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
          <button type="button" onClick={() => void loadSummary()} className="text-sm text-brand-600 underline">
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
