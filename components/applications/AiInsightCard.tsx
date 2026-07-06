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
      className="text-sm text-text"
      dangerouslySetInnerHTML={{
        __html: escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
      }}
    />
  ));
}

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
    <div className="rounded-2xl border border-brand-500/30 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles {...ICON} className="text-brand-500" />
          <span className="font-display font-semibold text-text">AI Insight</span>
          <AIBadge label="AI" />
        </div>
        {state === "done" && (
          <Button variant="ghost" size="sm" onClick={run}>
            Cập nhật
          </Button>
        )}
      </div>
      {state === "idle" && (
        <Button className="ai-gradient text-white" onClick={run}>
          <Sparkles {...ICON} className="h-4 w-4" /> Tóm tắt bằng AI
        </Button>
      )}
      {state === "loading" && (
        <div className="space-y-2 ai-glow">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {state === "done" && <div className="space-y-1.5">{renderMd(md)}</div>}
      {state === "error" && (
        <Button variant="outline" onClick={run}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
