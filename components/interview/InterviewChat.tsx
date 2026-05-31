"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import type { ChatMessage } from "@/lib/chat-types";
import type { InterviewAgentSession, InterviewAgentSummary } from "@/lib/api";
import { interviewAgentApi } from "@/lib/api";
import ChatBubble from "@/components/chat/ChatBubble";

function agentMessageToChat(m: {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}): ChatMessage {
  return { id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at) };
}

export default function InterviewChat({
  session,
  token,
  onComplete,
  onBack,
}: {
  session: InterviewAgentSession;
  token: string;
  onComplete: (summary: InterviewAgentSummary) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    session.messages.map(agentMessageToChat),
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [completing, setCompleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const isTechnical = session.mode === "technical";

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput("");
    setIsTyping(true);

    // Optimistic UI
    const tempUserId = `temp-user-${Date.now()}`;
    const tempBotId = `temp-bot-${Date.now()}`;
    const tempUserMsg: ChatMessage = {
      id: tempUserId,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    const tempBotMsg: ChatMessage = {
      id: tempBotId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg, tempBotMsg]);

    try {
      const stream = interviewAgentApi.sendMessageStream(token, session.id, text);

      for await (const event of stream) {
        if (event.type === "user_message") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempUserId
                ? { id: event.id, role: "user", content: event.content, timestamp: new Date(event.created_at) }
                : m,
            ),
          );
        } else if (event.type === "token") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempBotId ? { ...m, content: m.content + event.content } : m,
            ),
          );
        } else if (event.type === "done") {
          const msg = event.assistant_message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempBotId
                ? { id: msg.id, role: "assistant", content: msg.content, timestamp: new Date(msg.created_at) }
                : m,
            ),
          );
        } else if (event.type === "error") {
          toast.error(event.message || "Lỗi khi tạo phản hồi");
          setMessages((prev) => prev.filter((m) => m.id !== tempBotId));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi tin nhắn thất bại";
      toast.error(msg);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempBotId));
    } finally {
      setIsTyping(false);
      textareaRef.current?.focus();
    }
  }, [input, isTyping, token, session.id]);

  const handleComplete = useCallback(async () => {
    if (!window.confirm("Bạn muốn kết thúc phiên phỏng vấn? AI sẽ đánh giá và tạo báo cáo tổng hợp.")) return;

    setCompleting(true);
    try {
      const summary = await interviewAgentApi.completeSession(token, session.id);
      toast.success("Phiên phỏng vấn đã hoàn thành!");
      onComplete(summary);
    } catch {
      toast.error("Không thể hoàn tất phiên phỏng vấn");
    } finally {
      setCompleting(false);
    }
  }, [token, session.id, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Show typing indicator while bot content is empty
  const showTyping =
    isTyping &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1]?.content === "";

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
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
                {isTechnical ? "Phỏng vấn Kỹ thuật" : "Phỏng vấn Hành vi"}
                {session.target_role ? ` — ${session.target_role}` : ""}
              </h2>
              <p className="text-xs text-slate-400">
                {session.question_count > 0 ? `${session.question_count} câu trả lời` : "Bắt đầu cuộc trò chuyện"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                isTechnical ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"
              }`}
            >
              {isTechnical ? "Technical" : "Behavioral"}
            </span>

            <button
              onClick={handleComplete}
              disabled={completing || isTyping}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40"
            >
              {completing ? "Đang tổng hợp..." : "Kết thúc"}
            </button>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {showTyping && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shrink-0 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input form */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isTechnical
                  ? "Trả lời câu hỏi kỹ thuật... (Enter gửi, Shift+Enter xuống dòng)"
                  : "Trả lời bằng cấu trúc STAR... (Enter gửi, Shift+Enter xuống dòng)"
              }
              rows={2}
              disabled={isTyping || completing}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping || completing}
              className={`px-5 py-3 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 shrink-0 ${
                isTechnical ? "bg-purple-600 hover:bg-purple-700" : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
