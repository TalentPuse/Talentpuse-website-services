"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ModeSelect from "@/components/interview/ModeSelect";
import InterviewSession from "@/components/interview/InterviewSession";
import SessionHistory from "@/components/interview/SessionHistory";
import {
  interviewApi,
  type InterviewCategory,
  type SessionDetail,
} from "@/lib/api";

type Phase = "mode_select" | "session" | "history";

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
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    interviewApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleStartSession = useCallback(
    async (mode: "practice" | "mock_test", opts: { category?: string; target_role?: string; num_questions?: number; time_limit_seconds?: number }) => {
      if (!token) return;
      setLoading(true);
      try {
        const s = await interviewApi.createSession(token, { mode, ...opts });
        setSession(s);
        setPhase("session");
      } catch {
        toast.error("Không thể tạo phiên phỏng vấn");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const handleSessionUpdate = useCallback((updated: SessionDetail) => {
    setSession(updated);
  }, []);

  const handleComplete = useCallback(
    async (sessionId: string) => {
      if (!token) return;
      setLoading(true);
      try {
        await interviewApi.completeSession(token, sessionId);
        toast.success("Hoàn thành phiên phỏng vấn!");
      } catch {
        toast.error("Không thể hoàn tất");
      } finally {
        setLoading(false);
        setSession(null);
        setPhase("mode_select");
      }
    },
    [token],
  );

  const handleBackToSelect = useCallback(() => {
    setSession(null);
    setPhase("mode_select");
  }, []);

  return (
    <div className="h-screen overflow-hidden">
      {phase === "mode_select" && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0">
            <h1 className="text-xl font-bold text-slate-900">Luyện Phỏng Vấn</h1>
            <p className="text-sm text-slate-500 mt-1">
              Thực hành trả lời câu hỏi behavioral, nhận feedback từ AI
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* History */}
            {token && (
              <SessionHistory token={token} onSelect={(s) => { setSession(s); setPhase("session"); }} />
            )}

            {/* Mode Select */}
            <div className="mt-6">
              <ModeSelect categories={categories} loading={loading} onStart={handleStartSession} />
            </div>
          </div>
        </div>
      )}

      {phase === "session" && session && (
        <InterviewSession
          session={session}
          token={token!}
          onUpdate={handleSessionUpdate}
          onComplete={handleComplete}
          onBack={handleBackToSelect}
          loading={loading}
        />
      )}
    </div>
  );
}
