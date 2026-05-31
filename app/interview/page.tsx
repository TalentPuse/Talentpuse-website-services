"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InterviewModeSelect from "@/components/interview/InterviewModeSelect";
import InterviewChat from "@/components/interview/InterviewChat";
import InterviewSummary from "@/components/interview/InterviewSummary";
import SessionHistory from "@/components/interview/SessionHistory";
import {
  interviewAgentApi,
  type InterviewAgentMode,
  type InterviewAgentSession,
  type InterviewAgentSummary,
} from "@/lib/api";

type Phase = "mode_select" | "chat" | "summary";

export default function InterviewPage() {
  return (
    <DashboardLayout>
      <InterviewContent />
    </DashboardLayout>
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
    <div className="h-screen overflow-hidden">
      {/* Phase 1: Mode select + session history */}
      {phase === "mode_select" && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0">
            <h1 className="text-xl font-bold text-slate-900">Luyện Phỏng Vấn AI</h1>
            <p className="text-sm text-slate-500 mt-1">
              Thực hành phỏng vấn kỹ thuật & hành vi với AI interviewer — nhận feedback realtime
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
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
      {phase === "summary" && summary && <InterviewSummary summary={summary} onNewSession={handleNewSession} />}
    </div>
  );
}
