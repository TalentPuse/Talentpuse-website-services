"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ForceTheme } from "@/components/theme/ForceTheme";
import AssistantShell from "@/components/chat/AssistantShell";

/** New chat. A room is only created once the first message is sent, at which
 *  point the URL becomes /assistant/[roomId]. */
export default function AssistantPage() {
  // Focus-first surface: wrap in ProtectedRoute directly (NOT DashboardLayout).
  // DashboardLayout injects the AppShell (SideNav + TopBar), which would collide
  // with this page's own chat sidebar — it renders its own minimal chrome.
  return (
    <ProtectedRoute>
      <ForceTheme theme="light" />
      <AssistantShell roomId={null} />
    </ProtectedRoute>
  );
}
