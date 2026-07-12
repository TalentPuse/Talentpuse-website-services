import {
  LayoutDashboard,
  Briefcase,
  Sparkles,
  MessageSquare,
  Bell,
  User,
  Settings,
  ClipboardCheck,
} from "@/lib/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

/** Single source of truth for the work-shell navigation. Consumed by both
 *  `shell/SideNav` (icon+label, on the DashboardLayout pages) and
 *  `chat/AssistantRail` (icons-only, on the immersive /assistant surface).
 *  Adding a route here surfaces it in both. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Việc làm", icon: Briefcase },
  { href: "/assistant", label: "Trợ lý AI", icon: Sparkles },
  { href: "/interview", label: "Phỏng vấn", icon: MessageSquare },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/applications", label: "Ứng tuyển", icon: ClipboardCheck },
  { href: "/profile", label: "Hồ sơ", icon: User },
];

export const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Quản trị",
  icon: Settings,
};

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
