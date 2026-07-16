"use client";
import "@copilotkit/react-core/v2/styles.css";
import "@/app/copilotkit-theme.css";
import { useEffect } from "react";
import { CopilotKit, useCopilotKit } from "@copilotkit/react-core/v2";
import { useAuth } from "@/context/AuthContext";
import { COPILOT_DOCK } from "@/lib/flags";
import CopilotDock from "./CopilotDock";

/** setHeaders GHI ĐÈ — phải spread headers hiện có (CopilotChatSurface.tsx:100-110). */
function AuthHeaders() {
  const { token } = useAuth();
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    if (token) copilotkit.setHeaders({ ...copilotkit.headers, Authorization: `Bearer ${token}` });
  }, [token, copilotkit]);
  return null;
}

export default function CopilotDockProvider({
  page, insight, children,
}: { page: "jobs" | "applications"; insight?: React.ReactNode; children: React.ReactNode }) {
  if (!COPILOT_DOCK) return <>{children}</>;
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <AuthHeaders />
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
        <CopilotDock page={page} insight={insight} />
      </div>
    </CopilotKit>
  );
}
