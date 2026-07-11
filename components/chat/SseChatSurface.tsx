"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import ChatWindow from "@/components/chat/ChatWindow";
import type { ChatMessage } from "@/lib/chat-types";
import { chatApi, type ChatRoom } from "@/lib/api";

const SUGGESTIONS = [
  "Tôi biết Python & SQL, nên học gì để làm AI Engineer?",
  "Thị trường đang cần kỹ năng nào nhất?",
  "Review hồ sơ của tôi & gợi ý skill cần bổ sung",
  "Mức lương Data Engineer ở TP.HCM hiện tại?",
];

type Props = {
  /** roomId từ URL — nguồn sự thật để load lịch sử. */
  roomId: string | null;
  /** Room đang được ghi vào (có thể do chính surface này tạo khi gửi tin đầu). */
  activeRoomId: string | null;
  onRoomCreated: (room: ChatRoom) => void;
  onCvUpdated: () => void;
  /** Bắn sau khi stream xong để shell refresh danh sách room (title đã đổi). */
  onSent: () => void;
  userName?: string;
};

/** Bề mặt chat đường SSE tự viết (flag NEXT_PUBLIC_AI_HOME off). */
export default function SseChatSurface({
  roomId,
  activeRoomId,
  onRoomCreated,
  onCvUpdated,
  onSent,
  userName,
}: Props) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Keyed on the URL's roomId, NOT activeRoomId: a room created mid-send swaps
  // the URL via history.replaceState (no navigation), so this must not re-run
  // and clobber the in-flight stream.
  useEffect(() => {
    if (!token || !roomId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    chatApi
      .getMessages(token, roomId)
      .then((data) => {
        if (cancelled) return;
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Không thể tải tin nhắn");
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, roomId]);

  async function handleSend(text: string) {
    if (!token || !text.trim() || isTyping) return;

    let targetRoomId = activeRoomId;
    if (!targetRoomId) {
      try {
        const room = await chatApi.createRoom(token);
        targetRoomId = room.id;
        onRoomCreated(room);
        // Đổi URL mà không điều hướng — navigation sẽ unmount component và
        // giết stream sắp mở.
        window.history.replaceState(null, "", `/assistant/${targetRoomId}`);
      } catch {
        toast.error("Không thể tạo phòng chat");
        return;
      }
    }

    const tempUserId = `temp-user-${Date.now()}`;
    const tempBotId = `temp-bot-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text, timestamp: new Date() },
      { id: tempBotId, role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsTyping(true);

    try {
      const stream = chatApi.sendMessageStream(token, targetRoomId, text);
      for await (const event of stream) {
        if (event.type === "user_message") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempUserId
                ? {
                    id: event.id,
                    role: event.role,
                    content: event.content,
                    timestamp: new Date(event.created_at),
                  }
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
          const am = event.assistant_message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempBotId
                ? {
                    id: am.id,
                    role: am.role,
                    content: am.content,
                    timestamp: new Date(am.created_at),
                  }
                : m,
            ),
          );
        } else if (event.type === "cv_updated") {
          onCvUpdated();
        } else if (event.type === "error") {
          toast.error(event.message || "Lỗi khi tạo phản hồi");
          setMessages((prev) => prev.filter((m) => m.id !== tempBotId));
        }
      }
      onSent();
    } catch {
      toast.error("Gửi tin nhắn thất bại, thử lại nhé");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempBotId));
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <ChatWindow
      messages={messages}
      onSend={handleSend}
      loading={loadingMessages}
      isTyping={isTyping}
      userName={userName}
      suggestions={SUGGESTIONS}
    />
  );
}
