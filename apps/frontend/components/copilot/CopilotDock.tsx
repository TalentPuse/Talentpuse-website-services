"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PanelRightClose, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DockChat from "./DockChat";

const OPEN_KEY = "tp_copilot_open";
type Tab = "chat" | "insight";

/**
 * SSR-safe layout effect: runs synchronously before paint on the client (so
 * the persisted open/collapsed state is applied before the browser paints —
 * no open-then-snap-shut flash) and falls back to `useEffect` on the server
 * to avoid React's "useLayoutEffect does nothing on the server" warning.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function CopilotDock({
  page,
  insight,
}: { page: "jobs" | "applications"; insight?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  useIsomorphicLayoutEffect(() => {
    setOpen(localStorage.getItem(OPEN_KEY) !== "0");
  }, []);

  function toggle() {
    setOpen((v) => { localStorage.setItem(OPEN_KEY, v ? "0" : "1"); return !v; });
  }

  // Mobile sheet dialog behavior: focus the close button on open, restore
  // focus to the floating trigger on close, Escape closes it, body scroll
  // locked while open (restored on close/unmount).
  useEffect(() => {
    if (!mobileOpen) return;
    mobileCloseRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      mobileTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  // Parameterized (not a shared const) because it's rendered in two places
  // that can be mounted simultaneously (desktop aside + mobile sheet) — a
  // single shared ref on the close button would flip between them.
  function renderTabs(closeButtonRef?: React.RefObject<HTMLButtonElement>) {
    return (
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <Sparkles className="h-4 w-4 text-brand-500" strokeWidth={1.75} />
        {(["chat", "insight"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
              tab === t ? "bg-brand-50 text-brand-700" : "text-text-muted hover:bg-surface-2")}>
            {t === "chat" ? "Chat" : "Insight"}
          </button>
        ))}
        <button onClick={toggle} aria-label="Thu gọn trợ lý"
          className="ml-auto hidden rounded-md p-1.5 text-text-muted hover:bg-surface-2 lg:block">
          <PanelRightClose className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button ref={closeButtonRef} onClick={() => setMobileOpen(false)} aria-label="Đóng"
          className="ml-auto rounded-md p-1.5 text-text-muted hover:bg-surface-2 lg:hidden">
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  function renderBody(closeButtonRef?: React.RefObject<HTMLButtonElement>) {
    return (
      <>
        {renderTabs(closeButtonRef)}
        <div className={cn("min-h-0 flex-1", tab !== "chat" && "hidden")}><DockChat /></div>
        {/*
         * PHẢI giữ mounted (ẩn bằng `hidden`) giống pane Chat ở trên — KHÔNG
         * được quay lại `{tab === "insight" && <div>...}`. DockInsight tự
         * quản lý state `hydrated`/`hasFetched`/`failed`/`loading` cho một
         * lượt tóm tắt AI có tính phí; unmount nó khi đổi tab xoá sạch state
         * đó, khiến: (1) một lượt fetch đang chạy dở bị huỷ nửa chừng rồi
         * mount lại bắn lượt fetch thứ hai (tốn phí LLM gấp đôi), và (2) một
         * lượt fetch đã fail sẽ tự động refetch ở lần đổi tab kế tiếp thay vì
         * đợi người dùng bấm nút "Thử lại". Xem comment trong DockInsight.tsx.
         */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", tab !== "insight" && "hidden")}>{insight}</div>
      </>
    );
  }

  return (
    <>
      {/* Desktop: cột phải */}
      {open ? (
        <aside aria-label="Trợ lý AI"
          className="hidden w-[380px] shrink-0 flex-col border-l border-border bg-surface lg:flex">
          {renderBody()}
        </aside>
      ) : (
        <button onClick={toggle} aria-label="Mở trợ lý AI"
          className="fixed bottom-5 right-5 z-40 hidden rounded-full bg-brand-600 p-3 text-white shadow-lg hover:bg-brand-700 lg:block">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}
      {/* Mobile: nút nổi + sheet */}
      <button ref={mobileTriggerRef} onClick={() => setMobileOpen(true)} aria-label="Mở trợ lý AI"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-brand-600 p-3 text-white shadow-lg lg:hidden">
        <Sparkles className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {mobileOpen && (
        <div role="dialog" aria-modal="true" aria-label="Trợ lý AI"
          className="fixed inset-0 z-50 flex flex-col bg-surface lg:hidden">
          {renderBody(mobileCloseRef)}
        </div>
      )}
    </>
  );
}
