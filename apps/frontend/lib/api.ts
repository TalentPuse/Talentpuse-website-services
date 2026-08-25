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
};

export type SkillRow = { skill: string; n_jobs: number; pct_of_jobs: number };

export type DashboardRow = { name: string; n_jobs: number; pct_of_jobs: number };

export type CompanyRow = {
  company_name: string;
  n_jobs: number;
  primary_city: string | null;
  avg_views: number | null;
};

const EMPTY_OVERVIEW: Overview = { total_jobs: 0 };

function catParam(category?: string) {
  return category ? `&category=${encodeURIComponent(category)}` : "";
}

export const api = {
  overview: (category?: string) =>
    fetchJson<Overview>(`/api/overview${category ? `?category=${encodeURIComponent(category)}` : ""}`, EMPTY_OVERVIEW),
  topSkills: (limit = 15, category?: string) =>
    fetchJson<SkillRow[]>(`/api/skills/top?limit=${limit}${catParam(category)}`, []),
  dashboardCities: (limit = 15, category?: string) =>
    fetchJson<DashboardRow[]>(`/api/dashboard/cities?limit=${limit}${catParam(category)}`, []),
  dashboardLevels: (limit = 15, category?: string) =>
    fetchJson<DashboardRow[]>(`/api/dashboard/levels?limit=${limit}${catParam(category)}`, []),
  topCompanies: (limit = 20, category?: string) =>
    fetchJson<CompanyRow[]>(`/api/companies/top?limit=${limit}${catParam(category)}`, []),
  categories: () =>
    fetchJson<string[]>("/api/dashboard/categories", []),
};

/* ───── Client-side dashboard API (browser, no auth) ───── */

const DASHBOARD_BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined) || "";

async function dashboardFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return res.json() as Promise<T>;
  } catch {
    return fallback;
  }
}

export const dashboardApi = {
  categories: () =>
    dashboardFetch<string[]>("/api/dashboard/categories", []),
  overview: (category?: string) =>
    dashboardFetch<Overview>(`/api/overview${category ? `?category=${encodeURIComponent(category)}` : ""}`, EMPTY_OVERVIEW),
  topSkills: (limit: number, category?: string) =>
    dashboardFetch<SkillRow[]>(`/api/skills/top?limit=${limit}${catParam(category)}`, []),
  dashboardCities: (limit: number, category?: string) =>
    dashboardFetch<DashboardRow[]>(`/api/dashboard/cities?limit=${limit}${catParam(category)}`, []),
  dashboardLevels: (limit: number, category?: string) =>
    dashboardFetch<DashboardRow[]>(`/api/dashboard/levels?limit=${limit}${catParam(category)}`, []),
  topCompanies: (limit: number, category?: string) =>
    dashboardFetch<CompanyRow[]>(`/api/companies/top?limit=${limit}${catParam(category)}`, []),
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
  experience_level: string | null;
  university: string | null;
  graduation_year: number | null;
  open_to_internship: boolean;
  part_time_ok: boolean;
  cv_file_url: string | null;
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
  experience_level?: string;
  university?: string;
  graduation_year?: number;
  open_to_internship?: boolean;
  part_time_ok?: boolean;
};

export type ApiError = { message: string; status: number };

/**
 * Rút thông điệp lỗi từ body của FastAPI, LUÔN trả về string.
 *
 * FastAPI trả `detail` ở HAI dạng: chuỗi (HTTPException tự viết) và MẢNG object
 * `[{msg, loc, type, input, ctx}]` (lỗi validate Pydantic, mã 422).
 *
 * Trước đây chỗ này viết `body.detail ?? (Array.isArray(body.detail) ? ... )`.
 * `??` chỉ rơi sang vế phải khi vế trái là null/undefined — mảng thì không phải,
 * nên `message` nhận nguyên CẢ MẢNG và nhánh `Array.isArray` là code chết. Hậu
 * quả có thật: người dùng gõ email thừa dấu chấm cuối ("a@gmail.com.") → backend
 * 422 → trang đăng nhập render `{error}` với error là một mảng → React ném
 * "Objects are not valid as a React child" → app không có error.tsx nên rơi
 * thẳng ra màn hình "Application error", mất sạch form. Lỗi gõ phím thành ngõ
 * cụt ngay cửa vào sản phẩm.
 */
export function errorMessage(body: unknown, fallback = "Đã có lỗi xảy ra"): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (typeof first?.msg === "string" && first.msg) return first.msg;
  }
  return fallback;
}

