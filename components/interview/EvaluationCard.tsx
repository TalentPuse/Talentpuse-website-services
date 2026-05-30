"use client";

import { useState } from "react";
import type { Evaluation } from "@/lib/api";

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 4 ? "text-green-600 bg-green-50 border-green-200" :
    score >= 3 ? "text-blue-600 bg-blue-50 border-blue-200" :
    score >= 2 ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-red-600 bg-red-50 border-red-200";

  return (
    <div className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center shrink-0 ${color}`}>
      <span className="text-xl font-bold">{score.toFixed(1)}</span>
      <span className="text-[9px] font-medium opacity-70">/5.0</span>
    </div>
  );
}

export default function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  const [showSuggested, setShowSuggested] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Score header */}
      <div className="flex items-center gap-4 p-5 border-b border-slate-100">
        <ScoreCircle score={evaluation.score} />
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Ket qua danh gia</h4>
          <p className="text-xs text-slate-400 mt-0.5">AI Interview Evaluator</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Strengths */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-green-700">Diem manh</span>
          </div>
          <p className="text-sm text-slate-700 pl-6">{evaluation.strengths}</p>
        </div>

        {/* Improvements */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            <span className="text-sm font-semibold text-amber-700">Can cai thien</span>
          </div>
          <p className="text-sm text-slate-700 pl-6">{evaluation.improvements}</p>
        </div>

        {/* Suggested answer */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowSuggested(!showSuggested)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700 transition-colors"
          >
            <span>Cau tra loi goi y</span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${showSuggested ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showSuggested && (
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{evaluation.suggested_answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
