"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PanelLeft, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import AssistantRail from "@/components/chat/AssistantRail";
import ChatSidebar from "@/components/chat/ChatSidebar";
import SseChatSurface from "@/components/chat/SseChatSurface";
import CopilotChatSurface from "@/components/chat/CopilotChatSurface";
import CvPreview from "@/components/cv/CvPreview";
import { chatApi, type ChatRoom } from "@/lib/api";
import { AI_HOME } from "@/lib/flags";

/** Chrome dùng chung cho /assistant và /assistant/[roomId]: sidebar lịch sử,
 *  header, khung CV. Bề mặt chat ở giữa do flag quyết định (Task 8 thêm
 *  CopilotChatSurface). Shell KHÔNG giữ state tin nhắn — mỗi bề mặt tự lo. */
export default function AssistantShell({ roomId }: { roomId: string | null }) {
  const { token, user } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped whenever the CV changes, to refresh the preview pane.
  const [cvRefresh, setCvRefresh] = useState(0);
  // Room đang được ghi vào. Theo `roomId` khi điều hướng, nhưng cũng được set
  // tại chỗ khi tin nhắn đầu của một chat mới tạo ra room.
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

  const handleRoomCreated = useCallback((room: ChatRoom) => {
    setActiveRoomId(room.id);
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [room, ...prev]));
  }, []);

  const handleCvUpdated = useCallback(() => setCvRefresh((n) => n + 1), []);

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
      {/* Rail điều hướng — /assistant không dùng DashboardLayout, nên nếu thiếu
          cái này thì user đăng nhập xong sẽ mắc kẹt trong chat, không sang được
          Ứng tuyển / Việc làm / Hồ sơ. */}
      <AssistantRail />

      <aside className="hidden w-[260px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        {sidebar}
      </aside>

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
        {/* h-[57px] khớp đúng khối logo của AssistantRail để đường kẻ ngang của
            rail, sidebar và header nằm trên cùng một hàng. */}
        <header className="flex h-[57px] shrink-0 items-center justify-between border-b border-border bg-surface px-3">
          {/* Nút "Thoát" cũ đã bỏ: rail bên trái có sẵn icon Dashboard, giữ cả
              hai là hai lối làm cùng một việc. */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở lịch sử trò chuyện"
            className="rounded-lg p-2 text-text-muted transition hover:bg-surface-2 hover:text-text lg:hidden"
          >
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          {/* Giữ ô trống cùng bề rộng nút trên ở >=lg để tiêu đề vẫn cân giữa. */}
          <span className="hidden w-[34px] lg:block" aria-hidden="true" />

          <span className="font-display text-sm font-medium text-text-muted">
            Trợ lý sự nghiệp AI
          </span>

          <span className="w-[34px]" aria-hidden="true" />
        </header>

        <div className="min-h-0 flex-1 bg-bg">
          {AI_HOME ? (
            <CopilotChatSurface
              roomId={roomId}
              onRoomCreated={handleRoomCreated}
              userName={firstName}
            />
          ) : (
            <SseChatSurface
              roomId={roomId}
              activeRoomId={activeRoomId}
              onRoomCreated={handleRoomCreated}
              onCvUpdated={handleCvUpdated}
              onSent={fetchRooms}
              userName={firstName}
            />
          )}
        </div>
      </div>

      <div className="hidden w-[38%] max-w-[560px] xl:block">
        <CvPreview refreshSignal={cvRefresh} />
      </div>
    </div>
  );
}
