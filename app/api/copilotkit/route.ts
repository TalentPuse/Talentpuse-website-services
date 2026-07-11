/**
 * AG-UI runtime route — forwards to the FastAPI LangGraph AG-UI agent.
 *
 * Verified against @copilotkit/runtime@1.62.3 (see docs/copilotkit-verify.md
 * + .agents/skills/runtime/references/setup-endpoint.md):
 * - `createCopilotRuntimeHandler` (from "@copilotkit/runtime/v2") is the
 *   current preferred endpoint primitive; the Hono/Express adapters
 *   (`createCopilotHonoHandler`, `createCopilotExpressHandler`) are flagged
 *   "avoid at all costs" for new code.
 * - This file is a single `route.ts` (no `[...slug]` catch-all), so it can
 *   only ever receive requests at the exact `/api/copilotkit` path — that
 *   requires `mode: "single-route"` (a single POST endpoint accepting a
 *   `{ method, params, body }` envelope). Multi-route mode needs sub-paths
 *   like `/agent/:agentId/run`, which this route can't receive.
 *
 * JWT forwarding: the runtime CAN auto-forward an inbound `Authorization`
 * header onto the per-request agent clone, but this app stores the JWT in the
 * `tp_token` cookie and the CopilotKit client does not put it on the agent/run
 * fetch — so there was no Authorization header to forward and the backend
 * answered 401 "Thiếu token". We therefore read the token here (header first,
 * cookie fallback) and set it explicitly on a per-request agent. The runtime is
 * built inside the handler to keep the token request-scoped — a module-scoped
 * agent would leak one user's token to other users' requests.
 */
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import type { NextRequest } from "next/server";

import { resolveAgentBaseUrl } from "@/lib/agui";

// Trailing slash: FastAPI mounts the AG-UI sub-app at /api/agent with its route
// at "/", so /api/agent 307-redirects to /api/agent/. Post to the canonical
// path directly to avoid the extra hop.
const AGENT_URL = `${resolveAgentBaseUrl({
  API_BASE_INTERNAL: process.env.API_BASE_INTERNAL,
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
})}/`;

const AUTH_COOKIE = "tp_token";

export const POST = async (req: NextRequest) => {
  const header = req.headers.get("authorization");
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const authorization = header ?? (cookie ? `Bearer ${cookie}` : undefined);

  const runtime = new CopilotRuntime({
    agents: {
      talentpuse_assistant: new LangGraphHttpAgent({
        url: AGENT_URL,
        headers: authorization ? { Authorization: authorization } : {},
      }),
    },
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
    mode: "single-route",
  });

  return handler(req);
};
