/**
 * Typed fetch wrappers for the dashboard API.
 *
 * Server components run inside Docker network → use API_BASE_INTERNAL.
 * Client components run in browser → use NEXT_PUBLIC_API_BASE.
 *
 * Cache: `no-store` so refresh-on-load reflects latest gold marts.
 */
const API_BASE =
  process.env.API_BASE_INTERNAL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8001";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return res.json() as Promise<T>;
  } catch {
    return fallback;
  }
}

export type Overview = {
  total_jobs: number;
  pct_with_salary: number;
  avg_salary_million: number | null;
};

export type SkillRow = { skill: string; n_jobs: number; pct_of_jobs: number };

export type HighestPayingSkillRow = {
  skill: string;
  n_jobs: number;
  avg_salary_million: number;
};

export type SalaryByLevelRow = {
  level_city: string;
  job_level: string;
  city_canonical: string;
  p25_million: number;
  p50_million: number;
  p75_million: number;
  n_visible_jobs: number;
};

export type CompanyRow = {
  company_name: string;
  n_jobs: number;
  primary_city: string | null;
  avg_views: number | null;
  avg_salary_million: number | null;
};

const EMPTY_OVERVIEW: Overview = { total_jobs: 0, pct_with_salary: 0, avg_salary_million: null };

export const api = {
  overview: () => fetchJson<Overview>("/api/overview", EMPTY_OVERVIEW),
  topSkills: (limit = 15) => fetchJson<SkillRow[]>(`/api/skills/top?limit=${limit}`, []),
  highestPayingSkills: (limit = 10) =>
    fetchJson<HighestPayingSkillRow[]>(`/api/skills/highest-paying?limit=${limit}`, []),
  salaryByLevel: () => fetchJson<SalaryByLevelRow[]>("/api/salary/by-level", []),
  topCompanies: (limit = 20) =>
    fetchJson<CompanyRow[]>(`/api/companies/top?limit=${limit}`, []),
};

/* ───── Auth types ───── */

export type UserResponse = {
  id: string;
  email: string;
  full_name: string;
  skills: string[];
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  preferred_cities: string[];
  desired_titles: string[];
  is_admin: boolean;
  subscription_tier: string;
  created_at: string;
};

export type SignupPayload = {
  email: string;
  password: string;
  full_name: string;
  skills: string[];
  desired_salary_min?: number;
  desired_salary_max?: number;
  preferred_cities: string[];
  desired_titles: string[];
};

export type ApiError = { message: string; status: number };

/* ───── Client-side auth API (browser only) ───── */

const CLIENT_BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined) || "http://localhost:8001";

async function clientFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${CLIENT_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body.detail ??
      (Array.isArray(body.detail) ? body.detail[0]?.msg : undefined) ??
      "Đã có lỗi xảy ra";
    throw { message: msg, status: res.status } as ApiError;
  }
  return res.json() as Promise<T>;
}

/* ───── Telegram types ───── */

export type TelegramStatus = {
  linked: boolean;
  chat_id: number | null;
  telegram_username: string | null;
  status: "none" | "pending" | "active" | "stopped";
  linked_at: string | null;
  job_alert_enabled: boolean;
};

export type DeepLinkResponse = {
  deep_link: string;
  expires_in_seconds: number;
};

