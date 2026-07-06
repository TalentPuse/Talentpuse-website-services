"use client";

import { useState } from "react";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import CommandMenu from "./CommandMenu";

type AppShellProps = {
  children: React.ReactNode;
};

/**
 * AppShell — the light work-route shell: SideNav + TopBar + scrollable
 * content area, plus the global ⌘K CommandMenu. Owns the command-palette
 * open state so the TopBar trigger and the global keyboard shortcut both
 * drive the same dialog.
 */
export default function AppShell({ children }: AppShellProps) {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-auto bg-bg">{children}</main>
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
