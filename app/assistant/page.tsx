"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ForceTheme } from "@/components/theme/ForceTheme";
import ChatWindow from "@/components/chat/ChatWindow";
import CvPreview from "@/components/cv/CvPreview";
import { Plus, History, MessageSquare } from "@/lib/icons";
import type { ChatMessage } from "@/lib/chat-types";
import { chatApi, type ChatRoom } from "@/lib/api";

const SUGGESTIONS = [
  "Tôi biết Python & SQL, nên học gì để làm AI Engineer?",
  "Thị trường đang cần kỹ năng nào nhất?",
  "Review hồ sơ của tôi & gợi ý skill cần bổ sung",
  "Mức lương Data Engineer ở TP.HCM hiện tại?",
];

export default function AssistantPage() {
  // Dark immersive route: wrap in ProtectedRoute directly (NOT DashboardLayout).
  // DashboardLayout injects the light AppShell (SideNav + TopBar), which is wrong
  // for this focus-first dark chat surface — the page renders its own minimal dark chrome.
  return (
    <ProtectedRoute>
      <ForceTheme theme="dark" />
      <AssistantContent />
    </ProtectedRoute>
  );
}

function AssistantContent() {
  const { token, user } = useAuth();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Bumped whenever the agent's edit_cv tool changes the CV, to refresh the pane.
  const [cvRefresh, setCvRefresh] = useState(0);
  // When a room is created by sending the first message, skip the reload the
  // activeRoomId change would trigger — it would clobber the in-flight stream.
  const justSentRef = useRef(false);

  const firstName = user?.full_name?.trim().split(/\s+/).pop() || undefined;

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const data = await chatApi.listRooms(token);
      setRooms(data);
    } catch {
      /* silent */
    } finally {
      setLoadingRooms(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (!token || !activeRoomId) {
      setMessages([]);
      return;
    }
    if (justSentRef.current) {
      // Room was just created by sending — messages are already streaming in.
      justSentRef.current = false;
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    chatApi
      .getMessages(token, activeRoomId)
      .then((data) => {
        if (cancelled) return;
        setMessages(
          data.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at) })),
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
  }, [token, activeRoomId]);

  async function handleSend(text: string) {
    if (!token || !text.trim() || isTyping) return;

    let roomId = activeRoomId;
    if (!roomId) {
      try {
        const room = await chatApi.createRoom(token);
        roomId = room.id;
        justSentRef.current = true;
        setActiveRoomId(roomId);
        setRooms((prev) => [room, ...prev]);
      } catch {
        toast.error("Không thể tạo phòng chat");
        return;
      }
    }

    const tempUserId = `temp-user-${Date.now()}`;
    const tempBotId = `temp-bot-${Date.now()}`;
    const tempUserMsg: ChatMessage = { id: tempUserId, role: "user", content: text, timestamp: new Date() };
    const tempBotMsg: ChatMessage = { id: tempBotId, role: "assistant", content: "", timestamp: new Date() };

    setMessages((prev) => [...prev, tempUserMsg, tempBotMsg]);
    setIsTyping(true);

    try {
      const stream = chatApi.sendMessageStream(token, roomId, text);
      for await (const event of stream) {
        if (event.type === "user_message") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempUserId
                ? { id: event.id, role: event.role, content: event.content, timestamp: new Date(event.created_at) }
                : m,
            ),
          );
        } else if (event.type === "token") {
          setMessages((prev) => prev.map((m) => (m.id === tempBotId ? { ...m, content: m.content + event.content } : m)));
        } else if (event.type === "done") {
          const am = event.assistant_message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempBotId
                ? { id: am.id, role: am.role, content: am.content, timestamp: new Date(am.created_at) }
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

  function startNewChat() {
    setActiveRoomId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  async function handleDeleteRoom(roomId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!token) return;
    try {
      await chatApi.deleteRoom(token, roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomId === roomId) {
        setActiveRoomId(null);
        setMessages([]);
      }
    } catch {
      toast.error("Không thể xóa phòng chat");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <div className="relative flex min-w-0 flex-1 flex-col">
      {/* Minimal dark top bar */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            aria-label="Thoát về Dashboard"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="hidden sm:inline">Thoát</span>
          </Link>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="hidden sm:inline">Cuộc trò chuyện mới</span>
          </button>
        </div>

        <span className="font-display text-sm font-medium text-text-muted">Trợ lý sự nghiệp AI</span>

        <button
          onClick={() => setHistoryOpen(true)}
          className="rounded-lg p-2 text-text-muted transition hover:bg-surface-2 hover:text-text"
          aria-label="Lịch sử trò chuyện"
        >
          <History className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      {/* Chat surface — glass over the dark page */}
      <div className="min-h-0 flex-1 bg-surface/30 backdrop-blur-sm">
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          loading={loadingMessages}
          isTyping={isTyping}
          userName={firstName}
          suggestions={SUGGESTIONS}
        />
      </div>

      {/* History drawer — dark glass */}
      {historyOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setHistoryOpen(false)} />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-bg/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-semibold text-text">Lịch sử trò chuyện</h2>
              <button onClick={() => setHistoryOpen(false)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text" aria-label="Đóng">
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="px-3 pt-3">
              <button
                onClick={startNewChat}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-text-muted transition hover:border-brand-500/40 hover:bg-surface-2 hover:text-brand-300"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Cuộc trò chuyện mới
              </button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
              {loadingRooms ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-text-muted/50" />
                </div>
              ) : rooms.length === 0 ? (
                <p className="py-10 text-center text-xs text-text-muted">Chưa có cuộc trò chuyện nào</p>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => {
                      setActiveRoomId(room.id);
                      setHistoryOpen(false);
                    }}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition ${
                      activeRoomId === room.id ? "bg-surface-2 text-brand-300" : "text-text-muted hover:bg-surface-2 hover:text-text"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 opacity-50" strokeWidth={1.5} />
                    <span className="flex-1 truncate text-sm">{room.title || "Cuộc trò chuyện mới"}</span>
                    <button
                      onClick={(e) => handleDeleteRoom(room.id, e)}
                      className="rounded-sm p-1 opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
      </div>
      <div className="hidden w-[45%] max-w-[620px] lg:block">
        <CvPreview refreshSignal={cvRefresh} />
      </div>
    </div>
  );
}
