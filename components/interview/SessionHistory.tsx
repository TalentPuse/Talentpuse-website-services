"use client";

import { useEffect, useState } from "react";
import type { InterviewSession, SessionDetail } from "@/lib/api";
import { interviewApi } from "@/lib/api";

export default function SessionHistory({
  token,
  onSelect,
}: {
  token: string;
  onSelect: (session: SessionDetail) => void;
}) {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interviewApi
      .listSessions(token)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || sessions.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Lich su phien</h3>
      <div className="space-y-2">
        {sessions.slice(0, 5).map((s) => (
          <button
            key={s.id}
            onClick={async () => {
              try {
                const detail = await interviewApi.getSession(token, s.id);
                onSelect(detail);
              } catch {}
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-left"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              s.status === "completed" ? "bg-green-400" :
              s.status === "in_progress" ? "bg-blue-400" :
              "bg-slate-300"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  s.mode === "practice" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {s.mode === "practice" ? "Practice" : "Mock Test"}
                </span>
                {s.target_role && (
                  <span className="text-xs text-slate-500 truncate">{s.target_role}</span>
                )}
                {s.category && (
                  <span className="text-xs text-slate-500">{s.category}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {s.completed_questions}/{s.total_questions} cau
                {s.overall_score !== null ? ` · ${s.overall_score.toFixed(1)}/5` : ""}
              </p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              {new Date(s.created_at).toLocaleDateString("vi-VN")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
