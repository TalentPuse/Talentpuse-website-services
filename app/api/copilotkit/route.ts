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
 * - JWT forwarding is automatic: on every `agent/run` / `agent/connect`
 *   dispatch, the runtime clones the agent and runs
 *   `agent.headers = mergeForwardableHeaders(agent.headers, request, ...)`
 *   (dist/v2/runtime/handlers/shared/agent-utils.mjs), which copies the
 *   incoming `Authorization` header onto the per-request agent clone before
 *   it calls the FastAPI AG-UI endpoint. No manual header wiring needed.
 */
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

import { resolveAgentBaseUrl } from "@/lib/agui";

const AGENT_URL = resolveAgentBaseUrl({
  API_BASE_INTERNAL: process.env.API_BASE_INTERNAL,
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
});

const runtime = new CopilotRuntime({
  agents: {
    talentpuse_assistant: new LangGraphHttpAgent({ url: AGENT_URL }),
  },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  mode: "single-route",
});

export const POST = handler;
