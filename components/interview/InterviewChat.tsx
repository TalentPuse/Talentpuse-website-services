"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
// ArrowLeft is not in the curated @/lib/icons set — imported directly per task instructions.
import { ArrowLeft } from "lucide-react";

import type { ChatMessage } from "@/lib/chat-types";
import type { InterviewAgentSession, InterviewAgentSummary } from "@/lib/api";
import { interviewAgentApi } from "@/lib/api";
import ChatBubble from "@/components/chat/ChatBubble";
import { Send, ICON } from "@/lib/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    setConfirmOpen(false);
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
    <div className="h-full flex flex-col bg-bg text-text">
      {/* Top bar */}
      <div className="px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Quay lại danh sách phiên phỏng vấn"
              className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted transition-colors"
            >
              <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-text">
                {isTechnical ? "Phỏng vấn Kỹ thuật" : "Phỏng vấn Hành vi"}
                {session.target_role ? ` — ${session.target_role}` : ""}
              </h2>
              <p className="text-xs text-text-muted">
                {session.question_count > 0 ? `${session.question_count} câu trả lời` : "Bắt đầu cuộc trò chuyện"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border",
                isTechnical
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-teal-500/30 bg-teal-500/10 text-teal-300",
              )}
            >
              {isTechnical ? "Technical" : "Behavioral"}
            </span>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={completing || isTyping}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-40"
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
              <div className="ai-gradient w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-text-muted/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-text-muted/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-text-muted/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input form */}
      <div className="shrink-0 border-t border-border bg-surface/80 backdrop-blur-sm px-6 py-4">
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
              className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping || completing}
              aria-label="Gửi tin nhắn"
              className={cn(
                "px-5 py-3 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 shrink-0",
                isTechnical ? "bg-violet-500 hover:bg-violet-400" : "bg-teal-500 hover:bg-teal-400",
              )}
            >
              <Send {...ICON} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* End-session confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-border bg-surface text-text">
          <DialogHeader>
            <DialogTitle>Kết thúc phiên phỏng vấn?</DialogTitle>
            <DialogDescription className="text-text-muted">
              AI sẽ đánh giá toàn bộ phần trả lời của bạn và tạo báo cáo tổng hợp. Bạn sẽ không thể tiếp tục cuộc
              trò chuyện này sau khi kết thúc.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" onClick={handleComplete}>
              Kết thúc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
