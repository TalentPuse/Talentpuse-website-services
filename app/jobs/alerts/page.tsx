"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { jobsApi, MyAlertList, MyAlertRow } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ChatWindow from "@/components/chat/ChatWindow";
import type { ChatMessage, AlertCardData } from "@/lib/chat-types";

const PER_PAGE = 20;

function groupAlertsByBatch(alerts: MyAlertRow[]): ChatMessage[] {
  const groups: Map<string, MyAlertRow[]> = new Map();

  for (const alert of alerts) {
    const date = new Date(alert.sent_at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${Math.floor(date.getMinutes() / 5)}`;
    const existing = groups.get(key) || [];
    existing.push(alert);
    groups.set(key, existing);
  }

  const messages: ChatMessage[] = [];

  for (const [key, batch] of groups) {
    const alertCards: AlertCardData[] = batch.map((a) => ({
      title: a.title,
      company_name: a.company_name,
      city_canonical: a.city_canonical,
      salary_million: a.salary_million,
      source_url: a.source_url,
      source: a.source,
    }));

    const count = batch.length;
    messages.push({
      id: `alert-${key}`,
      role: "bot",
      type: "alert",
      content: `Tìm thấy ${count} việc làm mới phù hợp với bạn.`,
      alerts: alertCards,
      timestamp: new Date(batch[0].sent_at),
    });
  }

  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return messages;
}

export default function AlertHistoryPage() {
  return (
    <DashboardLayout>
      <AlertChatContent />
    </DashboardLayout>
  );
}

function AlertChatContent() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);

  const loadAlerts = useCallback(async (p: number, append: boolean) => {
    if (!token) return;
    if (loadingMore.current) return;
    loadingMore.current = true;

    try {
      const res = await jobsApi.myAlerts(token, { page: p, per_page: PER_PAGE });
      const alertMessages = groupAlertsByBatch(res.alerts);

      setMessages((prev) => {
        if (append) {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = alertMessages.filter((m) => !existingIds.has(m.id));
          return [...newMsgs, ...prev];
        }
        return alertMessages;
      });

      setHasMore(p * PER_PAGE < res.total);
    } catch {
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [token]);

  useEffect(() => {
    loadAlerts(1, false);
  }, [loadAlerts]);

  function handleScrollTop() {
    if (!hasMore || loadingMore.current) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadAlerts(nextPage, true);
  }

  function handleSend(text: string) {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      type: "text",
      content: text,
      timestamp: new Date(),
    };

    const botReply: ChatMessage = {
      id: `bot-reply-${Date.now()}`,
      role: "bot",
      type: "text",
      content: "Tính năng AI đang được phát triển. Hiện tại bạn có thể xem các gợi ý việc làm ở trên. Chúng tôi sẽ sớm hỗ trợ trả lời câu hỏi về việc làm!",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botReply]);
  }

  const welcomeMsg: ChatMessage = {
    id: "welcome",
    role: "bot",
    type: "text",
    content: messages.length === 0 && !loading
      ? "Xin chào! Chưa có gợi ý nào. Cập nhật hồ sơ tại trang Hồ sơ để nhận alert việc làm phù hợp với bạn."
      : "Xin chào! Đây là lịch sử các việc làm đã gợi ý cho bạn qua Telegram.",
    timestamp: new Date(),
  };

  const allMessages = [welcomeMsg, ...messages];

  return (
    <div className="h-screen p-4">
      <ChatWindow
        messages={allMessages}
        onSend={handleSend}
        loading={loading}
        onScrollTop={handleScrollTop}
      />
    </div>
  );
}
