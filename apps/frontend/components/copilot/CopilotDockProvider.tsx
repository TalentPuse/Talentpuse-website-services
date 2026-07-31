"use client";
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

/**
 * Loads the CopilotKit v2 + dock theme stylesheets ONLY when the dock
 * actually mounts (flag on). Rendered exclusively on the flag-on branch
 * below, and the imports here are dynamic `import()` calls inside an
 * effect — not module-scope `import "...css"` — so webpack code-splits
 * both stylesheets into a separate chunk that is fetched/evaluated only
 * when this effect runs. Flag off ⇒ `<DockStyles/>` is never rendered ⇒
 * this effect never runs ⇒ neither stylesheet is ever requested, avoiding
 * the CSS-side-effect leak a static top-of-file import would cause
 * (the CopilotKit sheet's bare `.dark{...}` block would otherwise collide,
 * same-specificity, with app globals on every page regardless of the flag).
 */
function DockStyles() {
  useEffect(() => {
    // Adaptation vs the brief: added `@ts-expect-error` — unlike a static
    // side-effect `import "x.css"` (which tsc accepts without resolving,
    // see CopilotChatSurface.tsx), a dynamic `import()` expression must type
    // its resolved module, and plain (non `.module.css`) stylesheets ship no
    // type declarations here (only `*.module.css` is ambiently declared by
    // Next's global types). Forced by `tsc --noEmit` (TS2307); the runtime
    // behavior — code-split CSS chunk fetched only when this effect runs —
    // is unaffected by the type-only suppression.
    // @ts-expect-error - plain CSS side-effect module, no type declarations for dynamic import()
    import("@copilotkit/react-core/v2/styles.css");
    // @ts-expect-error - plain CSS side-effect module, no type declarations for dynamic import()
    import("@/app/copilotkit-theme.css");
  }, []);
  return null;
}

export default function CopilotDockProvider({
  page, insight, children,
}: { page: "jobs" | "applications"; insight?: React.ReactNode; children: React.ReactNode }) {
  if (!COPILOT_DOCK) return <>{children}</>;
  return (
    // showDevConsole={false}: cho khop CopilotChatSurface.tsx:73, von da tat tu
    // dau. Mac dinh cua CopilotKit la "auto" (tu quyet theo NODE_ENV), va o
    // "auto" no tha mot nut tron den "Web Inspector" de len goc phai tren cua
    // app, kem banner quang cao keo tu cdn.copilotkit.ai ("Slack early access
    // and React Native support are here!") che mat TopBar — UI cua nha cung
    // cap chen vao san pham.
    //
    // Da kiem chung sau khi rebuild: ca hai bien mat, ke ca khi localStorage
    // van con key `cpk:inspector:*` tu phien truoc. Neu chung xuat hien lai,
    // kha nang cao la ban dang xem bundle cu chu khong phai prop nay hong.
    <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false}>
      <DockStyles />
      <AuthHeaders />
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
        <CopilotDock page={page} insight={insight} />
      </div>
    </CopilotKit>
  );
}
