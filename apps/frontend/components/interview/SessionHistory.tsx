"use client";

import { useEffect, useState } from "react";
import type { InterviewAgentSession } from "@/lib/api";
import { interviewAgentApi } from "@/lib/api";
import { History } from "@/lib/icons";
import { cn } from "@/lib/utils";

export default function SessionHistory({
  token,
  onSelect,
}: {
  token: string;
  onSelect: (session: InterviewAgentSession) => void;
}) {
  const [sessions, setSessions] = useState<InterviewAgentSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interviewAgentApi
      .listSessions(token)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || sessions.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
        <History size={16} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
        Lịch sử phiên phỏng vấn
      </h3>
      <div className="space-y-2">
        {sessions.slice(0, 5).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={async () => {
              try {
                const detail = await interviewAgentApi.getSession(token, s.id);
                onSelect(detail);
              } catch {
                /* ignore */
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-surface rounded-xl border border-border hover:border-brand/40 hover:bg-surface-2 transition-colors text-left"
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                s.status === "completed"
                  ? "bg-success"
                  : s.status === "in_progress"
                    ? "bg-info"
                    : "bg-text-muted/40",
              )}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    s.mode === "technical"
                      ? "bg-violet-500/10 text-violet-300"
                      : "bg-teal-500/10 text-teal-300",
                  )}
                >
                  {s.mode === "technical" ? "Technical" : "Behavioral"}
                </span>
                {s.target_role && (
                  <span className="text-xs text-text-muted truncate">{s.target_role}</span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {s.question_count > 0 ? `${s.question_count} câu trả lời` : "Chưa bắt đầu"}
                {s.overall_score !== null ? ` · ${s.overall_score.toFixed(1)}/5` : ""}
              </p>
            </div>
            <span className="text-xs text-text-muted shrink-0">
              {new Date(s.created_at).toLocaleDateString("vi-VN")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
