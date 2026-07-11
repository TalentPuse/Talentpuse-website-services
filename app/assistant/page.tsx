"use client";

import { useEffect, useState } from "react";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ForceTheme } from "@/components/theme/ForceTheme";
import AssistantShell from "@/components/chat/AssistantShell";
import { AI_HOME } from "@/lib/flags";

/** Chat mới.
 *
 *  Đường SSE: room được tạo khi gửi tin đầu (SseChatSurface lo).
 *  Đường CopilotKit: CopilotChat sở hữu ô nhập nên không hook được lúc gửi →
 *  sinh threadId NGAY tại đây và đổi URL bằng replaceState (không điều hướng,
 *  nên không remount và không giết run đang chạy). Room chỉ được ghi vào DB khi
 *  thật sự có tin nhắn (useRoomRegistration) ⇒ không đẻ room rác.
 */
export default function AssistantPage() {
  return (
    <ProtectedRoute>
      <ForceTheme theme="light" />
      {AI_HOME ? <NewCopilotChat /> : <AssistantShell roomId={null} />}
    </ProtectedRoute>
  );
}

function NewCopilotChat() {
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    const id = crypto.randomUUID();
    window.history.replaceState(null, "", `/assistant/${id}`);
    setThreadId(id);
  }, []);

  if (!threadId) return null;
  return <AssistantShell roomId={threadId} />;
}
