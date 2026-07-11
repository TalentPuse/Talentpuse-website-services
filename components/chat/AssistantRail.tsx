"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icons";
import { ADMIN_ITEM, NAV_ITEMS, isActiveRoute } from "@/components/shell/nav-items";

/**
 * Icon rail for the immersive /assistant surface.
 *
 * /assistant deliberately does NOT use DashboardLayout — its AppShell (SideNav
 * + TopBar) would collide with the chat's own room sidebar and CV pane. But
 * without SOME navigation the assistant is a dead end: the user lands there
 * after signin and cannot reach Ứng tuyển / Việc làm / Hồ sơ.
 *
 * So: the same NAV_ITEMS as SideNav, rendered icons-only in a 56px rail —
 * wide enough to escape anywhere, narrow enough to leave the chat and CV panes
 * their room. Always visible, including on mobile: navigation must never be the
 * thing that gets collapsed away.
 */
export default function AssistantRail() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = user?.is_admin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <aside
      aria-label="Điều hướng chính"
      className="flex h-screen w-14 shrink-0 flex-col items-center border-r border-border bg-surface"
    >
      <Link
        href="/dashboard"
        aria-label="TalentPuse — Dashboard"
        className="flex h-[57px] shrink-0 items-center justify-center border-b border-border px-3"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
          T
        </span>
      </Link>

      {/* KHÔNG dùng overflow-y-auto ở đây: tooltip là `absolute left-full`, và
          overflow-y:auto ép luôn overflow-x:auto → tooltip bị tính vào vùng
          cuộn và đẻ ra một thanh cuộn ngang. Tối đa 8 mục, luôn vừa màn hình. */}
      <nav className="flex flex-1 flex-col gap-1 py-3">
        {items.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex size-10 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-400"
                />
              )}
              <Icon {...ICON} className="shrink-0" />

              {/* Hover label — the only way to learn what an icon means here. */}
              <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
