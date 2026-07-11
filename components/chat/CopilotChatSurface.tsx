"use client";

/**
 * CopilotKit + AG-UI chat surface for /assistant, behind the AI_HOME flag.
 *
 * Verified against the installed @copilotkit/*@1.62.3 type definitions (same
 * facts already established for app/home/page.tsx — see that file's header
 * comment for the provider/onError verification trail):
 * - Provider + chat components both come from "@copilotkit/react-core/v2".
 * - `useAgent`/`agent.messages` re-render subscription (verified for THIS
 *   task, see below).
 *
 * `useAgent` re-render subscription — verified from source, not assumed:
 * `node_modules/@copilotkit/react-core/dist/copilotkit-Bp6BD8xe.d.mts`
 * (region "src/v2/hooks/use-agent.d.ts") declares:
 *   enum UseAgentUpdate { OnMessagesChanged, OnStateChanged, OnRunStatusChanged }
 *   function useAgent({ agentId, updates, throttleMs }?: UseAgentProps): { agent }
 * The bundled implementation (`copilotkit-ympAovXs.mjs`, same region) shows:
 *   const updateFlags = useMemo(() => updates ?? ALL_UPDATES, ...)
 *   // ALL_UPDATES = [OnMessagesChanged, OnStateChanged, OnRunStatusChanged]
 *   if (updateFlags.includes(UseAgentUpdate.OnMessagesChanged))
 *     handlers.onMessagesChanged = batchedForceUpdate;
 *   copilotkit.subscribeToAgentWithOptions(agent, handlers, { throttleMs });
 * So `useAgent({ agentId })` WOULD already re-render on message changes by
 * default (updates defaults to ALL_UPDATES, not to nothing). We still pass
 * `updates: [UseAgentUpdate.OnMessagesChanged]` explicitly here — RoomRegistrar
 * only cares about messages, so opting out of OnStateChanged/OnRunStatusChanged
 * avoids re-rendering it on unrelated state/run-status churn during streaming.
 * `AbstractAgent.messages: Message[]` is a public property
 * (`node_modules/@ag-ui/client/dist/index.d.mts`), and each applied event
 * commits a freshly cloned messages array (see `defaultApplyEvents` /
 * function `N` in `node_modules/@ag-ui/client/dist/index.mjs`, which builds
 * `l` off a `structuredClone` of the previous array) — so `agent.messages`
 * gets a new reference per update, which is what makes
 * `useMemo(() => ..., [agent.messages])` below recompute correctly.
 */

import "@copilotkit/react-core/v2/styles.css";
import "@/app/copilotkit-theme.css";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  CopilotKit,
  CopilotChat,
  useAgent,
  useCopilotKit,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";

import { useAuth } from "@/context/AuthContext";
import { useRoomRegistration } from "@/components/chat/useRoomRegistration";
import type { ChatRoom } from "@/lib/api";

const AGENT_ID = "talentpuse_assistant";

type Props = {
  /** = threadId. Luôn khác null ở nhánh CopilotKit (page sinh sẵn). */
  roomId: string | null;
  onRoomCreated: (room: ChatRoom) => void;
  userName?: string;
};

/** Bề mặt chat CopilotKit + AG-UI (flag NEXT_PUBLIC_AI_HOME on). */
export default function CopilotChatSurface({ roomId, onRoomCreated, userName }: Props) {
  const { token } = useAuth();
  if (!token || !roomId) return null;

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint
      showDevConsole={false}
      onError={(errorEvent) => {
        console.error("[copilotkit]", errorEvent.type, errorEvent.error, errorEvent.context);
        if (
          errorEvent.type === "error" ||
          errorEvent.type === "request" ||
          errorEvent.type === "response"
        ) {
          toast.error("Không thể kết nối trợ lý AI. Vui lòng thử lại.");
        }
      }}
    >
      <AuthTokenSync token={token} />
      <RoomRegistrar token={token} threadId={roomId} onRoomCreated={onRoomCreated} />
      <CopilotChat
        agentId={AGENT_ID}
        threadId={roomId}
        className="h-full"
        labels={{
          welcomeMessageText: `Chào ${userName || "bạn"} 👋 Hỏi mình về skill, việc làm, lương, hay nhờ review CV nhé.`,
          chatInputPlaceholder: "Nhập tin nhắn…",
        }}
      />
    </CopilotKit>
  );
}

/**
 * JWT vào runtime qua setter mệnh lệnh `setHeaders()` (react-core
 * provider-setup.md, mục "Stable headers for rotating auth tokens") thay vì prop
 * `headers` tĩnh — token có thể xoay/xoá trong vòng đời provider. `setHeaders`
 * GHI ĐÈ chứ không merge, nên phải spread headers hiện tại.
 */
function AuthTokenSync({ token }: { token: string }) {
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    copilotkit.setHeaders({ ...copilotkit.headers, Authorization: `Bearer ${token}` });
  }, [copilotkit, token]);
  return null;
}

/** Lấy tin nhắn user đầu tiên của thread → đăng ký ChatRoom cho sidebar. */
function RoomRegistrar({
  token,
  threadId,
  onRoomCreated,
}: {
  token: string;
  threadId: string;
  onRoomCreated: (room: ChatRoom) => void;
}) {
  // updates: [OnMessagesChanged] — chỉ cần re-render khi messages đổi (xem
  // rationale trong header comment của file này).
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [UseAgentUpdate.OnMessagesChanged],
  });

  const firstUserMessage = useMemo(() => {
    const first = agent.messages?.find((m) => m.role === "user");
    if (!first) return null;
    return typeof first.content === "string" ? first.content : null;
  }, [agent.messages]);

  useRoomRegistration({ token, threadId, firstUserMessage, onRoomCreated });
  return null;
}
