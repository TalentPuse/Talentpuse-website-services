# TalentPuse Backend

REST API serving DE/AI job market insights and powering the TalentPuse dashboard, user authentication, Telegram alerts, CV parsing, and admin management.

**Stack**: FastAPI + asyncpg + SQLAlchemy 2.0 + Alembic + Pydantic v2

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/api/overview` | KPI: total active jobs |
| GET | `/api/skills/top?limit=15` | Top skills by demand |
| GET | `/api/dashboard/cities?limit=15` | Top cities by active jobs |
| GET | `/api/dashboard/levels?limit=15` | Jobs by experience level |
| GET | `/api/companies/top?limit=20` | Top hiring companies |
| GET | `/api/dashboard/categories` | Available job categories |
| GET | `/docs` | Swagger UI |

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/me` | Update profile (skills, cities, titles, salary, etc.) |

### Jobs (requires auth)
| Method | Path | Description |
|---|---|---|
| GET | `/api/jobs` | Search jobs with filters (search, city, level, source, has_salary, category) |
| GET | `/api/jobs/filters` | Available filter options |
| GET | `/api/jobs/my-alerts` | User's alert history (deduplicated) |

### Telegram Integration (requires auth)
| Method | Path | Description |
|---|---|---|
| POST | `/api/telegram/link` | Generate deep link for Telegram connection |
| GET | `/api/telegram/status` | Check Telegram connection status |
| DELETE | `/api/telegram/link` | Unlink Telegram |
| POST | `/api/telegram/webhook` | Telegram webhook (called by Telegram) |

### CV Upload (requires auth)
| Method | Path | Description |
|---|---|---|
| POST | `/api/cv/upload` | Upload PDF CV, returns extracted profile via LLM |

### Admin (requires admin JWT)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard stats (users, alerts, telegram linked) |
| GET | `/api/admin/users` | List users with filters |
| PUT | `/api/admin/users/{id}/toggle-active` | Activate/deactivate user |
| PUT | `/api/admin/users/{id}/tier` | Update user subscription tier |
| GET | `/api/admin/jobs` | Browse all jobs |
| GET | `/api/admin/alert-logs` | Alert delivery logs |
| GET | `/api/admin/config` | System configuration |
| PUT | `/api/admin/config` | Update system config (alert interval, etc.) |
| POST | `/api/admin/alerts/dispatch` | Manual alert dispatch |
| POST | `/api/admin/alerts/dispatch-internal` | Internal dispatch (called by pipeline) |

## Run (local dev)

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

## Run (Docker)

```bash
docker compose up -d --build
```

## Tests

```bash
.venv/Scripts/pytest -q
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse` | Postgres connection |
| `JWT_SECRET` | `dev-secret-change-in-prod` | JWT signing secret |
| `CORS_ORIGINS` | `http://localhost:8002,http://frontend:8002` | Allowed CORS origins |
| `TELEGRAM_BOT_TOKEN` | _(empty)_ | Telegram bot API token |
| `TELEGRAM_BOT_USERNAME` | `TalentPulseBot` | Bot username for deep links |
| `TELEGRAM_WEBHOOK_SECRET` | `dev-webhook-secret` | Webhook authentication secret |
| `ALERT_INTERVAL_SECONDS` | `7200` (2h) | Alert dispatch interval |
| `OPENAI_API_KEY` | _(empty)_ | LLM API key for CV parsing |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | LLM API base URL |
| `OPENAI_MODEL` | `deepseek/deepseek-v4-flash` | LLM model for CV parsing |
| `S3_ENDPOINT_URL` | `http://minio:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | _(empty)_ | S3 secret key |
| `S3_BUCKET_NAME` | `talentpulse-raw` | S3 bucket for CV files |

## Project Layout

```
backend/
├── app/
│   ├── main.py                    # FastAPI app + CORS + alert loop
│   ├── core/
│   │   ├── config.py              # Environment config
│   │   ├── database.py            # Async SQLAlchemy engine + session
│   │   └── security.py            # JWT + bcrypt + get_current_user
│   ├── models/
│   │   ├── user.py                # User ORM (skills, preferences, tier)
│   │   ├── telegram.py            # TelegramConnection + AlertSubscription
│   │   ├── alert_log.py           # AlertLog (delivery tracking)
│   │   ├── analytics.py           # SQLAlchemy Core tables for dbt gold/silver
│   │   └── base.py                # DeclarativeBase
│   ├── schemas/                   # Pydantic request/response schemas
│   ├── api/
│   │   ├── overview.py            # KPI analytics
│   │   ├── skills.py              # Skill demand endpoints
│   │   ├── salary.py              # Salary distribution endpoints
│   │   ├── companies.py           # Company hiring endpoints
│   │   ├── auth.py                # Signup/login/profile
│   │   ├── jobs.py                # Job search + my alerts
│   │   ├── telegram.py            # Telegram link/webhook
│   │   ├── cv.py                  # CV upload + parsing
│   │   └── admin.py               # Admin panel endpoints
│   └── services/
│       ├── auth.py                # User CRUD + token creation
│       ├── job_matcher.py         # Scoring algorithm + dedup
│       ├── job_alert.py           # Alert dispatch orchestrator
│       ├── telegram.py            # Deep link + webhook handler
│       ├── cv_parser.py           # PDF extraction + LLM parsing + S3 upload
│       └── admin.py               # Admin stats + user management
├── alembic/
│   └── versions/                  # 8 migrations (users → alert_log unique)
├── tests/
├── scripts/
│   └── create_admin.py           # Create admin user
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## Alert System

Alerts are dispatched by a background loop in the FastAPI process:

1. **Scheduler**: Slot-based (7:30-21:30 VN time), interval configurable via `ALERT_INTERVAL_SECONDS`
2. **Matching**: `JobMatcher` scores jobs per user (title 40%, city 25%, salary 20%, skills 15%)
3. **Dedup**: `app.alert_logs` with unique constraint `(user_id, source_job_id, channel)`
4. **Delivery**: Logs to `app.alert_logs` (channel="website"), sends Telegram if linked (channel="telegram")
5. **Pipeline integration**: Prefect flows call `/api/admin/alerts/dispatch-internal` after dbt build
