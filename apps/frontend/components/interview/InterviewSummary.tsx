"use client";

import { motion } from "framer-motion";
// Target is not in the curated @/lib/icons set — imported directly per task instructions.
import { Target } from "lucide-react";

import type { InterviewAgentSummary } from "@/lib/api";
import GlowCard from "@/components/brand/GlowCard";
import AIBadge from "@/components/brand/AIBadge";
import { CheckCircle2, AlertCircle } from "@/lib/icons";
import { cn } from "@/lib/utils";

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(score / 5, 1);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  const color =
    score >= 4
      ? "var(--success)"
      : score >= 3
        ? "var(--info)"
        : score >= 2
          ? "var(--warning)"
          : "var(--danger)";

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
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
        <span className="font-mono text-3xl font-semibold" style={{ color }}>
          {score.toFixed(1)}
        </span>
        <span className="text-xs text-text-muted">/ 5.0</span>
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
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div {...fadeUp} className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-text-muted">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                isTechnical
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-teal-500/30 bg-teal-500/10 text-teal-300",
              )}
            >
              {isTechnical ? "Technical Interview" : "Behavioral Interview"}
            </span>
            {summary.question_count > 0 && (
              <span className="text-text-muted/70">· {summary.question_count} questions</span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="font-display text-xl font-bold text-text">Kết quả phỏng vấn</h2>
            <AIBadge label="AI đánh giá" />
          </div>
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
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <GlowCard className="p-5">
            <h3 className="text-sm font-semibold text-text mb-2">Nhận xét tổng quan</h3>
            <p className="text-sm text-text-muted leading-relaxed">{summary.overall_feedback}</p>
          </GlowCard>
        </motion.div>

        {/* Strengths */}
        {summary.strengths.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
            <GlowCard className="p-5">
              <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle2 size={13} strokeWidth={2} className="text-success" aria-hidden="true" />
                </span>
                Điểm mạnh
              </h3>
              <ul className="space-y-2">
                {summary.strengths.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 shrink-0" />
                    <span className="text-sm text-text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          </motion.div>
        )}

        {/* Improvements */}
        {summary.improvements.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
            <GlowCard className="p-5">
              <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-warning/15 flex items-center justify-center">
                  <AlertCircle size={13} strokeWidth={2} className="text-warning" aria-hidden="true" />
                </span>
                Cần cải thiện
              </h3>
              <ul className="space-y-2">
                {summary.improvements.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
                    <span className="text-sm text-text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          </motion.div>
        )}

        {/* Improvement plan */}
        {summary.improvement_plan && (
          <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
            <GlowCard glow className="border-brand/30 bg-brand/10 p-5">
              <h3 className="text-sm font-semibold text-brand mb-2 flex items-center gap-2">
                <Target size={16} strokeWidth={2} aria-hidden="true" />
                Kế hoạch cải thiện
              </h3>
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                {summary.improvement_plan}
              </p>
            </GlowCard>
          </motion.div>
        )}

        {/* New session button */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }} className="text-center pt-2 pb-8">
          <button
            type="button"
            onClick={onNewSession}
            className={cn(
              "rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors",
              isTechnical ? "bg-violet-500 hover:bg-violet-400" : "bg-teal-500 hover:bg-teal-400",
            )}
          >
            Phỏng vấn mới
          </button>
        </motion.div>
      </div>
    </div>
  );
}
