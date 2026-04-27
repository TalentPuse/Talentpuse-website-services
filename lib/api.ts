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
