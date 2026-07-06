"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Command as CommandIcon, ICON } from "@/lib/icons";

type TopBarProps = {
  /** Optional page-title slot rendered on the left, e.g. `<TopBar>Dashboard</TopBar>`. */
  children?: ReactNode;
  onOpenCommand: () => void;
};

function getInitials(fullName?: string | null): string {
  if (!fullName) return "?";
  return fullName
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * TopBar — sticky header for the work shell: page-title slot on the left,
 * ⌘K trigger + account menu on the right.
 */
export default function TopBar({ children, onOpenCommand }: TopBarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="min-w-0 truncate text-sm font-medium text-text">{children}</div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenCommand}
          aria-label="Mở command menu (⌘K)"
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <CommandIcon size={13} strokeWidth={2} />
          <span>K</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu tài khoản"
              className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-surface-2"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-linear-to-br from-brand-500 to-brand-700 text-white">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-sm font-medium text-text sm:block">
                {user?.full_name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-text">{user?.full_name}</p>
              <p className="truncate text-xs text-text-muted">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/profile")}>
              <User {...ICON} size={16} />
              Hồ sơ
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
              <LogOut {...ICON} size={16} />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
