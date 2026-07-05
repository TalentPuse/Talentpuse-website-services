"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { motion } from "framer-motion";
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
      <div className="relative flex items-end gap-2 rounded-[1.75rem] border border-slate-200 bg-white p-2 pl-5 shadow-lg shadow-slate-200/60 transition focus-within:border-brand-300 focus-within:shadow-brand-100">
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi mình về skill, việc làm, lương, hay nhờ review CV…"
          className="max-h-[200px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed text-slate-800 outline-hidden placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          aria-label="Gửi"
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
          </svg>
        </button>
      </div>
    </form>
  );

  // ── Empty / welcome state — centered, ChatGPT/Claude style ──
  if (isEmpty) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-md -translate-x-1/2 rounded-full bg-brand-300/20 blur-[100px]" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/25">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
              Chào {userName || "bạn"} 👋
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-500">
              Mình là trợ lý sự nghiệp AI của bạn. Hỏi bất cứ điều gì về kỹ năng nên học, việc làm,
              mức lương — hoặc nhờ mình review &amp; viết CV, tất cả ngay trong cuộc trò chuyện.
            </p>
          </div>

          {inputBar}

          {suggestions.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="group flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3.5 text-left text-sm text-slate-600 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/50 hover:text-slate-900 hover:shadow-md"
                >
                  <span className="text-base leading-none">{["🎯", "📊", "📝", "💰"][i % 4]}</span>
                  <span>{s}</span>
                </motion.button>
              ))}
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
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-400">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-xs">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 pt-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-linear-to-t from-white via-white to-transparent px-4 pb-4 pt-3">
        <div className="mx-auto max-w-4xl">
          {inputBar}
          <p className="mt-2 text-center text-[11px] text-slate-400">
            TalentPulse AI có thể sai — hãy kiểm chứng những thông tin quan trọng.
          </p>
        </div>
      </div>
    </div>
  );
}
