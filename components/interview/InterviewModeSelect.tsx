"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { InterviewAgentMode } from "@/lib/api";

const ROLE_OPTIONS = [
  "Backend Developer",
  "Frontend Developer",
  "Full-stack Developer",
  "Data Engineer",
  "Data Scientist",
  "AI/ML Engineer",
  "QA Engineer",
  "DevOps Engineer",
  "Mobile Developer",
  "Product Manager",
];

const MODES: {
  id: InterviewAgentMode;
  label: string;
  subtitle: string;
  icon: JSX.Element;
  color: string;
  borderColor: string;
  bgColor: string;
}[] = [
  {
    id: "technical",
    label: "Phỏng vấn Kỹ thuật",
    subtitle: "System design, algorithms, coding — AI sẽ hỏi sâu và đánh giá cách tư duy của bạn",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    color: "text-purple-600",
    borderColor: "border-purple-400",
    bgColor: "bg-purple-50",
  },
  {
    id: "behavioral",
    label: "Phỏng vấn Hành vi",
    subtitle: "STAR method, kỹ năng mềm — AI hướng dẫn bạn trả lời theo cấu trúc chuyên nghiệp",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    color: "text-teal-600",
    borderColor: "border-teal-400",
    bgColor: "bg-teal-50",
  },
];

export default function InterviewModeSelect({
  loading,
  onStart,
}: {
  loading: boolean;
  onStart: (mode: InterviewAgentMode, opts: { target_role?: string }) => void;
}) {
  const [selectedMode, setSelectedMode] = useState<InterviewAgentMode | null>(null);
  const [targetRole, setTargetRole] = useState("");

  const selected = MODES.find((m) => m.id === selectedMode);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Mode cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Chọn chế độ phỏng vấn</h3>
        <p className="text-xs text-slate-400 mb-4">
          AI sẽ đóng vai interviewer và đặt câu hỏi phù hợp với vị trí bạn chọn
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODES.map((mode) => (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedMode(selectedMode === mode.id ? null : mode.id)}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                selectedMode === mode.id
                  ? `${mode.borderColor} ${mode.bgColor} shadow-xs`
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className={`${mode.color} mb-3`}>{mode.icon}</div>
              <div className="text-base font-semibold text-slate-900">{mode.label}</div>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">{mode.subtitle}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Target role input */}
      {selectedMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Vị trí ứng tuyển <span className="text-slate-400">(không bắt buộc)</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="VD: Backend Developer, AI Engineer..."
                list="interview-roles"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <datalist id="interview-roles">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <p className="text-xs text-slate-400">
              AI sẽ tùy chỉnh câu hỏi phỏng vấn phù hợp với vị trí bạn chọn
            </p>
          </div>

          <button
            disabled={loading}
            onClick={() =>
              onStart(selectedMode, {
                target_role: targetRole.trim() || undefined,
              })
            }
            className={`px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 ${
              selected?.id === "technical"
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {loading ? "Đang tạo phiên phỏng vấn..." : `Bắt đầu ${selected?.label ?? ""}`}
          </button>
        </motion.div>
      )}
    </div>
  );
}
