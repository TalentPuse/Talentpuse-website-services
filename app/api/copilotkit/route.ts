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
 *
 * Rehydration fix (see .superpowers/sdd/rehydration-research.md): a custom
 * `runner:` is wired into `CopilotRuntime` below because the default
 * `InMemoryAgentRunner`'s `connect()` reads a process-local `Map` that has no
 * connection to the LangGraph `AsyncPostgresSaver` checkpointer — opening an
 * existing thread silently rendered an empty conversation. See
 * `LangGraphCheckpointRunner` for the fix.
 */
import { CopilotRuntime, createCopilotRuntimeHandler, InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import type { AgentRunnerConnectRequest } from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { EventType } from "@ag-ui/client";
import type {
  BaseEvent,
  Message,
  MessagesSnapshotEvent,
  RunFinishedEvent,
  RunStartedEvent,
} from "@ag-ui/client";
import { Observable } from "rxjs";
import type { NextRequest } from "next/server";

import { resolveAgentBaseUrl } from "@/lib/agui";

// No trailing slash: used both to build the LangGraph run URL below (with a
// trailing slash added) and as the base for the thread-history read route
// (`${AGENT_BASE}/threads/{threadId}/messages`, see app/api/agui.py).
const AGENT_BASE = resolveAgentBaseUrl({
  API_BASE_INTERNAL: process.env.API_BASE_INTERNAL,
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
});

// Trailing slash: FastAPI mounts the AG-UI sub-app at /api/agent with its route
// at "/", so /api/agent 307-redirects to /api/agent/. Post to the canonical
// path directly to avoid the extra hop.
const AGENT_URL = `${AGENT_BASE}/`;

const AUTH_COOKIE = "tp_token";

/**
 * Custom `AgentRunner` that fixes the "reopening a chat renders empty" bug.
 *
 * Root cause (full trail in .superpowers/sdd/rehydration-research.md):
 * `CopilotChat` auto-calls `connectAgent()` on every mount when an explicit
 * `threadId` is passed, which dispatches (for non-Intelligence runtimes) to
 * `AgentRunner.connect()`. The default `InMemoryAgentRunner.connect()`
 * (node_modules/@copilotkit/runtime/dist/v2/runtime/runner/in-memory.mjs:153-178)
 * looks up a module-scope `GLOBAL_STORE` `Map` keyed by threadId — populated
 * only by `run()` calls THIS runner instance executed in THIS Node process.
 * For any thread not run in the current process (a fresh server, a reload
 * after a restart, or simply a different worker), `connect()` completes with
 * zero events and no error, so `agent.messages` silently stays `[]`.
 *
 * Fix: subclass `InMemoryAgentRunner` and override ONLY `connect()` — `run()`
 * is inherited unchanged, so the live streaming path (already working) is
 * untouched (in-memory.mjs:22-27 `run()`, unaffected by this subclass).
 * `connect()` instead fetches the checkpointed history from the backend's
 * read-only route (`GET {AGENT_BASE}/threads/{threadId}/messages`, added in
 * app/api/agui.py, which reads `graph.aget_state(...)` — never re-runs the
 * graph) and replays it as a single `MESSAGES_SNAPSHOT` event.
 *
 * The event stream MUST be bookended with `RUN_STARTED` … `RUN_FINISHED`.
 * @ag-ui/client runs every stream (connect() included) through a verifier that
 * throws `AGUIError: First event must be 'RUN_STARTED'` otherwise — observed
 * live as `agent_connect_failed`, which discarded the snapshot and left the
 * chat empty even though the correct history had arrived over the wire. The
 * bookends are emitted on EVERY path (empty history, fetch failure) so connect
 * always terminates cleanly.
 *
 * ⚠️ Deliberately does NOT call the run/stream endpoint to "fetch history" —
 * `ag_ui_langgraph`'s `prepare_stream` has a regenerate heuristic that would
 * treat an empty/mismatched `messages` input as a real continuation and fire
 * a genuine, billable LLM turn (see rehydration-research.md §2f/§5).
 */
class LangGraphCheckpointRunner extends InMemoryAgentRunner {
  constructor(private readonly options: { agentBaseUrl: string; authorization?: string }) {
    super();
  }

  override connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const { agentBaseUrl, authorization } = this.options;
    const { threadId } = request;

    return new Observable<BaseEvent>((subscriber) => {
      let cancelled = false;
      const runId = crypto.randomUUID();

      (async () => {
        const started: RunStartedEvent = {
          type: EventType.RUN_STARTED,
          threadId,
          runId,
        };
        subscriber.next(started);

        try {
          const res = await fetch(
            `${agentBaseUrl}/threads/${encodeURIComponent(threadId)}/messages`,
            { headers: authorization ? { Authorization: authorization } : {} },
          );
          if (!res.ok) {
            console.error(
              `[copilotkit] connect(): GET thread messages failed (${res.status}) for thread ${threadId}`,
            );
            return;
          }
          const messages = (await res.json()) as Message[];
          // Skip emitting on a genuinely empty history: a MESSAGES_SNAPSHOT
          // with an empty array would, per @ag-ui/client's apply() case,
          // strip out any non-activity message not present in the snapshot —
          // destructive if a live run already populated agent.messages while
          // this fetch was in flight. A no-op is the safe default here.
          if (!cancelled && messages.length > 0) {
            const snapshot: MessagesSnapshotEvent = {
              type: EventType.MESSAGES_SNAPSHOT,
              messages,
            };
            subscriber.next(snapshot);
          }
        } catch (error) {
          console.error(
            `[copilotkit] connect(): error fetching thread history for thread ${threadId}`,
            error,
          );
        } finally {
          if (!cancelled) {
            const finished: RunFinishedEvent = {
              type: EventType.RUN_FINISHED,
              threadId,
              runId,
            };
            subscriber.next(finished);
            subscriber.complete();
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }
}

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
    runner: new LangGraphCheckpointRunner({
      agentBaseUrl: AGENT_BASE,
      authorization,
    }),
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
    mode: "single-route",
  });

  return handler(req);
};