/* ───── Client-side auth API (browser only) ───── */

const CLIENT_BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined) || "";

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
    throw { message: errorMessage(body), status: res.status } as ApiError;
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

export type TimeSeriesPoint = { date: string; value: number };
export type TierBreakdown = { tier: string; count: number };
export type ChannelBreakdown = { channel: string; count: number };
export type SessionModeBreakdown = { mode: string; status: string; count: number };

export type AdminStats = {
  total_users: number;
  active_users: number;
  telegram_linked: number;
  alerts_today: number;
  alerts_this_week: number;
  total_alerts: number;
  total_interview_sessions: number;
  total_interview_answers: number;
  total_chat_rooms: number;
  total_chat_messages: number;
  active_jobs: number;
  alert_subscribers: number;
  user_signups_daily: TimeSeriesPoint[];
  alerts_daily: TimeSeriesPoint[];
  tier_breakdown: TierBreakdown[];
  alert_channel_breakdown: ChannelBreakdown[];
  session_mode_breakdown: SessionModeBreakdown[];
};

export type AdminUserProfile = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  subscription_tier: string;
  experience_level: string | null;
  university: string | null;
  graduation_year: number | null;
  open_to_internship: boolean;
  part_time_ok: boolean;
  skills: string[];
  desired_titles: string[];
  preferred_cities: string[];
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  cv_file_url: string | null;
  telegram_status: string | null;
  telegram_username: string | null;
  alert_enabled: boolean;
  email_alert_enabled: boolean;
  alerts_sent: number;
  created_at: string;
  updated_at: string | null;
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
  email_alert_enabled: boolean;
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
  /** Nguồn thật của tin — link Job ID phải theo nguồn này, không ghép cứng VietnamWorks (JA-48). */
  job_source: string | null;
  job_title: string | null;
  company_name: string | null;
  source_url: string | null;
  channel: string;
  sent_at: string;
};

export type AlertLogList = {
  logs: AlertLogRow[];
  total: number;
  page: number;
  per_page: number;
};

export type AlertDispatchStats = {
  channel_breakdown: Record<string, number>;
  failed_emails: number;
  source_breakdown: Record<string, number>;
};

export type RetryAlertsResponse = {
  retried: number;
  total: number;
  message?: string;
};

export type DispatchHistoryEntry = {
  date: string;
  source: string;
  jobs_sent: number;
  total_logs: number;
  telegram_sent: number;
  email_sent: number;
};

export type DispatchHistoryResponse = {
  entries: DispatchHistoryEntry[];
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
  company_size_bucket: string | null;
  job_category: string | null;
  city_canonical: string | null;
  region: string | null;
  job_level: string | null;
  degree_label: string | null;
  salary_million: number | null;
  is_active: boolean;
  posted_at: string | null;
  expired_at: string | null;
  num_of_views: number | null;
  num_of_applications: number | null;
  source_url: string | null;
  address: string | null;
  skills: string[];
};

