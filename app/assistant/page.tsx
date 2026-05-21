"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ChatWindow from "@/components/chat/ChatWindow";
import type { ChatMessage } from "@/lib/chat-types";
import { chatApi, type ChatRoom } from "@/lib/api";

const SUGGESTIONS = [
  "Tôi biết Python và SQL, nên học gì để làm AI Engineer?",
  "Mức lương AI Engineer ở Hà Nội?",
  "Review lộ trình học Data Engineer cho người mới",
  "Kỹ năng nào đang hot nhất thị trường?",
];

export default function AssistantPage() {
  return (
    <DashboardLayout>
      <AssistantContent />
    </DashboardLayout>
  );
}

function AssistantContent() {
  const { token } = useAuth();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch rooms
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

  // Load messages when active room changes
  useEffect(() => {
    if (!token || !activeRoomId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    chatApi
      .getMessages(token, activeRoomId)
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
  }, [token, activeRoomId]);

  // Send message
  async function handleSend(text: string) {
    if (!token || !text.trim() || isTyping) return;

    let roomId = activeRoomId;

    // Auto-create room if none selected
    if (!roomId) {
      try {
        const room = await chatApi.createRoom(token);
        roomId = room.id;
        setActiveRoomId(roomId);
        setRooms((prev) => [room, ...prev]);
      } catch {
        toast.error("Không thể tạo phòng chat");
        return;
      }
    }

    // Optimistic: show user message immediately
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);
    setSidebarOpen(false);

    try {
      const reply = await chatApi.sendMessage(token, roomId, text);

      // Replace temp message + add bot reply
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        {
          id: reply.user_message.id,
          role: reply.user_message.role,
          content: reply.user_message.content,
          timestamp: new Date(reply.user_message.created_at),
        },
        {
          id: reply.assistant_message.id,
          role: reply.assistant_message.role,
          content: reply.assistant_message.content,
          timestamp: new Date(reply.assistant_message.created_at),
        },
      ]);

      // Refresh rooms to get updated title/timestamp
      fetchRooms();
    } catch {
      toast.error("Gửi tin nhắn thất bại, thử lại nhé");
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsTyping(false);
    }
  }

  // Create new room
  async function handleNewChat() {
    if (!token) return;
    try {
      const room = await chatApi.createRoom(token);
      setRooms((prev) => [room, ...prev]);
      setActiveRoomId(room.id);
      setSidebarOpen(false);
    } catch {
      toast.error("Không thể tạo phòng chat");
    }
  }

  // Delete room
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
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — Room List */}
      <aside
        className={`fixed md:static z-40 top-0 left-0 h-full w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
                AI
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">AI Assistant</h2>
                <p className="text-[10px] text-slate-400">Career Advisor</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded hover:bg-slate-100"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* New chat button */}
        <div className="px-3 pt-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Chat mới
          </button>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {loadingRooms ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-5 h-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              Chưa có cuộc trò chuyện nào
            </p>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => {
                  setActiveRoomId(room.id);
                  setSidebarOpen(false);
                }}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeRoomId === room.id
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="w-4 h-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <span className="flex-1 text-sm truncate">
                  {room.title || "Cuộc trò chuyện mới"}
                </span>
                <button
                  onClick={(e) => handleDeleteRoom(room.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 transition-all"
                  title="Xóa"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {activeRoomId
                ? rooms.find((r) => r.id === activeRoomId)?.title || "Cuộc trò chuyện"
                : "AI Career Advisor"}
            </h2>
            <p className="text-xs text-slate-400">
              Tư vấn kỹ năng, lộ trình nghề, thị trường việc làm
            </p>
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden p-4 pt-2">
          <ChatWindow
            messages={messages}
            onSend={handleSend}
            loading={loadingMessages}
            isTyping={isTyping}
          />
        </div>

        {/* Suggestions — only when no active room and no messages */}
        {!activeRoomId && messages.length === 0 && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-4"
          >
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-sm text-slate-500 mb-3">
                Thử hỏi một trong những câu sau:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
