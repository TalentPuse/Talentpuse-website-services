# TalentPulse Backend

Read-only REST API serving DE/AI job market insights from dbt gold marts.

**Stack**: FastAPI + asyncpg + Pydantic + Postgres

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/api/overview` | 3 KPIs: total jobs, % with salary, avg salary |
| GET | `/api/skills/top?limit=15` | Top skills by demand |
| GET | `/api/skills/highest-paying?limit=10` | Top skills by avg salary |
| GET | `/api/salary/by-level` | Salary P25/P50/P75 by level x city |
| GET | `/api/companies/top?limit=20` | Top hiring companies |
| GET | `/docs` | Swagger UI |

## Run (local dev)

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

Set `DATABASE_URL` if Postgres is not on localhost:
```bash
set DATABASE_URL=postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse
```

## Run (Docker)

```bash
docker compose up -d --build
```

This starts backend + frontend + external pipeline_net.

For production (includes Postgres, MinIO, Caddy):
```bash
cp .env.example .env
# edit .env with real passwords
docker compose -f docker-compose.prod.yml up -d --build
```

## Tests

```bash
.venv/Scripts/pytest -q
```

6 smoke tests (health + 5 endpoint shape checks).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse` | Postgres connection |
| `CORS_ORIGINS` | `http://localhost:3001,http://frontend:3001` | Allowed CORS origins (comma-separated) |

## Deploy

See [docs/deploy.md](docs/deploy.md) for VPS deployment guide.

## Project Layout

```
backend/
├── app/
│   ├── main.py         # FastAPI app + CORS + lifespan
│   ├── db.py           # asyncpg pool
│   ├── models.py       # Pydantic response schemas
│   └── routers/
│       ├── overview.py
│       ├── skills.py
│       ├── salary.py
│       └── companies.py
├── tests/test_endpoints.py
├── requirements.txt
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml       # dev (backend + frontend)
├── docker-compose.prod.yml  # prod (full stack + Caddy + Postgres)
├── Caddyfile
├── .env.example
└── init-metabase-ro.sql
```