export type AdminJobList = {
  jobs: AdminJobRow[];
  total: number;
  page: number;
  per_page: number;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  quota_month: number;
  used_count: number;
  quota_reset_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

/* ───── Admin API (browser only, requires admin JWT) ───── */

function adminHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/* ───── Jobs (public, requires auth) ───── */

export type PublicJobRow = {
  source: string;
  source_job_id: string;
  title: string | null;
  company_name: string | null;
  /** Logo cong ty (URL tuyet doi tu CDN cua nguon). Phu ~99% tin; null thi
   *  frontend roi ve Monogram chu cai dau. */
  company_logo_url: string | null;
  city_canonical: string | null;
  job_level: string | null;
  job_category: string | null;
  salary_million: number | null;
  source_url: string | null;
  posted_at: string | null;
  skills: string[];
  // Chi co gia tri khi goi voi `sort: "match"`. null o cac truong hop khac,
  // KE CA khi ho so nguoi dung rong (xem app/services/job_fit).
  match_score: number | null;
};

export interface JobMatch {
  score: number;
  reasons: string[];
  matched_skills: string[];
  missing_skills: string[];
  skill_basis: "required" | "mentioned" | "none";
  skills_matched: number;
  skills_total: number;
  criteria_used: string[];
}

export interface JobDetail {
  source: string;
  source_job_id: string;
  title: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  company_size_label: string | null;
  city_canonical: string | null;
  primary_address: string | null;
  job_level: string | null;
  job_category: string | null;
  employment_type: string | null;
  years_of_experience: number | null;
  working_days: string | null;
  degree_label: string | null;
  salary_million: number | null;
  salary_min_million: number | null;
  salary_max_million: number | null;
  description: string | null;
  requirement: string | null;
  benefits: string[];
  skills: string[];
  source_url: string | null;
  posted_at: string | null;
  expired_at: string | null;
  num_of_views: number | null;
  num_of_applications: number | null;
  match: JobMatch | null;
}

export type PublicJobList = {
  jobs: PublicJobRow[];
  total: number;
  page: number;
  per_page: number;
  // So tin THUC SU duoc cham diem o lan rerank nay (<= RERANK_POOL cua
  // backend). null khi khong sap xep theo do phu hop. PHAI hien thi con so
  // nay tren UI — cat bot am tham se doc thanh "da xet het kho".
  scored_pool: number | null;
};

export type FilterOptions = {
  cities: string[];
  levels: string[];
  sources: string[];
  categories: string[];
};

export type MyAlertRow = {
  source_job_id: string;
  source: string | null;
  title: string | null;
  company_name: string | null;
  city_canonical: string | null;
  salary_million: number | null;
  source_url: string | null;
  sent_at: string;
  /**
   * Các kênh alert này THỰC SỰ được gửi qua. Rỗng = chưa gửi đi đâu cả.
   *
   * Trước đây là một chuỗi `channel` duy nhất, và giá trị đó do Postgres chọn
   * tuỳ ý: dòng 'website' (dấu mốc dedup) và 'telegram' được ghi trong cùng
   * một transaction nên `sent_at` bằng nhau tuyệt đối, không có tiebreak.
   * Postgres thường trả 'website', và UI mặc định mọi thứ không phải
   * 'telegram' là email — nên gần như mọi alert đều hiện "Gửi qua Email" dù
   * thực tế gửi bằng Telegram (JA-29, JA-54).
   */
  channels: string[];
  /** Tin còn tuyển hay đã hết hạn — alert cũ vẫn hiện, chỉ đánh dấu (JA-31). */
  is_active: boolean;
};

export type MyAlertList = {
  alerts: MyAlertRow[];
  total: number;
  page: number;
  per_page: number;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type CareerRecommendations = {
  generated_at: string;
  has_enough_data: boolean;
  profile_used: {
    skills: string[];
    desired_titles: string[];
    experience_level: string | null;
    preferred_cities: string[];
  };
  target_roles: string[];
  market_fit: { matching_jobs: number; matching_jobs_in_city: number; cities: string[] };
  your_strengths: { skill: string; n_jobs: number }[];
  skill_gaps: { skill: string; n_jobs: number; avg_salary_million: number | null }[];
  salary_insight?: unknown;
  top_companies?: { company_name?: string; n_jobs?: number }[] | null;
  narrative: string;
  data_note?: string | null;
};

export const recommendationsApi = {
  get: (token: string) =>
    clientFetch<CareerRecommendations>("/api/recommendations", {
      headers: authHeaders(token),
    }),
};

export const jobsApi = {
  list: (
    token: string,
    params: {
      page?: number;
      per_page?: number;
      search?: string;
      city?: string | null;
      level?: string | null;
      source?: string | null;
      has_salary?: boolean | null;
      category?: string | null;
      /** "match" sap xep theo do phu hop; bo qua/undefined = moi nhat truoc. */
      sort?: "match" | null;
    },
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.search) q.set("search", params.search);
    if (params.city) q.set("city", params.city);
    if (params.level) q.set("level", params.level);
    if (params.source) q.set("source", params.source);
    if (params.category) q.set("category", params.category);
    if (params.has_salary !== undefined && params.has_salary !== null)
      q.set("has_salary", String(params.has_salary));
    if (params.sort) q.set("sort", params.sort);
    return clientFetch<PublicJobList>(`/api/jobs?${q.toString()}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  filters: (token: string) =>
    clientFetch<FilterOptions>("/api/jobs/filters", {
      headers: authHeaders(token),
    }),

  detail: (source: string, sourceJobId: string, token: string, signal?: AbortSignal) =>
    clientFetch<JobDetail>(
      `/api/jobs/${encodeURIComponent(source)}/${encodeURIComponent(sourceJobId)}`,
      { headers: authHeaders(token), signal },
    ),

  myAlerts: (
    token: string,
    params: { page?: number; per_page?: number },
  ) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    return clientFetch<MyAlertList>(`/api/jobs/my-alerts?${q.toString()}`, {
      headers: authHeaders(token),
    });
  },
};

/**
 * Mot khoi metric kem NGUON va trang thai.
 *
 * `data` co the null CO Y: khi `status === "error"` thi con so la KHONG BIET,
 * khong phai 0. Backend khong bao gio gui 0 thay cho mot nguon chet, va UI cung
 * khong duoc phep bien null thanh 0 (`?? 0`) o cho hien thi.
 */
export type MetricSource = "umami" | "postgres" | "cloudflare";

export type AnalyticsBlock<T> = {
  source: MetricSource;
  status: "ok" | "error";
  data: T | null;
  error?: string | null;
};

export type TrafficStats = {
  pageviews: number;
  visitors: number;
  visits: number;
  bounce_rate: number;
};

export type TrafficSourceRow = { name: string; visitors: number };

export type ActiveUsersStats = {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
};

export type FunnelSteps = {
  signed_up: number;
  profile_completed: number;
  channel_enabled: number;
  alerted: number;
};

export type CohortRow = {
  cohort_week: string;
  size: number;
  d1: number;
  d7: number;
  d30: number;
};

export type AnalyticsOverview = {
  traffic: AnalyticsBlock<TrafficStats>;
  sources: AnalyticsBlock<TrafficSourceRow[]>;
  activity: AnalyticsBlock<ActiveUsersStats>;
  funnel: AnalyticsBlock<FunnelSteps>;
  cohorts: AnalyticsBlock<CohortRow[]>;
};

export const adminApi = {
  stats: (token: string) =>
    clientFetch<AdminStats>("/api/admin/stats", {
      headers: adminHeaders(token),
    }),

  analyticsOverview: (token: string, days = 30) =>
    clientFetch<AnalyticsOverview>(
      `/api/admin/analytics/overview?days=${days}`,
      { headers: adminHeaders(token) },
    ),

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

  getUserProfile: (token: string, userId: string) =>
    clientFetch<AdminUserProfile>(`/api/admin/users/${userId}`, {
      headers: adminHeaders(token),
    }),

  updateUserTier: (token: string, userId: string, tier: string) =>
    clientFetch<{ ok: boolean; tier: string }>(
      `/api/admin/users/${userId}/tier`,
      { method: "PUT", headers: adminHeaders(token), body: JSON.stringify({ tier }) },
    ),

  toggleEmailAlert: (token: string, userId: string, enabled: boolean) =>
    clientFetch<{ ok: boolean; email_alert_enabled: boolean }>(
      `/api/admin/users/${userId}/email-alert`,
      { method: "PUT", headers: adminHeaders(token), body: JSON.stringify({ enabled }) },
    ),

  alertLogs: (
    token: string,
    params: {
      page?: number;
      per_page?: number;
      user_id?: string;
      date_from?: string;
      date_to?: string;
      channel?: string;
      search?: string;
    },
  ) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.user_id) q.set("user_id", params.user_id);
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.channel) q.set("channel", params.channel);
    if (params.search) q.set("search", params.search);
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

  emailAllUsers: (token: string) =>
    clientFetch<{ emailed: number; skipped_no_jobs: number; failed: number; total_users: number }>(
      "/api/admin/alerts/email-all",
      { method: "POST", headers: adminHeaders(token) },
    ),

  alertDispatchStats: (token: string, params: { date_from?: string; date_to?: string }) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    return clientFetch<AlertDispatchStats>(`/api/admin/alerts/dispatch-stats?${q.toString()}`, {
      headers: adminHeaders(token),
    });
  },

  retryFailedAlerts: (token: string, params: { date_from?: string; date_to?: string; user_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.user_id) q.set("user_id", params.user_id);
    if (params.limit) q.set("limit", String(params.limit));
    return clientFetch<RetryAlertsResponse>(`/api/admin/alerts/retry?${q.toString()}`, {
      method: "POST",
      headers: adminHeaders(token),
    });
  },

  dispatchHistory: (token: string, params: { date_from?: string; date_to?: string; page?: number; per_page?: number }) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    return clientFetch<DispatchHistoryResponse>(`/api/admin/alerts/dispatch-history?${q.toString()}`, {
      headers: adminHeaders(token),
    });
  },

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

  listApiKeys: (token: string) =>
    clientFetch<{ keys: ApiKeyRecord[] }>("/api/admin/api-keys", {
      headers: adminHeaders(token),
    }),

  createApiKey: (token: string, data: { name: string; quota_month?: number; expires_at?: string | null }) =>
    clientFetch<{ api_key: string; name: string; quota_month: number; expires_at: string | null }>("/api/admin/api-keys", {
      method: "POST",
      headers: adminHeaders(token),
      body: JSON.stringify(data),
    }),

  updateApiKeyExpiry: (token: string, keyId: string, expiresAt: string | null) =>
    clientFetch<{ ok: boolean; expires_at: string | null }>(
      `/api/admin/api-keys/${encodeURIComponent(keyId)}/expiry`,
      { method: "PUT", headers: adminHeaders(token), body: JSON.stringify({ expires_at: expiresAt }) },
    ),

  revokeApiKey: (token: string, keyId: string) =>
    clientFetch<{ ok: boolean }>(
      `/api/admin/api-keys/${encodeURIComponent(keyId)}/revoke-by-id`,
      { method: "POST", headers: adminHeaders(token) },
    ),
};

/* ───── CV Upload ───── */

export type CvExtractResponse = {
  extracted: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    summary?: string | null;
    experience_level?: string | null;
    years_of_experience?: number | null;
    skills?: string[];
    desired_titles?: string[];
    preferred_cities?: string[];
    salary_min_m?: number | null;
    salary_max_m?: number | null;
    education?: Array<{
      university?: string | null;
      major?: string | null;
      degree?: string | null;
      graduation_year?: number | null;
      gpa?: number | null;
    }>;
    work_experience?: Array<{
      title?: string;
      company?: string;
      start_date?: string | null;
      end_date?: string | null;
      highlights?: string[];
    }>;
    projects?: Array<{
      name?: string | null;
      description?: string | null;
      tech_stack?: string[];
    }>;
    certifications?: string[];
    languages?: string[];
    _confidence?: Record<string, string>;
  };
  raw_text_length: number;
  error?: string | null;
};

export const cvApi = {
  upload: async (token: string, file: File): Promise<CvExtractResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${CLIENT_BASE}/api/cv/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(errorMessage(body, `Upload failed (${res.status})`));
    }
    return res.json();
  },
};

/* ───── CV Document (rendered PDF) ───── */

export type CvDocument = {
  model: Record<string, unknown>;
  pdf_url: string | null;
  page_count: number | null;
};

export const cvDocumentApi = {
  get: (token: string, signal?: AbortSignal) =>
    clientFetch<CvDocument>("/api/cv/document", { headers: authHeaders(token), signal }),
  getPdfBlob: async (token: string, signal?: AbortSignal): Promise<Blob> => {
    const res = await fetch(`${CLIENT_BASE}/api/cv/document/pdf`, {
      headers: authHeaders(token),
      signal,
    });
    if (!res.ok) {
      throw { message: "Không tải được PDF", status: res.status } as ApiError;
    }
    return res.blob();
  },
};

/* ───── Chat types & API ───── */

export type ChatRoom = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
};

export type ChatMessageResponse = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ChatReplyResponse = {
  user_message: ChatMessageResponse;
  assistant_message: ChatMessageResponse;
};

export type SSEEvent =
  | { type: "user_message"; id: string; role: "user"; content: string; created_at: string }
  | { type: "token"; content: string }
  | { type: "done"; assistant_message: ChatMessageResponse }
  | { type: "cv_updated" }
  | { type: "error"; message: string };

export const chatApi = {
  listRooms: (token: string) =>
    clientFetch<ChatRoom[]>("/api/chat/rooms", {
      headers: authHeaders(token),
    }),

  createRoom: (token: string, opts?: { id?: string; title?: string }) =>
    clientFetch<ChatRoom>("/api/chat/rooms", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ id: opts?.id ?? null, title: opts?.title ?? null }),
    }),

  deleteRoom: (token: string, roomId: string) =>
    fetch(`${CLIENT_BASE}/api/chat/rooms/${roomId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getMessages: (token: string, roomId: string, limit = 50) =>
    clientFetch<ChatMessageResponse[]>(
      `/api/chat/rooms/${roomId}/messages?limit=${limit}`,
      { headers: authHeaders(token) },
    ),

  sendMessage: (token: string, roomId: string, content: string) =>
    clientFetch<ChatReplyResponse>(
      `/api/chat/rooms/${roomId}/messages`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ content }),
      },
    ),

  sendMessageStream: async function* (
    token: string,
    roomId: string,
    content: string,
  ): AsyncGenerator<SSEEvent> {
    const res = await fetch(
      `${CLIENT_BASE}/api/chat/rooms/${roomId}/messages/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw {
        message: errorMessage(body, "Stream request failed"),
        status: res.status,
      } as ApiError;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (!jsonStr) continue;
        try {
          yield JSON.parse(jsonStr) as SSEEvent;
        } catch {
          /* skip malformed */
        }
      }
    }
  },
};

/* ───── Interview types & API ───── */

export type InterviewCategory = {
  id: string;
  label: string;
  label_vi: string;
  description: string;
  count: number;
};

export type InterviewQuestion = {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  answer_tips: string | null;
  star_cues: Record<string, string> | null;
};

export type InterviewSession = {
  id: string;
  mode: "practice" | "mock_test";
  status: string;
  category: string | null;
  target_role: string | null;
  total_questions: number;
  completed_questions: number;
  overall_score: number | null;
  overall_feedback: string | null;
  improvement_plan: string | null;
  time_limit_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type Evaluation = {
  score: number;
  strengths: string;
  improvements: string;
  suggested_answer: string;
};

export type QuestionBreakdown = {
  question_text: string;
  score: number | null;
  strengths: string | null;
  improvements: string | null;
  suggested_answer: string | null;
};

export type MockTestReport = {
  session: SessionDetail;
  overall_score: number;
  overall_feedback: string;
  improvement_plan: string;
  questions: QuestionBreakdown[];
};

export type SessionAnswer = {
  id: string;
  question: InterviewQuestion;
  order_index: number;
  answer_text: string | null;
  score: number | null;
  strengths: string | null;
  improvements: string | null;
  suggested_answer: string | null;
  time_spent_seconds: number | null;
  skipped: boolean;
  answered_at: string | null;
};

export type SessionDetail = InterviewSession & {
  answers: SessionAnswer[];
};

export const interviewApi = {
  getCategories: () =>
    fetchJson<InterviewCategory[]>("/api/interview/categories", []),

  createSession: (token: string, body: {
    mode: "practice" | "mock_test";
    category?: string;
    target_role?: string;
    num_questions?: number;
    time_limit_seconds?: number;
  }) =>
    clientFetch<SessionDetail>("/api/interview/sessions", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  listSessions: (token: string) =>
    clientFetch<InterviewSession[]>("/api/interview/sessions", {
      headers: authHeaders(token),
    }),

  getSession: (token: string, sessionId: string) =>
    clientFetch<SessionDetail>(`/api/interview/sessions/${sessionId}`, {
      headers: authHeaders(token),
    }),

  submitAnswer: (token: string, sessionId: string, answerId: string, body: {
    answer_text: string;
    time_spent_seconds?: number;
  }) =>
    clientFetch<{ status: string; session_status: string }>(
      `/api/interview/sessions/${sessionId}/answers/${answerId}`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(body),
      },
    ),

  skipAnswer: (token: string, sessionId: string, answerId: string) =>
    clientFetch<{ status: string }>(
      `/api/interview/sessions/${sessionId}/answers/${answerId}/skip`,
      {
        method: "POST",
        headers: authHeaders(token),
      },
    ),

  completeSession: (token: string, sessionId: string) =>
    clientFetch<SessionDetail>(`/api/interview/sessions/${sessionId}/complete`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  abandonSession: (token: string, sessionId: string) =>
    fetch(`${CLIENT_BASE}/api/interview/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
};

/* ───── Interview Agent types & API (new chatbot-based) ───── */

export type InterviewAgentMode = "technical" | "behavioral";

export type InterviewAgentMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  audio_url: string | null;
  created_at: string;
};

export type InterviewAgentSession = {
  id: string;
  user_id: string;
  mode: InterviewAgentMode;
  status: "created" | "in_progress" | "completed" | "abandoned";
  target_role: string | null;
  question_count: number;
  total_questions: number;
  overall_score: number | null;
  overall_feedback: string | null;
  improvement_plan: string | null;
  created_at: string;
  updated_at: string;
  messages: InterviewAgentMessage[];
};

export type InterviewAgentSummary = {
  session_id: string;
  mode: InterviewAgentMode;
  overall_score: number;
  overall_feedback: string;
  strengths: string[];
  improvements: string[];
  improvement_plan: string;
  question_count: number;
};

export type InterviewAgentSSEEvent =
  | { type: "user_message"; id: string; session_id: string; role: "user"; content: string; created_at: string }
  | { type: "token"; content: string }
  | { type: "done"; assistant_message: InterviewAgentMessage }
  | { type: "completing"; message: string }
  | { type: "session_completed"; session_id: string; mode: InterviewAgentMode; overall_score: number; overall_feedback: string; strengths: string[]; improvements: string[]; improvement_plan: string; question_count: number }
  | { type: "error"; message: string };

export const interviewAgentApi = {
  createSession: (token: string, body: {
    mode: InterviewAgentMode;
    target_role?: string;
    num_questions?: number;
  }) =>
    clientFetch<InterviewAgentSession>("/api/interview-agent/sessions", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  listSessions: (token: string) =>
    clientFetch<InterviewAgentSession[]>("/api/interview-agent/sessions", {
      headers: authHeaders(token),
    }),

  getSession: (token: string, sessionId: string) =>
    clientFetch<InterviewAgentSession>(`/api/interview-agent/sessions/${sessionId}`, {
      headers: authHeaders(token),
    }),

  deleteSession: (token: string, sessionId: string) =>
    fetch(`${CLIENT_BASE}/api/interview-agent/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  completeSession: (token: string, sessionId: string) =>
    clientFetch<InterviewAgentSummary>(`/api/interview-agent/sessions/${sessionId}/complete`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ force: false }),
    }),

  sendMessageStream: async function* (
    token: string,
    sessionId: string,
    content: string,
  ): AsyncGenerator<InterviewAgentSSEEvent> {
    const res = await fetch(
      `${CLIENT_BASE}/api/interview-agent/sessions/${sessionId}/messages/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw {
        message: errorMessage(body, "Stream request failed"),
        status: res.status,
      } as ApiError;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (!jsonStr) continue;
        try {
          yield JSON.parse(jsonStr) as InterviewAgentSSEEvent;
        } catch {
          /* skip malformed */
        }
      }
    }
  },
};

/* ───── Job application tracker types & API ───── */

export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export type Application = {
  id: string; source: string; source_job_id: string | null; title: string;
  company_name: string | null; city: string | null; source_url: string | null;
  salary_million: number | null; status: ApplicationStatus; applied_at: string | null;
  notes: string | null; created_at: string;
};
export type ApplicationListResp = { applications: Application[]; total: number; page: number; per_page: number };
export type ApplicationStats = { total: number; by_status: Record<ApplicationStatus, number>; applied_this_week: number };
export type TrackedKey = {
  id: string;
  source: string;
  source_job_id: string;
  status: ApplicationStatus;
};
export type CreateApplicationBody =
  | { source: string; source_job_id: string; status?: ApplicationStatus }
  | { title: string; company_name?: string; city?: string; source_url?: string; salary_million?: number; status?: ApplicationStatus; applied_at?: string; notes?: string };

export const applicationsApi = {
  list: (token: string, opts: { status?: string; page?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.status) p.set("status", opts.status);
    if (opts.page) p.set("page", String(opts.page));
    return clientFetch<ApplicationListResp>(`/api/applications?${p.toString()}`, {
      headers: authHeaders(token),
    });
  },

  create: (token: string, body: CreateApplicationBody) =>
    clientFetch<Application>("/api/applications", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  update: (
    token: string,
    id: string,
    patch: { status?: ApplicationStatus; notes?: string; applied_at?: string },
  ) =>
    clientFetch<Application>(`/api/applications/${id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    }),

  remove: async (token: string, id: string): Promise<void> => {
    const res = await fetch(`${CLIENT_BASE}/api/applications/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw { message: errorMessage(body, "Không xóa được"), status: res.status } as ApiError;
    }
  },

  stats: (token: string) =>
    clientFetch<ApplicationStats>("/api/applications/stats", {
      headers: authHeaders(token),
    }),

  keys: (token: string) =>
    clientFetch<TrackedKey[]>("/api/applications/keys", {
      headers: authHeaders(token),
    }),

  aiSummary: (token: string) =>
    clientFetch<{ summary_md: string; generated_at: string }>(
      "/api/applications/ai-summary",
      { method: "POST", headers: authHeaders(token) },
    ),
};

/* ───── Pro Insights types & API (Task 4 — proApi client) ───── */

export type ProHealth = {
  total_jd: number;
  extracted: number;
  missing: number;
  missing_pct: number;
  max_posted_at: string | null;
  max_extracted_at: string | null;
  gap_days: number | null;
  llm: { jd: string; openai: string };
};
export type Health = ProHealth;

export type ProSkillRow = { skill: string; n_jobs: number };
export type ProToolRow = { tool: string; n_jobs: number };
export type ProLanguageRow = { lang: string; level: string | null; n_jobs: number };
export type ProBenefitRow = { benefit: string; n_jobs: number };
export type ProExperienceRow = { bucket: string; n_jobs: number };

export type ProReport = {
  generated_at: string;
  category: string | null;
  city?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  narrative: string;
  tables: {
    skills: ProSkillRow[];
    tools: ProToolRow[];
    languages: ProLanguageRow[];
    benefits: ProBenefitRow[];
    experience: ProExperienceRow[];
  };
  data_note: string;
  missing: number;
  missing_pct: number;
  gap_days: number | null;
};

export type ProJobRaw = {
  source: string;
  source_job_id: string;
  title: string | null;
  company_name: string | null;
  source_url: string | null;
  job_description_text: string;
  job_requirement_text: string;
};

export const proApi = {
  cities: (token: string, signal?: AbortSignal) =>
    clientFetch<string[]>(`/api/pro/cities`, {
      headers: authHeaders(token),
      signal,
    }),

  health: (
    token: string,
    params: { date_from?: string | null; date_to?: string | null } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return clientFetch<ProHealth>(`/api/pro/health${suffix}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  skillsTop: (
    token: string,
    params: { category?: string | null; city?: string | null; limit?: number; date_from?: string | null; date_to?: string | null } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    return clientFetch<ProSkillRow[]>(`/api/pro/skills/top?${q.toString()}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  toolsTop: (
    token: string,
    params: { category?: string | null; city?: string | null; limit?: number; date_from?: string | null; date_to?: string | null } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    return clientFetch<ProToolRow[]>(`/api/pro/tools/top?${q.toString()}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  languagesTop: (
    token: string,
    params: { category?: string | null; city?: string | null; limit?: number; date_from?: string | null; date_to?: string | null } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    return clientFetch<ProLanguageRow[]>(`/api/pro/languages/top?${q.toString()}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  benefitsTop: (
    token: string,
    params: { category?: string | null; city?: string | null; limit?: number; date_from?: string | null; date_to?: string | null } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    return clientFetch<ProBenefitRow[]>(`/api/pro/benefits/top?${q.toString()}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  experience: (
    token: string,
    params: { category?: string | null; city?: string | null; date_from?: string | null; date_to?: string | null } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return clientFetch<ProExperienceRow[]>(`/api/pro/requirements/experience${suffix}`, {
      headers: authHeaders(token),
      signal,
    });
  },

  exportXlsx: async (
    token: string,
    params: { category?: string | null; city?: string | null; title?: string | null; search?: string | null; kind?: string; limit?: number; date_from?: string | null; date_to?: string | null } = {},
  ): Promise<Blob> => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.title) q.set("title", params.title);
    if (params.search) q.set("search", params.search);
    if (params.kind) q.set("kind", params.kind);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    const query = q.toString() ? `?${q.toString()}` : "";
    const res = await fetch(`${CLIENT_BASE}/api/pro/export.xlsx${query}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw { message: errorMessage(body), status: res.status } as ApiError;
    }
    return res.blob();
  },

  report: (token: string, params: { category?: string | null; city?: string | null; date_from?: string | null; date_to?: string | null } = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.city) q.set("city", params.city);
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return clientFetch<ProReport>(`/api/pro/report${suffix}`, {
      method: "POST",
      headers: authHeaders(token),
    });
  },

  jobInsight: (token: string, source: string, sourceJobId: string) =>
    clientFetch<unknown>(`/api/pro/jobs/${encodeURIComponent(source)}/${encodeURIComponent(sourceJobId)}/insight`, {
      headers: authHeaders(token),
    }),

  jobRaw: (token: string, source: string, sourceJobId: string) =>
    clientFetch<ProJobRaw>(`/api/pro/jobs/${encodeURIComponent(source)}/${encodeURIComponent(sourceJobId)}/raw`, {
      headers: authHeaders(token),
    }),
};