export const telegramApi = {
  getStatus: (token: string) =>
    clientFetch<TelegramStatus>("/api/telegram/status", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createLink: (token: string) =>
    clientFetch<DeepLinkResponse>("/api/telegram/link", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  unlink: (token: string) =>
    fetch(`${CLIENT_BASE}/api/telegram/link`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }),
};

export const authApi = {
  signup: (payload: SignupPayload) =>
    clientFetch<{ access_token: string; token_type: string }>(
      "/api/auth/signup",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  login: (email: string, password: string) =>
    clientFetch<{ access_token: string; token_type: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),

  getMe: (token: string) =>
    clientFetch<UserResponse>("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateMe: (
    token: string,
    data: Partial<Omit<UserResponse, "id" | "email" | "created_at">>,
  ) =>
    clientFetch<UserResponse>("/api/auth/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
};

/* ───── Admin types ───── */

export type AdminStats = {
  total_users: number;
  active_users: number;
  telegram_linked: number;
  alerts_today: number;
  alerts_this_week: number;
  total_alerts: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  subscription_tier: string;
  skills: string[];
  desired_titles: string[];
  preferred_cities: string[];
  telegram_status: string | null;
  telegram_username: string | null;
  alert_enabled: boolean;
  alerts_sent: number;
  created_at: string;
};

export type AdminUserList = {
  users: AdminUserRow[];
  total: number;
  page: number;
  per_page: number;
};

export type AlertLogRow = {
  id: string;
  user_email: string;
  user_full_name: string;
  source_job_id: string;
  job_title: string | null;
  company_name: string | null;
  channel: string;
  sent_at: string;
};

export type AlertLogList = {
  logs: AlertLogRow[];
  total: number;
  page: number;
  per_page: number;
};

export type SystemConfig = {
  alert_interval_seconds: number;
  alert_loop_active: boolean;
  cors_origins: string[];
  telegram_bot_username: string;
  telegram_bot_configured: boolean;
};

export type AdminJobRow = {
  source: string;
  source_job_id: string;
  title: string | null;
  company_name: string | null;
  city_canonical: string | null;
  job_level: string | null;
  salary_million: number | null;
  is_active: boolean;
  posted_at: string | null;
  expired_at: string | null;
  num_of_views: number | null;
  num_of_applications: number | null;
  skills: string[];
};

export type AdminJobList = {
  jobs: AdminJobRow[];
  total: number;
  page: number;
  per_page: number;
};

/* ───── Admin API (browser only, requires admin JWT) ───── */

function adminHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const adminApi = {
  stats: (token: string) =>
    clientFetch<AdminStats>("/api/admin/stats", {
      headers: adminHeaders(token),
    }),

  users: (
    token: string,
    params: { page?: number; per_page?: number; search?: string; is_active?: boolean | null; tier?: string | null },
  ) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.search) q.set("search", params.search);
    if (params.is_active !== undefined && params.is_active !== null)
      q.set("is_active", String(params.is_active));
    if (params.tier) q.set("tier", params.tier);
    return clientFetch<AdminUserList>(`/api/admin/users?${q.toString()}`, {
      headers: adminHeaders(token),
    });
  },

  toggleUserActive: (token: string, userId: string, isActive: boolean) =>
    clientFetch<{ ok: boolean; is_active: boolean }>(
      `/api/admin/users/${userId}/toggle-active?is_active=${isActive}`,
      { method: "PUT", headers: adminHeaders(token) },
    ),

  updateUserTier: (token: string, userId: string, tier: string) =>
    clientFetch<{ ok: boolean; tier: string }>(
      `/api/admin/users/${userId}/tier`,
      { method: "PUT", headers: adminHeaders(token), body: JSON.stringify({ tier }) },
    ),

  alertLogs: (
    token: string,
    params: { page?: number; per_page?: number; user_id?: string; date_from?: string; date_to?: string },
  ) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.user_id) q.set("user_id", params.user_id);
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    return clientFetch<AlertLogList>(`/api/admin/alert-logs?${q.toString()}`, {
      headers: adminHeaders(token),
    });
  },

  getConfig: (token: string) =>
    clientFetch<SystemConfig>("/api/admin/config", {
      headers: adminHeaders(token),
    }),

  updateConfig: (token: string, data: { alert_interval_seconds?: number; alert_loop_active?: boolean }) =>
    clientFetch<SystemConfig>("/api/admin/config", {
      method: "PUT",
      headers: adminHeaders(token),
      body: JSON.stringify(data),
    }),

  dispatchAlerts: (token: string) =>
    clientFetch<{ dispatched: number }>("/api/admin/alerts/dispatch", {
      method: "POST",
      headers: adminHeaders(token),
    }),

  jobs: (
    token: string,
    params: {
      page?: number;
      per_page?: number;
      search?: string;
      city?: string | null;
      level?: string | null;
      has_salary?: boolean | null;
    },
  ) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.search) q.set("search", params.search);
    if (params.city) q.set("city", params.city);
    if (params.level) q.set("level", params.level);
    if (params.has_salary !== undefined && params.has_salary !== null)
      q.set("has_salary", String(params.has_salary));
    return clientFetch<AdminJobList>(`/api/admin/jobs?${q.toString()}`, {
      headers: adminHeaders(token),
    });
  },
};
