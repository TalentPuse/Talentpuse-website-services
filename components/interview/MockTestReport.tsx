"use client";

import { useState } from "react";
import type { MockTestReport as MockTestReportType, QuestionBreakdown } from "@/lib/api";

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color =
    score >= 4 ? "#16a34a" :
    score >= 3 ? "#3b82f6" :
    score >= 2 ? "#f59e0b" :
    "#ef4444";

  return (
    <div className="relative w-28 h-28">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="14" fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-slate-400">/ 5.0</span>
      </div>
    </div>
  );
}

function BreakdownItem({ q, index }: { q: QuestionBreakdown; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 text-left transition-colors"
      >
        <span className="text-sm font-semibold text-slate-900 w-6">#{index + 1}</span>
        <span className="flex-1 text-sm text-slate-700 truncate">{q.question_text}</span>
        <span className={`text-sm font-semibold ${
          q.score && q.score >= 4 ? "text-green-600" :
          q.score && q.score >= 3 ? "text-blue-600" :
          q.score && q.score >= 2 ? "text-amber-600" :
          "text-red-600"
        }`}>
          {q.score?.toFixed(1) ?? "?"}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-3">
          <div>
            <span className="text-xs font-semibold text-green-600">Diem manh:</span>
            <p className="text-sm text-slate-700">{q.strengths || "N/A"}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-amber-600">Can cai thien:</span>
            <p className="text-sm text-slate-700">{q.improvements || "N/A"}</p>
          </div>
          {q.suggested_answer && (
            <div>
              <span className="text-xs font-semibold text-brand-600">Cau tra loi goi y:</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{q.suggested_answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MockTestReport({
  report,
  onBack,
}: {
  report: MockTestReportType;
  onBack: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Bao cao Mock Test</h1>
            <p className="text-sm text-slate-400">{report.session.target_role || "General"}</p>
          </div>
        </div>

        {/* Score */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-8">
          <ScoreGauge score={report.overall_score} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Nhan xet tong</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{report.overall_feedback}</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Chi tiet tung cau</h3>
          {report.questions.map((q, i) => (
            <BreakdownItem key={i} q={q} index={i} />
          ))}
        </div>

        {/* Improvement plan */}
        <div className="bg-brand-50 rounded-2xl border border-brand-200 p-6">
          <h3 className="text-sm font-semibold text-brand-900 mb-3">Ke hoach cai thien</h3>
          <p className="text-sm text-brand-800 whitespace-pre-wrap leading-relaxed">{report.improvement_plan}</p>
        </div>

        <div className="text-center">
          <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors">
            Luyen tap them
          </button>
        </div>
      </div>
    </div>
  );
}
