"use client";

import { useEffect, useRef } from "react";

import { chatApi, type ChatRoom } from "@/lib/api";

const MAX_TITLE = 60;

type Args = {
  token: string | null;
  /** Chính là roomId — FE sinh trước để làm threadId cho CopilotKit. */
  threadId: string | null;
  /** Nội dung tin nhắn user đầu tiên của thread, hoặc null nếu chưa có. */
  firstUserMessage: string | null;
  onRoomCreated: (room: ChatRoom) => void;
};

/**
 * Đăng ký ChatRoom cho một thread CopilotKit.
 *
 * CopilotChat sở hữu ô nhập nên ta không hook được lúc "gửi tin đầu" như đường
 * SSE. Thay vào đó: theo dõi message của agent, thấy tin nhắn user đầu tiên thì
 * tạo room với ĐÚNG threadId đã sinh sẵn. Backend idempotent (POST /api/chat/rooms
 * nhận id) nên gọi trùng vô hại — StrictMode chạy effect 2 lần cũng không sao.
 *
 * Lỗi thì nuốt lặng: room chỉ phục vụ sidebar; nguồn tin nhắn thật là LangGraph
 * checkpointer, nên chat vẫn chạy bình thường dù đăng ký hụt. Reset ref để lần
 * mount sau thử lại.
 */
export function useRoomRegistration({
  token,
  threadId,
  firstUserMessage,
  onRoomCreated,
}: Args) {
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !threadId || !firstUserMessage) return;
    if (registered.current === threadId) return;
    registered.current = threadId;

    const title =
      firstUserMessage.length > MAX_TITLE
        ? firstUserMessage.slice(0, MAX_TITLE) + "..."
        : firstUserMessage;

    chatApi
      .createRoom(token, { id: threadId, title })
      .then(onRoomCreated)
      .catch(() => {
        registered.current = null;
      });
  }, [token, threadId, firstUserMessage, onRoomCreated]);
}
