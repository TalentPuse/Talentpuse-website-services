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
