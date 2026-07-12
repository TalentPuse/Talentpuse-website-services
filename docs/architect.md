# TalentPulse — Web Stack Architecture

**Last verified:** 2026-07-12, against the running containers — not from memory.
**Scope:** this repo (backend, frontend, mcp, latex). The crawlers, dbt and the
warehouse live in `pipeline_data/docs/architect.md`, which is the canonical
whole-system document — this one points at it rather than repeating it, so the two
cannot drift.

---

## 1. What this repo is

A monorepo — **one** compose file, **three** deploy workflows. Each workflow brings
up only its own service (`docker compose up -d --no-build <service>`), so deploying
the frontend cannot restart the backend.

```
apps/
  backend/    FastAPI — auth, job board, AI agents, alerts, admin console
  frontend/   Next.js 14 (App Router) — public site + dashboard
  mcp/        FastMCP — read-only tools over the warehouse, for the AI agents
```

Plus `tp-latex`, a container that renders a tailored CV to PDF. It is built from
`apps/backend/deploy/tp-latex` and never published to GHCR — the runner builds it
locally when it is missing.

---

## 2. Runtime

```
                         end users
                            │ HTTPS
                            ▼
              ┌──────────────────────────────────────┐
              │  WEB BOX          8 GB / 4 vCPU      │
              │                                      │
              │  tp-frontend  :8002  Next.js         │
              │        │ API_BASE_INTERNAL           │
              │        ▼                             │
              │  tp-backend   :8001  FastAPI  ───────┼──▶ OpenRouter (LLM)
              │        │  │                          │──▶ Telegram / Resend
              │        │  └──────────▶ tp-latex      │       (job alerts)
              │        │                 CV → PDF    │
              │        ▼                             │
              │  tp-mcp       :8080  FastMCP         │
              │        │                             │
              │        ▼                             │
              │  postgres     :5432  (loopback)      │
              │    talentpulse DB                    │
              │      app, user_alerts, public   (RW) │
              │      dbt_dev_*  read-only copy  (RO) │◀── daily one-way sync
              └──────────────────────────────────────┘    from the warehouse box
```

Measured at idle: backend 193 MB, mcp 111 MB, frontend 31 MB, latex 31 MB, postgres
120 MB. **No ML model is loaded into RAM** — the LLM is called over the OpenRouter
API, so there is no `torch` / `transformers` footprint to budget for.

---

## 3. What the backend owns

| Schema | Contents |
|---|---|
| `app` | users, cv_documents, job_applications, chat_*, interview_*, telegram_connections |
| `user_alerts` | subscribers, subscriptions, alert_log |
| `public` | `alembic_version`, LangGraph `checkpoint*` (AI agent state) |

**This data is irreplaceable.** Everything else in the system — crawled jobs, dbt
models — can be rebuilt by re-crawling. These 1.8 MB cannot.

The backend also reads, but never writes, a **local read-only copy** of the
warehouse's job tables (`dbt_dev_gold`, `dbt_dev_silver`, `dbt_dev_feature`),
refreshed by a daily one-way sync. That copy exists because the backend JOINs
`app.job_applications` against `dbt_dev_gold.fct_jobs_daily` **inside single SQL
statements**, and Postgres cannot join across databases. It is a constraint, not a
convenience.

---

## 4. AI stack

- `langchain` + `langgraph`, with `langgraph-checkpoint-postgres` persisting agent
  state into `public.checkpoint*` — conversations survive a restart.
- `ag-ui-langgraph` streams agent output to the frontend over SSE (`AGUI_ENABLED`).
- The MCP server (`apps/mcp`) exposes read-only warehouse tools the agents call, so
  an agent answers "what skills are in demand" from real gold-layer numbers instead
  of inventing them.
- The LLM is **OpenRouter**, despite the variable being called `OPENAI_API_KEY`
  (`OPENAI_BASE_URL` points at OpenRouter).

---

## 5. Constraints that will bite you

**The backend runs ONE uvicorn worker** — no `--workers` flag. One Python process,
one core.

AI streaming is I/O-bound, and asyncio handles hundreds of concurrent SSE streams on
a single worker without trouble. But **CV parsing (PyMuPDF) and LaTeX rendering are
CPU-bound and block the event loop**: one user uploading a heavy CV stalls every
other request, including people mid-conversation with an agent. At a few hundred
users this — not RAM — is the ceiling. The fix is `--workers 2..4` plus moving the
PDF/LaTeX work into a thread pool. Budget ~250-300 MB per extra worker: each loads
its own copy of LangChain.

**Secrets fail fast.** `app/core/config.py` refuses to boot on a missing, too-short
or placeholder secret. This is deliberate: `os.getenv("JWT_SECRET", "dev-secret-…")`
is exactly how this app spent time in production signing tokens with a string
published in its own source. A secret with a fallback is a secret that will
eventually *be* the fallback.

**Rotating `JWT_SECRET` logs everyone out.** Unavoidable — but pick the moment.

**`docker compose up -d <service>` starts only what you name.** `backend` declares
`depends_on: tp-latex` for exactly that reason; without it, CV rendering would
silently have no renderer.

---

## 6. See also

- `pipeline_data/docs/architect.md` — the whole system: crawlers, dbt, warehouse,
  scheduling, backup, network. **Read that one first.**
- `pipeline_data/docs/website-warehouse-db-split.md` — why this box gets its own
  database, and how the user data is moved into it.
