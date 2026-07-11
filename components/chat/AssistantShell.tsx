"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, PanelLeft, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatSidebar from "@/components/chat/ChatSidebar";
import CvPreview from "@/components/cv/CvPreview";
import type { ChatMessage } from "@/lib/chat-types";
import { chatApi, type ChatRoom } from "@/lib/api";

const SUGGESTIONS = [
  "Tôi biết Python & SQL, nên học gì để làm AI Engineer?",
  "Thị trường đang cần kỹ năng nào nhất?",
  "Review hồ sơ của tôi & gợi ý skill cần bổ sung",
  "Mức lương Data Engineer ở TP.HCM hiện tại?",
];

/** Shared surface behind both /assistant (new chat) and /assistant/[roomId].
 *  `roomId` comes from the URL and decides which room's messages to load. */
export default function AssistantShell({ roomId }: { roomId: string | null }) {
  const { token, user } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped whenever the agent's edit_cv tool changes the CV, to refresh the pane.
  const [cvRefresh, setCvRefresh] = useState(0);
  // The room being written to. Follows `roomId` on navigation, but is also set
  // locally when the first message of a new chat creates a room — see handleSend.
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomId);

  useEffect(() => {
    setActiveRoomId(roomId);
  }, [roomId]);

  const firstName = user?.full_name?.trim().split(/\s+/).pop() || undefined;

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      setRooms(await chatApi.listRooms(token));
    } catch {
      /* silent — the chat still works without the history list */
    } finally {
      setLoadingRooms(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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
        setActiveRoomId(targetRoomId);
        setRooms((prev) => [room, ...prev]);
        // Give the new room its URL without a Next navigation — navigating here
        // would unmount this component and kill the stream we are about to open.
        // Reloading or sharing the URL later lands on /assistant/[roomId] properly.
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
          setCvRefresh((n) => n + 1);
        } else if (event.type === "error") {
          toast.error(event.message || "Lỗi khi tạo phản hồi");
          setMessages((prev) => prev.filter((m) => m.id !== tempBotId));
        }
      }
      fetchRooms();
    } catch {
      toast.error("Gửi tin nhắn thất bại, thử lại nhé");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempBotId));
    } finally {
      setIsTyping(false);
    }
  }

  async function handleDeleteRoom(id: string) {
    if (!token) return;
    try {
      await chatApi.deleteRoom(token, id);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      if (activeRoomId === id) router.push("/assistant");
    } catch {
      toast.error("Không thể xóa phòng chat");
    }
  }

  const sidebar = (
    <ChatSidebar
      rooms={rooms}
      activeRoomId={activeRoomId}
      loading={loadingRooms}
      onDelete={handleDeleteRoom}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      {/* History — inline sidebar from lg up */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* History — slide-in drawer below lg */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-border bg-surface shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-semibold text-text">Lịch sử trò chuyện</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {sidebar}
          </motion.aside>
        </>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-3 py-2.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở lịch sử trò chuyện"
              className="rounded-lg p-2 text-text-muted transition hover:bg-surface-2 hover:text-text lg:hidden"
            >
              <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <Link
              href="/dashboard"
              aria-label="Thoát về Dashboard"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="hidden sm:inline">Thoát</span>
            </Link>
          </div>

          <span className="font-display text-sm font-medium text-text-muted">
            Trợ lý sự nghiệp AI
          </span>

          {/* Balances the left cluster so the title stays optically centred. */}
          <span className="w-16" aria-hidden="true" />
        </header>

        <div className="min-h-0 flex-1 bg-bg">
          <ChatWindow
            messages={messages}
            onSend={handleSend}
            loading={loadingMessages}
            isTyping={isTyping}
            userName={firstName}
            suggestions={SUGGESTIONS}
          />
        </div>
      </div>

      <div className="hidden w-[38%] max-w-[560px] xl:block">
        <CvPreview refreshSignal={cvRefresh} />
      </div>
    </div>
  );
}
