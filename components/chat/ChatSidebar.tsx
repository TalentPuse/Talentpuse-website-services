"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Plus, MessageSquare } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ChatRoom } from "@/lib/api";

type Props = {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  loading: boolean;
  onDelete: (roomId: string) => void;
  /** Closes the mobile drawer after a room is picked. The inline sidebar omits it. */
  onNavigate?: () => void;
};

/** Room list body. The caller supplies the chrome: an inline <aside> on desktop
 *  or a slide-in drawer on mobile. Each room is a real <Link> so rooms are
 *  deep-linkable, open in a new tab, and work with browser back/forward. */
export default function ChatSidebar({
  rooms,
  activeRoomId,
  loading,
  onDelete,
  onNavigate,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <Link
          href="/assistant"
          onClick={onNavigate}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-text-muted transition hover:border-brand-500/50 hover:bg-surface-2 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Cuộc trò chuyện mới
        </Link>
      </div>

      <nav
        aria-label="Lịch sử trò chuyện"
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3"
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted/50" />
          </div>
        ) : rooms.length === 0 ? (
          <p className="py-10 text-center text-xs text-text-muted">Chưa có cuộc trò chuyện nào</p>
        ) : (
          rooms.map((room) => {
            const isActive = activeRoomId === room.id;
            return (
              <div
                key={room.id}
                className={cn(
                  "group relative flex items-center rounded-lg transition",
                  isActive
                    ? "bg-surface-2 text-text"
                    : "text-text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <Link
                  href={`/assistant/${room.id}`}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 pr-8 text-sm"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-50" strokeWidth={1.5} />
                  <span className="truncate">{room.title || "Cuộc trò chuyện mới"}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(room.id)}
                  aria-label={`Xóa ${room.title || "cuộc trò chuyện"}`}
                  title="Xóa"
                  className="absolute right-1.5 rounded-sm p-1 text-text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
