"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, ICON } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import AIBadge from "@/components/brand/AIBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { applicationsApi } from "@/lib/api";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMd(md: string) {
  return md.split("\n").filter(Boolean).map((line, i) => (
    <p
      key={i}
      className="text-sm leading-relaxed text-text"
      dangerouslySetInnerHTML={{
        __html: escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
      }}
    />
  ));
}

/**
 * AiInsightCard — LLM summary of the user's pipeline.
 *
 * Idle is a single slim row (title left, action right): a full-height card with
 * one button in it read as a big empty box on a wide board. It only grows once
 * there is actually content to show, and the prose is capped at a readable
 * measure rather than running the full width of the board.
 */
export default function AiInsightCard() {
  const { token } = useAuth();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [md, setMd] = useState("");

  async function run() {
    if (!token) return;
    setState("loading");
    try {
      const r = await applicationsApi.aiSummary(token);
      setMd(r.summary_md);
      setState("done");
    } catch {
      setState("error");
      toast.error("Không tạo được tóm tắt");
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-inset ring-brand-500/25">
      <div className="flex items-center gap-2">
        <Sparkles {...ICON} className="h-4 w-4 shrink-0 text-brand-500" />
        <span className="font-display text-sm font-semibold text-text">AI Insight</span>
        <AIBadge label="AI" />
        <span className="hidden truncate text-xs text-text-muted sm:inline">
          — tóm tắt tiến độ và nhắc job cần follow-up
        </span>

        <div className="ml-auto shrink-0">
          {state === "idle" && (
            <Button size="sm" className="ai-gradient text-white" onClick={run}>
              <Sparkles {...ICON} className="h-4 w-4" /> Tóm tắt bằng AI
            </Button>
          )}
          {state === "loading" && (
            <span className="text-xs text-text-muted">Đang tóm tắt…</span>
          )}
          {state === "done" && (
            <Button variant="ghost" size="sm" onClick={run}>
              Cập nhật
            </Button>
          )}
          {state === "error" && (
            <Button variant="outline" size="sm" onClick={run}>
              Thử lại
            </Button>
          )}
        </div>
      </div>

      {state === "loading" && (
        <div className="ai-glow mt-3 max-w-prose space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      )}
      {state === "done" && <div className="mt-3 max-w-prose space-y-1.5">{renderMd(md)}</div>}
    </div>
  );
}
