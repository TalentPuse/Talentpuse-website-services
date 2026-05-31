"use client";

import { motion } from "framer-motion";
import type { InterviewAgentSummary } from "@/lib/api";

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(score / 5, 1);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  const color =
    score >= 4 ? "#16a34a" : score >= 3 ? "#3b82f6" : score >= 2 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {score.toFixed(1)}
        </span>
        <span className="text-xs text-slate-400">/ 5.0</span>
      </div>
    </div>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function InterviewSummary({
  summary,
  onNewSession,
}: {
  summary: InterviewAgentSummary;
  onNewSession: () => void;
}) {
  const isTechnical = summary.mode === "technical";

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div {...fadeUp} className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            {isTechnical ? "Technical Interview" : "Behavioral Interview"}
            {summary.question_count > 0 && (
              <span className="text-slate-300">· {summary.question_count} questions</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900">Kết quả phỏng vấn</h2>
        </motion.div>

        {/* Score */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.1 }}
          className="flex justify-center py-4"
        >
          <ScoreGauge score={summary.overall_score} />
        </motion.div>

        {/* Overall feedback */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Nhận xét tổng quan</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{summary.overall_feedback}</p>
        </motion.div>

        {/* Strengths */}
        {summary.strengths.length > 0 && (
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              Điểm mạnh
            </h3>
            <ul className="space-y-2">
              {summary.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                  <span className="text-sm text-slate-600">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Improvements */}
        {summary.improvements.length > 0 && (
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </span>
              Cần cải thiện
            </h3>
            <ul className="space-y-2">
              {summary.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                  <span className="text-sm text-slate-600">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Improvement plan */}
        {summary.improvement_plan && (
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.5 }}
            className="bg-brand-50 rounded-2xl border border-brand-200 p-5"
          >
            <h3 className="text-sm font-semibold text-brand-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              Kế hoạch cải thiện
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {summary.improvement_plan}
            </p>
          </motion.div>
        )}

        {/* New session button */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }} className="text-center pt-2 pb-8">
          <button
            onClick={onNewSession}
            className={`px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors ${
              isTechnical ? "bg-purple-600 hover:bg-purple-700" : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            Phỏng vấn mới
          </button>
        </motion.div>
      </div>
    </div>
  );
}
