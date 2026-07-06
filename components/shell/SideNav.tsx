"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Sparkles,
  MessageSquare,
  Bell,
  User,
  Settings,
  ICON,
} from "@/lib/icons";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Việc làm", icon: Briefcase },
  { href: "/assistant", label: "Trợ lý AI", icon: Sparkles },
  { href: "/interview", label: "Phỏng vấn", icon: MessageSquare },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Hồ sơ", icon: User },
];

const ADMIN_ITEM: NavItem = { href: "/admin", label: "Quản trị", icon: Settings };

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * SideNav — primary work-shell navigation. Collapses to icons-only below
 * `md`, expands to icon+label at `md` and up. Active route gets a brand
 * accent background plus a 3px left indicator bar.
 */
export default function SideNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = user?.is_admin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <aside
      aria-label="Điều hướng chính"
      className="flex h-screen w-16 shrink-0 flex-col border-r border-border bg-surface md:w-60"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-5 md:px-5">
        <Link
          href="/"
          aria-label="TalentPuse — Trang chủ"
          className="flex min-w-0 items-center gap-2"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            T
          </span>
          <span className="hidden truncate font-display text-lg font-bold text-text md:block">
            TalentPuse
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 md:px-3">
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
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-400"
                />
              )}
              <Icon {...ICON} className="shrink-0" />
              <span className="hidden truncate md:block">{item.label}</span>

              {/* Icon-only tooltip label, shown on hover below `md` */}
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100 md:hidden">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
