"use client";
import { useEffect, useState } from "react";
import { PanelRightClose, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DockChat from "./DockChat";

const OPEN_KEY = "tp_copilot_open";
type Tab = "chat" | "insight";

export default function CopilotDock({
  page,
  insight,
}: { page: "jobs" | "applications"; insight?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setOpen(localStorage.getItem(OPEN_KEY) !== "0"); }, []);
  function toggle() {
    setOpen((v) => { localStorage.setItem(OPEN_KEY, v ? "0" : "1"); return !v; });
  }

  const tabs = (
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
      <button onClick={() => setMobileOpen(false)} aria-label="Đóng"
        className="ml-auto rounded-md p-1.5 text-text-muted hover:bg-surface-2 lg:hidden">
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );

  const body = (
    <>
      {tabs}
      <div className={cn("min-h-0 flex-1", tab !== "chat" && "hidden")}><DockChat /></div>
      {tab === "insight" && <div className="min-h-0 flex-1 overflow-y-auto p-3">{insight}</div>}
    </>
  );

  return (
    <>
      {/* Desktop: cột phải */}
      {open ? (
        <aside aria-label="Trợ lý AI"
          className="hidden w-[380px] shrink-0 flex-col border-l border-border bg-surface lg:flex">
          {body}
        </aside>
      ) : (
        <button onClick={toggle} aria-label="Mở trợ lý AI"
          className="fixed bottom-5 right-5 z-40 hidden rounded-full bg-brand-600 p-3 text-white shadow-lg hover:bg-brand-700 lg:block">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}
      {/* Mobile: nút nổi + sheet */}
      <button onClick={() => setMobileOpen(true)} aria-label="Mở trợ lý AI"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-brand-600 p-3 text-white shadow-lg lg:hidden">
        <Sparkles className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface lg:hidden">{body}</div>
      )}
    </>
  );
}
