"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
// ArrowLeft is not in the curated @/lib/icons set — imported directly per shared contract.
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import InterviewModeSelect from "@/components/interview/InterviewModeSelect";
import InterviewChat from "@/components/interview/InterviewChat";
import InterviewSummary from "@/components/interview/InterviewSummary";
import SessionHistory from "@/components/interview/SessionHistory";
import { ForceTheme } from "@/components/theme/ForceTheme";
import Aurora from "@/components/brand/Aurora";
import {
  interviewAgentApi,
  type InterviewAgentMode,
  type InterviewAgentSession,
  type InterviewAgentSummary,
} from "@/lib/api";

type Phase = "mode_select" | "chat" | "summary";

export default function InterviewPage() {
  return (
    <ProtectedRoute>
      <ForceTheme theme="dark" />
      <InterviewContent />
    </ProtectedRoute>
  );
}

function InterviewContent() {
  const { token } = useAuth();

  const [phase, setPhase] = useState<Phase>("mode_select");
  const [session, setSession] = useState<InterviewAgentSession | null>(null);
  const [summary, setSummary] = useState<InterviewAgentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyKey, setHistoryKey] = useState(0); // trigger re-fetch after new session

  /* ── Start a new interview session ── */
  const handleStartSession = useCallback(
    async (mode: InterviewAgentMode, opts: { target_role?: string }) => {
      if (!token) return;
      setLoading(true);
      try {
        const s = await interviewAgentApi.createSession(token, {
          mode,
          target_role: opts.target_role,
          num_questions: 5,
        });
        setSession(s);
        setPhase("chat");
      } catch {
        toast.error("Không thể tạo phiên phỏng vấn");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  /* ── End session → get AI summary ── */
  const handleComplete = useCallback((s: InterviewAgentSummary) => {
    setSummary(s);
    setPhase("summary");
  }, []);

  /* ── Resume a past session from history ── */
  const handleResumeSession = useCallback(
    (s: InterviewAgentSession) => {
      setSession(s);

      if (s.status === "completed" && s.overall_score !== null) {
        // Completed session → reconstruct summary from session data
        setSummary({
          session_id: s.id,
          mode: s.mode,
          overall_score: s.overall_score,
          overall_feedback: s.overall_feedback ?? "",
          strengths: [],
          improvements: [],
          improvement_plan: s.improvement_plan ?? "",
          question_count: s.question_count,
        });
        setPhase("summary");
      } else {
        // In-progress → resume chat
        setPhase("chat");
      }
    },
    [],
  );

  /* ── Back to mode select ── */
  const handleNewSession = useCallback(() => {
    setSession(null);
    setSummary(null);
    setPhase("mode_select");
    setHistoryKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      {/* Bespoke minimal dark chrome — this immersive route intentionally skips
          AppShell/SideNav (see WAVE-C2-SHARED.md); just a slim escape hatch back
          to the dashboard plus a page label. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <Link
          href="/dashboard"
          aria-label="Quay lại Dashboard"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <span className="font-display text-sm font-medium text-text-muted">Luyện Phỏng Vấn AI</span>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* Phase 1: Mode select + session history */}
        {phase === "mode_select" && (
          <div className="relative h-full flex flex-col overflow-hidden">
            <Aurora className="opacity-50" />

            {/* Phase header */}
            <div className="relative z-10 px-6 py-5 border-b border-border bg-surface/80 backdrop-blur-sm shrink-0">
              <h1 className="font-display text-xl font-bold text-text">Luyện Phỏng Vấn AI</h1>
              <p className="text-sm text-text-muted mt-1">
                Thực hành phỏng vấn kỹ thuật &amp; hành vi với AI interviewer — nhận feedback realtime
              </p>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto p-6">
              {/* History */}
              {token && (
                <SessionHistory key={historyKey} token={token} onSelect={handleResumeSession} />
              )}

              {/* Mode selector */}
              <div className="mt-6">
                <InterviewModeSelect loading={loading} onStart={handleStartSession} />
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Chat */}
        {phase === "chat" && session && token && (
          <InterviewChat
            session={session}
            token={token}
            onComplete={handleComplete}
            onBack={handleNewSession}
          />
        )}

        {/* Phase 3: Summary */}
        {phase === "summary" && summary && (
          <InterviewSummary summary={summary} onNewSession={handleNewSession} />
        )}
      </div>
    </div>
  );
}
