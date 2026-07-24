"use client";
import { useCallback, useEffect, useState } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAuth } from "@/context/AuthContext";

const THREAD_GEN_KEY = "tp_dock_thread_gen";

/**
 * Gắn theo user.id — cùng lý do với `summaryKeyFor` trong DockInsight.tsx:
 * nếu user chưa sẵn sàng (đang hydrate AuthContext) trả về null thay vì rơi
 * về một chuỗi cố định ("tp_dock_thread_gen:undefined"), nếu không đó sẽ là
 * key dùng chung cho mọi tài khoản và user A có thể đọc/ghi đè bộ đếm thread
 * của user B.
 */
function threadGenKeyFor(userId: string | null | undefined): string | null {
  return userId ? `${THREAD_GEN_KEY}:${userId}` : null;
}

/** Đọc bộ đếm thread hiện tại của một user; mặc định 0 nếu chưa từng lưu. */
function readGeneration(userId: string | null | undefined): number {
  const key = threadGenKeyFor(userId);
  if (!key) return 0;
  const parsed = Number.parseInt(localStorage.getItem(key) ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * generation = 0 (mặc định, tài khoản chưa từng bấm "Cuộc trò chuyện mới")
 * ⇒ threadId GIỮ NGUYÊN định dạng cũ `dock-${userId}` — bắt buộc, để không
 * đổi threadId ngầm cho mọi tài khoản hiện có (sẽ trông như mất lịch sử chat
 * dù LangGraph vẫn còn giữ nguyên thread cũ).
 */
function threadIdFor(userId: string, generation: number): string {
  return generation > 0 ? `dock-${userId}-${generation}` : `dock-${userId}`;
}

/** Chat của dock — thread riêng theo user, KHÔNG đăng ký vào room list /assistant. */
export default function DockChat() {
  const { user } = useAuth();
  const [generation, setGeneration] = useState(0);
  // Chỉ true sau khi effect dưới đây đã đọc xong bộ đếm thread cho ĐÚNG user
  // hiện tại từ localStorage — tránh mount CopilotChat với threadId mặc định
  // (generation 0) rồi phải đổi threadId ngay sau đó cho user đã từng bấm
  // "Cuộc trò chuyện mới" (generation > 0), gây nhấp nháy chuyển thread.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user) return;
    setGeneration(readGeneration(user.id));
    setHydrated(true);
  }, [user]);

  // Bắt đầu "Cuộc trò chuyện mới": chỉ tăng bộ đếm để threadId trỏ sang một
  // thread mới — KHÔNG xoá gì. LangGraph vẫn giữ nguyên thread cũ trong
  // Postgres nên thao tác này luôn có thể khôi phục được, vì vậy cố tình
  // KHÔNG có hộp thoại xác nhận (sẽ chỉ là ma sát thừa cho một hành động rẻ).
  const startNewThread = useCallback(() => {
    if (!user) return;
    const key = threadGenKeyFor(user.id);
    if (!key) return;
    const next = readGeneration(user.id) + 1;
    localStorage.setItem(key, String(next));
    setGeneration(next);
  }, [user]);

  if (!user || !hydrated) return null;
  // agentId BẮT BUỘC: runtime chỉ đăng ký agent "talentpuse_assistant" (route.ts:175);
  // bỏ trống sẽ tìm agent 'default' và crash "Agent 'default' not found" (đã vấp ở Task 1).
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 justify-end border-b border-border px-2 py-1">
        <button
          type="button"
          onClick={startNewThread}
          className="rounded-md px-2 py-1 text-xs text-text-muted ring-border hover:bg-surface-2 hover:text-text"
        >
          Cuộc trò chuyện mới
        </button>
      </div>
      <CopilotChat
        agentId="talentpuse_assistant"
        threadId={threadIdFor(user.id, generation)}
        labels={{ chatInputPlaceholder: "Nhập tin nhắn..." }}
        className="h-full min-h-0 flex-1"
      />
    </div>
  );
}
