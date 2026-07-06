"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Briefcase,
  Sparkles,
  MessageSquare,
  Bell,
  User,
  ICON,
} from "@/lib/icons";

type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CommandEntry = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const NAVIGATION_ENTRIES: CommandEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Việc làm", href: "/jobs", icon: Briefcase },
  { label: "Trợ lý AI", href: "/assistant", icon: Sparkles },
  { label: "Luyện phỏng vấn", href: "/interview", icon: MessageSquare },
  { label: "Lịch sử Alert", href: "/alerts", icon: Bell },
  { label: "Hồ sơ", href: "/profile", icon: User },
];

const QUICK_ACTIONS: CommandEntry[] = [
  { label: "Cuộc trò chuyện mới", href: "/assistant", icon: Sparkles },
  { label: "Tải lên CV", href: "/profile", icon: User },
];

/**
 * CommandMenu — global ⌘K / Ctrl+K command palette. Open state is owned by
 * the caller (AppShell) so both the TopBar trigger button and the global
 * keyboard shortcut can drive the same dialog instance.
 */
export default function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command menu"
      description="Điều hướng nhanh trong TalentPuse"
    >
      <CommandInput placeholder="Tìm trang, hành động..." />
      <CommandList>
        <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
        <CommandGroup heading="Điều hướng">
          {NAVIGATION_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <CommandItem
                key={entry.href}
                value={entry.label}
                onSelect={() => navigate(entry.href)}
              >
                <Icon {...ICON} />
                <span>{entry.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Hành động nhanh">
          {QUICK_ACTIONS.map((entry) => {
            const Icon = entry.icon;
            return (
              <CommandItem
                key={entry.label}
                value={entry.label}
                onSelect={() => navigate(entry.href)}
              >
                <Icon {...ICON} />
                <span>{entry.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
