"use client";

import { useState } from "react";
import { motion } from "framer-motion";
// Code2 / Users are not in the curated @/lib/icons set — imported directly per task instructions.
import { Code2, Users } from "lucide-react";

import type { InterviewAgentMode } from "@/lib/api";
import GlowCard from "@/components/brand/GlowCard";
import AIBadge from "@/components/brand/AIBadge";
import { cn } from "@/lib/utils";

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

type ModeConfig = {
  id: InterviewAgentMode;
  label: string;
  subtitle: string;
  icon: typeof Code2;
  iconAccent: string;
  selectedRing: string;
  cta: string;
};

const MODES: ModeConfig[] = [
  {
    id: "technical",
    label: "Phỏng vấn Kỹ thuật",
    subtitle: "System design, algorithms, coding — AI sẽ hỏi sâu và đánh giá cách tư duy của bạn",
    icon: Code2,
    iconAccent: "text-violet-300",
    selectedRing: "border-violet-500/30 bg-violet-500/10",
    cta: "bg-violet-500 hover:bg-violet-400",
  },
  {
    id: "behavioral",
    label: "Phỏng vấn Hành vi",
    subtitle: "STAR method, kỹ năng mềm — AI hướng dẫn bạn trả lời theo cấu trúc chuyên nghiệp",
    icon: Users,
    iconAccent: "text-teal-300",
    selectedRing: "border-teal-500/30 bg-teal-500/10",
    cta: "bg-teal-500 hover:bg-teal-400",
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
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Chọn chế độ phỏng vấn</h3>
          <AIBadge label="AI Interviewer" />
        </div>
        <p className="text-xs text-text-muted mb-4">
          AI sẽ đóng vai interviewer và đặt câu hỏi phù hợp với vị trí bạn chọn
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            const Icon = mode.icon;
            return (
              <motion.button
                key={mode.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedMode(isSelected ? null : mode.id)}
                aria-pressed={isSelected}
                aria-label={mode.label}
                className={cn(
                  "rounded-[var(--radius-lg)] border p-6 text-left backdrop-blur transition-all",
                  isSelected
                    ? mode.selectedRing
                    : "border-border bg-surface hover:border-border hover:bg-surface-2",
                )}
              >
                <div className={cn("mb-3 inline-flex", mode.iconAccent)}>
                  <Icon size={32} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div className="text-base font-semibold text-text">{mode.label}</div>
                <div className="mt-1.5 text-xs leading-relaxed text-text-muted">{mode.subtitle}</div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Target role input */}
      {selectedMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlowCard className="p-5 space-y-4">
            <div>
              <label htmlFor="interview-target-role" className="block text-sm font-medium text-text mb-1.5">
                Vị trí ứng tuyển <span className="text-text-muted">(không bắt buộc)</span>
              </label>
              <input
                id="interview-target-role"
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="VD: Backend Developer, AI Engineer..."
                list="interview-roles"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <datalist id="interview-roles">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <p className="text-xs text-text-muted">
              AI sẽ tùy chỉnh câu hỏi phỏng vấn phù hợp với vị trí bạn chọn
            </p>
          </GlowCard>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              onStart(selectedMode, {
                target_role: targetRole.trim() || undefined,
              })
            }
            className={cn(
              "rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-40",
              selected?.id === "technical" ? MODES[0].cta : MODES[1].cta,
            )}
          >
            {loading ? "Đang tạo phiên phỏng vấn..." : `Bắt đầu ${selected?.label ?? ""}`}
          </button>
        </motion.div>
      )}
    </div>
  );
}
