import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type AIBadgeProps = {
  /** Pill label. Defaults to "AI". */
  label?: string;
  className?: string;
};

/**
 * AIBadge — the semantic marker for AI-generated or AI-assisted content.
 * Small gradient pill with a Sparkles glyph; use anywhere content should be
 * flagged as AI output (chat replies, suggested matches, generated
 * summaries).
 */
export default function AIBadge({ label = "AI", className }: AIBadgeProps) {
  return (
    <span
      className={cn(
        "ai-gradient inline-flex select-none items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-transform duration-200 hover:scale-105",
        className
      )}
    >
      <Sparkles size={16} strokeWidth={1.75} className="shrink-0" />
      {label}
    </span>
  );
}
