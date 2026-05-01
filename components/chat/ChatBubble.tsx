"use client";

import type { ChatMessage } from "@/lib/chat-types";
import AlertCard from "./AlertCard";

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;

  return date.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatBubble({ message }: { message: ChatMessage }) {
  const isBot = message.role === "bot";

  if (!isBot) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          <div className="bg-brand-600 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
            <p className="text-sm">{message.content}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4">
      {/* Bot avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </div>

      <div className="max-w-[85%] min-w-0">
        <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
          {message.type === "alert" && message.alerts && message.alerts.length > 0 ? (
            <div>
              <p className="text-sm text-slate-700 mb-2">{message.content}</p>
              <div className="divide-y divide-slate-100">
                {message.alerts.map((alert, i) => (
                  <AlertCard key={i} alert={alert} index={i + 1} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700">{message.content}</p>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-1 ml-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
