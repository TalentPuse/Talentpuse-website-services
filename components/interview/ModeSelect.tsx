"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { InterviewCategory } from "@/lib/api";

const ROLE_OPTIONS = [
  "Backend Developer",
  "Frontend Developer",
  "Full-stack Developer",
  "Data Engineer",
  "Data Scientist",
  "AI/ML Engineer",
  "QA Engineer",
  "DevOps Engineer",
];

export default function ModeSelect({
  categories,
  loading,
  onStart,
}: {
  categories: InterviewCategory[];
  loading: boolean;
  onStart: (mode: "practice" | "mock_test", opts: { category?: string; target_role?: string; num_questions?: number; time_limit_seconds?: number }) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [mockTab, setMockTab] = useState<"practice" | "mock_test">("practice");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Tab switch */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setMockTab("practice")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mockTab === "practice" ? "bg-white shadow-xs text-brand-700" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Luyện tập
        </button>
        <button
          onClick={() => setMockTab("mock_test")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mockTab === "mock_test" ? "bg-white shadow-xs text-brand-700" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Mock Test
        </button>
      </div>

      {/* Practice mode */}
      {mockTab === "practice" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Chọn chủ đề</h3>
            <p className="text-xs text-slate-400">Mỗi câu hỏi có tips hướng dẫn trả lời</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedCategory === cat.id
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{cat.label_vi}</div>
                <div className="text-xs text-slate-400 mt-1">{cat.count} câu hỏi</div>
              </button>
            ))}
          </div>

          <button
            disabled={!selectedCategory || loading}
            onClick={() => onStart("practice", { category: selectedCategory!, num_questions: 5 })}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {loading ? "Đang tạo..." : "Bắt đầu luyện tập"}
          </button>
        </motion.div>
      )}

      {/* Mock Test mode */}
      {mockTab === "mock_test" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Thiết lập Mock Test</h3>
            <p className="text-xs text-slate-400">Simulate phỏng vấn thật với timer và báo cáo tổng hợp</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vị trí ứng tuyển</label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="VD: Backend Developer"
                list="roles"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <datalist id="roles">
                {ROLE_OPTIONS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Số câu hỏi</label>
              <select
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30"
              >
                <option value={3}>3 câu</option>
                <option value={5}>5 câu</option>
                <option value={8}>8 câu</option>
                <option value={10}>10 câu</option>
              </select>
            </div>
          </div>

          <button
            disabled={!targetRole.trim() || loading}
            onClick={() => onStart("mock_test", { target_role: targetRole, num_questions: numQuestions, time_limit_seconds: 180 })}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {loading ? "Đang tạo..." : "Bắt đầu Mock Test"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
