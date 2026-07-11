"use client";

/**
 * AI-native home (`/home`) — CopilotKit v2 chat surface behind the
 * NEXT_PUBLIC_AI_HOME flag (Phase 0). Verified against docs/copilotkit-verify.md
 * + .agents/skills/react-core/references/{provider-setup,chat-components}.md
 * and the installed @copilotkit/*@1.62.3 type definitions:
 * - Provider + chat components BOTH come from "@copilotkit/react-core/v2"
 *   (NOT the package root, and NOT "@copilotkit/react-ui" — that package is
 *   v1-only; its "/v2" subpath is CSS-only, no components).
 * - `useSingleEndpoint` matches the Task 6 runtime route's
 *   `mode: "single-route"` (app/api/copilotkit/route.ts).
 * - JWT: forwarded via `copilotkit.setHeaders()` (imperative setter), not a
 *   static `headers` prop — the skill's "Stable headers for rotating auth
 *   tokens" pattern, because the session token can change/clear across the
 *   provider's lifetime (login/logout) and a `headers` prop rebuilt with
 *   `useMemo` would only capture the value from the render that created it.
 * - Agent wiring: `agentId="talentpuse_assistant"` on `<CopilotChat>` (the
 *   same key registered server-side in app/api/copilotkit/route.ts).
 * - `onError` on `<CopilotKit>` (imported from this same v2 subpath) is
 *   NOT the `{ code, error, context }` shape shown in
 *   provider-setup.md / docs/copilotkit-verify.md — that shape belongs to
 *   `CopilotKitProviderProps` (the `<CopilotKitProvider>` subset). The
 *   actual `<CopilotKit>` component (the compat-bridge superset both docs
 *   say to use) is typed via `CopilotKitProps`, whose `onError` is
 *   `CopilotErrorHandler = (errorEvent: CopilotErrorEvent) => void`, where
 *   `CopilotErrorEvent = { type, timestamp, context, error? }` (verified:
 *   node_modules/@copilotkit/shared/dist/types/error.d.mts and the
 *   `declare function CopilotKit({ children, ...props }: CopilotKitProps)`
 *   signature in copilotkit-Bp6BD8xe.d.mts). tsc caught this mismatch.
 */

import "@copilotkit/react-core/v2/styles.css";
import "../copilotkit-theme.css";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CopilotKit, CopilotChat, useCopilotKit } from "@copilotkit/react-core/v2";

import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ForceTheme } from "@/components/theme/ForceTheme";

const SUGGESTIONS_HINT =
  "Hỏi mình về lộ trình kỹ năng, tìm việc, sửa CV hay thị trường IT Việt Nam nhé.";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <ForceTheme theme="light" />
      <HomeContent />
    </ProtectedRoute>
  );
}

function HomeContent() {
  const { token, user } = useAuth();
  if (!token) return null;

  const firstName = user?.full_name?.trim().split(/\s+/).pop();
  const welcomeMessageText = firstName
    ? `Chào ${firstName} 👋 ${SUGGESTIONS_HINT}`
    : `Chào bạn 👋 ${SUGGESTIONS_HINT}`;

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint
      showDevConsole={false}
      onError={(errorEvent) => {
        console.error("[copilotkit]", errorEvent.type, errorEvent.error, errorEvent.context);
        if (errorEvent.type === "error" || errorEvent.type === "request" || errorEvent.type === "response") {
          toast.error("Không thể kết nối trợ lý AI. Vui lòng thử lại.");
        }
      }}
    >
      <AuthTokenSync token={token} />
      <div className="copilot-brand flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-[color:var(--tp-border)] bg-white/55 px-3 py-2.5 backdrop-blur-sm">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-[color:var(--tp-text-muted)] transition hover:bg-[color:var(--tp-muted)] hover:text-[color:var(--tp-primary)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="flex items-center gap-2 font-display text-sm font-medium text-[color:var(--tp-text)]">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899]"
            />
            TalentPuse — Trợ lý sự nghiệp AI
          </span>
          <span className="w-[90px]" />
        </header>
        <div className="min-h-0 flex-1">
          <CopilotChat
            agentId="talentpuse_assistant"
            className="h-full"
            labels={{
              welcomeMessageText,
              chatInputPlaceholder: "Nhập tin nhắn…",
            }}
          />
        </div>
      </div>
    </CopilotKit>
  );
}

/**
 * Forwards the session JWT to the CopilotKit runtime via the imperative
 * `setHeaders()` setter (react-core/references/provider-setup.md, "Stable
 * headers for rotating auth tokens") instead of a static `headers` prop —
 * keeps the Authorization header in sync if the token rotates or clears
 * without needing to remount <CopilotKit>. `setHeaders` overwrites rather
 * than merges, so the current headers are spread first; `Authorization:
 * null` (never reached here since ProtectedRoute guarantees a token, kept
 * for symmetry with the skill's example) clears the header instead of
 * sending an empty one.
 */
function AuthTokenSync({ token }: { token: string | null }) {
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    copilotkit.setHeaders({
      ...copilotkit.headers,
      Authorization: token ? `Bearer ${token}` : null,
    });
  }, [copilotkit, token]);
  return null;
}
