"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ChatWindow from "@/components/chat/ChatWindow";
import type { ChatMessage } from "@/lib/chat-types";

const BOT_PLACEHOLDER =
  "Tính năng AI đang được phát triển. Tôi sẽ sớm có thể tư vấn việc làm, review CV và trả lời câu hỏi về thị trường lao động cho bạn!";

const SUGGESTIONS = [
  "Gợi ý việc làm phù hợp với tôi",
  "Mức lương trung bình cho Data Engineer ở HCM?",
  "Review CV của tôi",
  "Kỹ năng nào đang hot nhất?",
];

export default function AssistantPage() {
  return (
    <DashboardLayout>
      <AssistantContent />
    </DashboardLayout>
  );
}

function AssistantContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const firstName = user?.full_name?.split(" ").pop() || "bạn";

  const welcomeMsg: ChatMessage = {
    id: "welcome",
    role: "bot",
    type: "text",
    content: `Xin chào ${firstName}! 👋 Tôi là trợ lý AI của TalentPulse. Bạn cần tôi giúp gì?`,
    timestamp: new Date(),
  };

  const allMessages = [welcomeMsg, ...messages];

  function handleSuggestion(text: string) {
    handleSend(text);
  }

  function handleSend(text: string) {
    setShowSuggestions(false);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      type: "text",
      content: text,
      timestamp: new Date(),
    };

    const botReply: ChatMessage = {
      id: `bot-${Date.now()}`,
      role: "bot",
      type: "text",
      content: BOT_PLACEHOLDER,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botReply]);
  }

  return (
    <div className="h-screen p-4 flex flex-col">
      <ChatWindow
        messages={allMessages}
        onSend={handleSend}
        loading={false}
      />

      {showSuggestions && messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 mt-3 px-1"
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors shadow-sm"
            >
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
