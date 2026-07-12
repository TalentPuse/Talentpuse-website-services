# TalentPuse Frontend

Dashboard UI for DE/AI job market insights with user authentication, job search, Telegram alerts, CV upload, and admin management.

**Stack**: Next.js 14 (App Router, SSR) + React + TypeScript + Tailwind CSS + Framer Motion

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with live job market stats and animated counters |
| `/signin` | Login page |
| `/signup` | Registration with profile setup (skills, cities, titles, CV upload) |
| `/dashboard` | Public analytics dashboard (KPIs, skills, salary, companies) |
| `/jobs` | Job search with filters (search, city, level, source, salary, category) |
| `/jobs/alerts` | Alert history in chat-style UI |
| `/profile` | User profile management + Telegram linking + CV upload |
| `/admin` | Admin dashboard |
| `/admin/users` | User management |
| `/admin/jobs` | Job browsing with column toggle |
| `/admin/alerts` | Alert delivery logs |
| `/admin/config` | System configuration (alert interval, etc.) |

## Key Components

### Dashboard (public analytics)
| Component | Chart type | Data source |
|---|---|---|
| `KpiCard` | Stat card | `/api/overview` |
| `SkillsBar` | Horizontal bar | `/api/skills/top` |
| `HighestPayingSkills` | Horizontal bar | `/api/skills/highest-paying` |
| `SalaryByLevel` | Grouped bar (P25/P50/P75) | `/api/salary/by-level` |
| `CompaniesTable` | Table | `/api/companies/top` |

### Auth & Profile
| Component | Purpose |
|---|---|
| `ProtectedRoute` | Redirects unauthenticated users to /signin |
| `AdminProtectedRoute` | Admin-only route guard |
| `SkillPillSelect` / `CityPillSelect` / `TitlePillSelect` | Multi-select pill inputs |
| `AuthInput` | Styled form input |
| `AuthBrandPanel` | Side panel for auth pages |

### Jobs & Alerts
| Component | Purpose |
|---|---|
| `ChatWindow` / `ChatBubble` / `AlertCard` | Chat-style alert history UI |
| `ConnectionCard` | Telegram linking card |
| `TelegramLinkCard` | Deep link generation display |

### Layout
| Component | Purpose |
|---|---|
| `DashboardLayout` + `DashboardSidebar` + `Navbar` | Main app shell with sidebar |
| `AdminLayout` + `AdminSidebar` | Admin panel layout |

## Run (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires backend at http://localhost:8001.

## Run (Docker)

```bash
docker compose up -d --build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_BASE_INTERNAL` | `http://localhost:8001` | Backend URL for SSR (server-side fetch) |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8001` | Backend URL for client-side browser requests |
| `JWT_SECRET` | `dev-secret-change-in-prod` | JWT secret for middleware (admin route protection) |

## Project Layout

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout (Inter font, Providers)
│   ├── providers.tsx           # AuthProvider + Toaster
│   ├── page.tsx                # Landing page
│   ├── middleware.ts           # Admin route protection (JWT verify)
│   ├── signin/page.tsx         # Login
│   ├── signup/page.tsx         # Registration + CV upload
│   ├── dashboard/page.tsx      # Analytics dashboard
│   ├── jobs/
│   │   ├── page.tsx            # Job search
│   │   └── alerts/page.tsx     # Alert history (chat UI)
│   ├── profile/page.tsx        # Profile + Telegram + CV
│   └── admin/
│       ├── page.tsx            # Admin stats
│       ├── users/page.tsx      # User management
│       ├── jobs/page.tsx       # Job browser
│       ├── alerts/page.tsx     # Alert logs
│       └── config/page.tsx     # System config
├── components/
│   ├── Card.tsx, KpiCard.tsx   # Dashboard cards
│   ├── SkillsBar.tsx           # Skill demand chart
│   ├── HighestPayingSkills.tsx # Salary by skill chart
│   ├── SalaryByLevel.tsx       # Salary distribution chart
│   ├── CompaniesTable.tsx      # Top companies table
│   ├── ConnectionCard.tsx      # Telegram/Zalo/Discord connection cards
│   ├── TelegramLinkCard.tsx    # Telegram deep link
│   ├── chat/                   # Chat UI components
│   ├── auth/                   # Auth form components
│   ├── dashboard/              # Layout components
│   ├── admin/                  # Admin layout
│   └── landing/                # Landing page animations
├── context/
│   └── AuthContext.tsx          # JWT auth state + localStorage sync
├── lib/
│   ├── api.ts                  # Typed API client (all endpoints)
│   ├── chat-types.ts           # Chat message types
│   └── landing-i18n.ts         # Landing page i18n
├── tailwind.config.ts
├── next.config.js
└── package.json
```

## Authentication Flow

1. User signs up/logs in → receives JWT
2. JWT stored in localStorage + synced to cookie (`tp_token`)
3. `AuthContext` provides `user`, `token`, `login`, `logout`, `refreshUser`
4. `middleware.ts` protects `/admin/*` routes (verifies JWT + is_admin claim)
5. API calls include `Authorization: Bearer {token}` header
