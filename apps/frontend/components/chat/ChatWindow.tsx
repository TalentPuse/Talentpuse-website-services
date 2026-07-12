"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { motion } from "framer-motion";
import { BarChart3, Banknote, Loader2 } from "lucide-react";
import { Bot, Sparkles, Send, ScanSearch, FileText } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat-types";
import ChatBubble from "./ChatBubble";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  isTyping?: boolean;
  userName?: string;
  suggestions?: string[];
};

// Maps 1:1 with the SUGGESTIONS copy array in app/assistant/page.tsx.
// Replaces the old emoji prefixes with lucide icons: ScanSearch, BarChart3, FileText, Banknote.
const SUGGESTION_ICONS = [ScanSearch, BarChart3, FileText, Banknote];

export default function ChatWindow({
  messages,
  onSend,
  loading,
  isTyping,
  userName,
  suggestions = [],
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const lastContentLen = messages.length > 0 ? messages[messages.length - 1].content.length : 0;
  const isEmpty = messages.length === 0 && !loading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping, lastContentLen]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const showTyping =
    isTyping &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role !== "assistant" ||
      messages[messages.length - 1]?.content === "");

  function submit() {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput("");
    onSend(text);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const inputBar = (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={cn(
          "relative flex items-end gap-2 rounded-[1.75rem] border border-border bg-surface/80 p-2 pl-4 shadow-lg shadow-black/5 backdrop-blur-md transition focus-within:border-brand-500/50 dark:shadow-black/20",
          isTyping && "ai-glow",
        )}
      >
        <Sparkles className="mb-3 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" strokeWidth={1.75} aria-hidden="true" />
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi mình về skill, việc làm, lương, hay nhờ review CV…"
          className="max-h-[200px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed text-text outline-hidden placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          aria-label="Gửi"
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );

  // ── Empty / welcome state — centered, ChatGPT/Claude style ──
  if (isEmpty) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-md -translate-x-1/2 rounded-full bg-brand-500/10 blur-[100px]" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="ai-gradient ai-glow mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white">
              <Bot className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-text">
              Chào {userName || "bạn"}
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-text-muted">
              Mình là trợ lý sự nghiệp AI của bạn. Hỏi bất cứ điều gì về kỹ năng nên học, việc làm,
              mức lương — hoặc nhờ mình review &amp; viết CV, tất cả ngay trong cuộc trò chuyện.
            </p>
          </div>

          {inputBar}

          {suggestions.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {suggestions.map((s, i) => {
                const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                return (
                  <motion.button
                    key={s}
                    type="button"
                    onClick={() => onSend(s)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className="group flex items-start gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left text-sm text-text-muted shadow-xs transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-surface-2 hover:text-text"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" strokeWidth={1.75} aria-hidden="true" />
                    <span>{s}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Conversation state ──
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8">
          {loading && messages.length === 0 ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Đang tải…
            </div>
          ) : (
            <div className="space-y-7">
              {messages
                .filter((m) => !(m.role === "assistant" && m.content === ""))
                .map((msg, i, arr) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    streaming={isTyping && i === arr.length - 1 && msg.role === "assistant"}
                  />
                ))}
              {showTyping && (
                <div className="flex gap-3.5">
                  <div className="ai-gradient ai-glow mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs">
                    <Bot className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="flex items-center gap-1.5 pt-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted/50" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted/50" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted/50" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-linear-to-t from-bg via-bg to-transparent px-4 pb-4 pt-3">
        <div className="mx-auto max-w-4xl">
          {inputBar}
          <p className="mt-2 text-center text-[11px] text-text-muted">
            TalentPuse AI có thể sai — hãy kiểm chứng những thông tin quan trọng.
          </p>
        </div>
      </div>
    </div>
  );
}
