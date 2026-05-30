"use client";

import type { InterviewQuestion } from "@/lib/api";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "De",
  medium: "TB",
  hard: "Kho",
};

export default function QuestionCard({
  question,
  orderIndex,
  total,
  showTips,
  onToggleTips,
}: {
  question: InterviewQuestion;
  orderIndex: number;
  total: number;
  showTips: boolean;
  onToggleTips: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Question card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[question.difficulty] || "bg-slate-100 text-slate-600"}`}>
            {DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
            {question.category}
          </span>
          <span className="text-[10px] text-slate-400 ml-auto">
            Cau {orderIndex}/{total}
          </span>
        </div>

        <p className="text-base font-medium text-slate-900 leading-relaxed">
          {question.text}
        </p>

        {/* STAR cues */}
        {question.star_cues && (
          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Goi y STAR</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(question.star_cues).map(([key, value]) => (
                <div key={key}>
                  <span className="text-[10px] font-semibold text-brand-600 uppercase">{key}</span>
                  <p className="text-xs text-slate-600">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Answer tips */}
      {question.answer_tips && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={onToggleTips}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
          >
            <span>Tips tra loi cau nay</span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${showTips ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showTips && (
            <div className="px-4 pb-4 bg-slate-50/50">
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {question.answer_tips}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
