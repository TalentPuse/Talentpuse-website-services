"use client";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAuth } from "@/context/AuthContext";

/** Chat của dock — thread riêng theo user, KHÔNG đăng ký vào room list /assistant. */
export default function DockChat() {
  const { user } = useAuth();
  if (!user) return null;
  // agentId BẮT BUỘC: runtime chỉ đăng ký agent "talentpuse_assistant" (route.ts:175);
  // bỏ trống sẽ tìm agent 'default' và crash "Agent 'default' not found" (đã vấp ở Task 1).
  return <CopilotChat agentId="talentpuse_assistant" threadId={`dock-${user.id}`} className="h-full min-h-0" />;
}
