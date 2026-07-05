"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { SessionDetail } from "@/lib/api";
import { interviewApi } from "@/lib/api";
import QuestionCard from "./QuestionCard";

export default function InterviewSession({
  session,
  token,
  onUpdate,
  onComplete,
  onBack,
  loading,
}: {
  session: SessionDetail;
  token: string;
  onUpdate: (s: SessionDetail) => void;
  onComplete: (sessionId: string) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  const currentAnswer = session.answers.find(
    (a) => !a.answered_at && !a.skipped
  );
  const currentIndex = currentAnswer
    ? session.answers.indexOf(currentAnswer) + 1
    : session.total_questions;

  // Timer for mock test
  useEffect(() => {
    if (session.mode !== "mock_test" || !session.time_limit_seconds || !currentAnswer) return;

    const limit = session.time_limit_seconds;
    setTimerSeconds(limit);

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session.mode, session.time_limit_seconds, currentAnswer?.id]);

  const handleSubmit = useCallback(async () => {
    if (!currentAnswer || answer.trim().length < 10) return;

    setSubmitting(true);

    try {
      const timeSpent = session.time_limit_seconds && timerSeconds !== null
        ? session.time_limit_seconds - timerSeconds
        : undefined;

      await interviewApi.submitAnswer(token, session.id, currentAnswer.id, {
        answer_text: answer.trim(),
        time_spent_seconds: timeSpent,
      });

      const updated = await interviewApi.getSession(token, session.id);
      onUpdate(updated);
      setAnswer("");
      setShowTips(true);
    } catch {
      toast.error("Gửi câu trả lời thất bại");
    } finally {
      setSubmitting(false);
    }
  }, [currentAnswer, answer, token, session.id, timerSeconds, session.time_limit_seconds, onUpdate]);

  const handleSkip = useCallback(async () => {
    if (!currentAnswer) return;
    try {
      await interviewApi.skipAnswer(token, session.id, currentAnswer.id);
      const updated = await interviewApi.getSession(token, session.id);
      onUpdate(updated);
      setAnswer("");
      setShowTips(true);
    } catch {
      toast.error("Không thể bỏ qua");
    }
  }, [currentAnswer, token, session.id, onUpdate]);

  const handleFinish = useCallback(() => {
    if (session.mode === "mock_test") {
      onComplete(session.id);
    } else {
      onBack();
    }
  }, [session.id, session.mode, onComplete, onBack]);

  const isComplete = !currentAnswer;
  const isLastQuestion = currentAnswer && currentIndex === session.total_questions;
  const progress = (session.completed_questions / session.total_questions) * 100;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {session.mode === "practice" ? "Luyện tập" : "Mock Test"}
                {session.target_role ? ` — ${session.target_role}` : ""}
              </h2>
              <p className="text-xs text-slate-400">
                Câu {currentIndex}/{session.total_questions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timerSeconds !== null && (
              <span className={`text-sm font-mono font-medium px-2.5 py-1 rounded-lg ${
                timerSeconds <= 30 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
              }`}>
                {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, "0")}
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              session.mode === "practice" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
            }`}>
              {session.mode === "practice" ? "Practice" : "Mock Test"}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isComplete ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 0 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Hoàn thành!</h3>
              <p className="text-sm text-slate-500">Bạn đã trả lời {session.completed_questions}/{session.total_questions} câu hỏi</p>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {session.mode === "mock_test" ? "Hoàn tất" : "Quay lại"}
              </button>
            </div>
          ) : currentAnswer ? (
            <>
              <QuestionCard
                question={currentAnswer.question}
                orderIndex={currentIndex}
                total={session.total_questions}
                showTips={showTips}
                onToggleTips={() => setShowTips(!showTips)}
              />

              <div className="space-y-3">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Nhập câu trả lời của bạn... Cố gắng sử dụng cấu trúc STAR (Situation → Task → Action → Result)"
                  rows={6}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y disabled:bg-slate-50 disabled:text-slate-400"
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={answer.trim().length < 10 || submitting}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                  >
                    {submitting ? "Đang gửi..." : isLastQuestion ? "Gửi & Hoàn thành" : "Gửi câu trả lời"}
                  </button>

                  {session.mode === "practice" && (
                    <button
                      onClick={handleSkip}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-40"
                    >
                      Bỏ qua
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
