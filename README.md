# TalentPuse Frontend

Dashboard UI for DE/AI job market insights.

**Stack**: Next.js 14 (App Router, SSR) + Recharts + Tailwind CSS

## Components

| Component | Chart type | Data source |
|---|---|---|
| `KpiCard` | Stat card | `/api/overview` |
| `SkillsBar` | Horizontal bar | `/api/skills/top` |
| `HighestPayingSkills` | Horizontal bar | `/api/skills/highest-paying` |
| `SalaryByLevel` | Grouped bar (P25/P50/P75) | `/api/salary/by-level` |
| `CompaniesTable` | Table | `/api/companies/top` |

## Run (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:3001. Requires backend running at http://localhost:8000.

## Run (Docker)

```bash
docker compose up -d --build
```

Or connect to a remote backend:
```bash
API_BASE_INTERNAL=http://your-backend:8000 \
NEXT_PUBLIC_API_BASE=http://your-backend:8000 \
docker compose up -d --build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_BASE_INTERNAL` | `http://localhost:8000` | Backend URL for SSR (server-side fetch inside Docker network) |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000` | Backend URL for client-side browser requests |

## Project Layout

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx        # Dashboard page (SSR, parallel fetch)
│   └── globals.css
├── components/
│   ├── KpiCard.tsx
│   ├── SkillsBar.tsx
│   ├── HighestPayingSkills.tsx
│   ├── SalaryByLevel.tsx
│   └── CompaniesTable.tsx
├── lib/api.ts          # Typed fetch helpers
├── tailwind.config.ts
├── next.config.js
├── package.json
├── Dockerfile
└── docker-compose.yml
```
