"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ChatWindow from "@/components/chat/ChatWindow";
import CvPreview from "@/components/cv/CvPreview";
import type { ChatMessage } from "@/lib/chat-types";
import { chatApi, type ChatRoom } from "@/lib/api";

const SUGGESTIONS = [
  "Tôi biết Python & SQL, nên học gì để làm AI Engineer?",
  "Thị trường đang cần kỹ năng nào nhất?",
  "Review hồ sơ của tôi & gợi ý skill cần bổ sung",
  "Mức lương Data Engineer ở TP.HCM hiện tại?",
];

export default function AssistantPage() {
  return (
    <DashboardLayout>
      <AssistantContent />
    </DashboardLayout>
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
    <div className="flex h-screen overflow-hidden bg-white">
      <div className="relative flex min-w-0 flex-1 flex-col">
      {/* Minimal top bar */}
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <button
          onClick={startNewChat}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="hidden sm:inline">Cuộc trò chuyện mới</span>
        </button>

        <span className="text-sm font-medium text-slate-400">Trợ lý sự nghiệp AI</span>

        <button
          onClick={() => setHistoryOpen(true)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Lịch sử trò chuyện"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </header>

      {/* Chat surface */}
      <div className="min-h-0 flex-1">
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          loading={loadingMessages}
          isTyping={isTyping}
          userName={firstName}
          suggestions={SUGGESTIONS}
        />
      </div>

      {/* History drawer */}
      {historyOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]" onClick={() => setHistoryOpen(false)} />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Lịch sử trò chuyện</h2>
              <button onClick={() => setHistoryOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-3 pt-3">
              <button
                onClick={startNewChat}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Cuộc trò chuyện mới
              </button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
              {loadingRooms ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="h-5 w-5 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : rooms.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">Chưa có cuộc trò chuyện nào</p>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => {
                      setActiveRoomId(room.id);
                      setHistoryOpen(false);
                    }}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition ${
                      activeRoomId === room.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span className="flex-1 truncate text-sm">{room.title || "Cuộc trò chuyện mới"}</span>
                    <button
                      onClick={(e) => handleDeleteRoom(room.id, e)}
                      className="rounded p-1 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      title="Xóa"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
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
