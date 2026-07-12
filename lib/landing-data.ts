/**
 * Illustrative marketing data for the landing page — the SINGLE source of truth
 * for every number shown on `/`.
 *
 * Keep these values internally consistent (the hero-demo salary figures must sit
 * inside SALARY_MATRIX ranges; the ticker/table derive from SKILL_DEMAND/TOP_PAYING).
 * Do NOT wire the landing to live APIs — this is a deliberate product decision
 * (2026-07-10): the landing renders zero runtime data dependencies.
 *
 * Language-neutral: strings here are tech nouns (skill names) only. All prose,
 * labels, company names and demo questions/answers live in `lib/landing-i18n.ts`.
 */

export const LANDING_STATS = {
  jobsAnalyzed: 12847,
  companies: 1400,
  skillsTracked: 450,
  refreshHours: 24,
} as const;

export const SOURCES = ["VietnamWorks", "ITviec", "LinkedIn"] as const;

export type SkillDemand = { skill: string; jobs: number };

/** In-demand skills by posting count — powers the DataStory bar chart + ticker. */
export const SKILL_DEMAND: readonly SkillDemand[] = [
  { skill: "Python", jobs: 2140 },
  { skill: "JavaScript", jobs: 1980 },
  { skill: "Java", jobs: 1720 },
  { skill: "React", jobs: 1540 },
  { skill: "SQL", jobs: 1480 },
  { skill: "NodeJS", jobs: 1120 },
  { skill: "AWS", jobs: 980 },
  { skill: "Docker", jobs: 860 },
];

export type TopPaying = { skill: string; avgTr: number; jobs: number; yoy?: number };

/** Highest-paying skills (median monthly VND, millions) — DataStory table + ticker. */
export const TOP_PAYING: readonly TopPaying[] = [
  { skill: "Golang", avgTr: 52, jobs: 320 },
  { skill: "AI/LLM", avgTr: 50, jobs: 280, yoy: 34 },
  { skill: "Kubernetes", avgTr: 48, jobs: 410 },
  { skill: "System Design", avgTr: 47, jobs: 260 },
  { skill: "AWS", avgTr: 45, jobs: 980 },
  { skill: "React Native", avgTr: 40, jobs: 350 },
];

export type Level = "intern" | "fresher" | "junior" | "middle" | "senior";
export type City = "hcm" | "hanoi" | "danang";
/** [p25, p50 (median), p75] in millions VND / month. */
export type SalaryRange = readonly [p25: number, p50: number, p75: number];

export const LEVELS: readonly Level[] = ["intern", "fresher", "junior", "middle", "senior"];
export const CITIES: readonly City[] = ["hcm", "hanoi", "danang"];

/** Canonical salary matrix — every landing salary figure must trace back here. */
export const SALARY_MATRIX: Record<Level, Record<City, SalaryRange>> = {
  intern: { hcm: [3, 5, 8], hanoi: [3, 5, 7], danang: [3, 4, 6] },
  fresher: { hcm: [8, 11, 14], hanoi: [8, 10, 13], danang: [7, 9, 12] },
  junior: { hcm: [14, 18, 23], hanoi: [13, 17, 22], danang: [12, 15, 19] },
  middle: { hcm: [22, 28, 35], hanoi: [21, 27, 33], danang: [18, 24, 30] },
  senior: { hcm: [35, 45, 60], hanoi: [33, 43, 56], danang: [28, 38, 48] },
};

/** Max p75 across the matrix — used to scale the SalaryExplorer range bar. */
export const SALARY_MAX = 60;

export type DemoScenarioId = "salary-de" | "ai-switch" | "fresher-deal";

export type DemoChart =
  | { kind: "range"; range: SalaryRange; sampleJobs: number }
  | { kind: "bars"; bars: readonly { label: string; value: number }[] };

export type DemoScenario = { id: DemoScenarioId; chart: DemoChart };

/**
 * Hero AI-demo scenarios. Strings (question/answer) live in i18n keyed by `id`;
 * chart numbers live here. `salary-de` range (22–30, median 26) sits inside the
 * Junior→Middle HCM band; `fresher-deal` (8–14, median 11) equals Fresher HCM.
 */
export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  { id: "salary-de", chart: { kind: "range", range: [22, 26, 30], sampleJobs: 1240 } },
  {
    id: "ai-switch",
    chart: {
      kind: "bars",
      bars: [
        { label: "LLM / RAG", value: 88 },
        { label: "PyTorch", value: 72 },
        { label: "Vector DB", value: 60 },
      ],
    },
  },
  { id: "fresher-deal", chart: { kind: "range", range: [8, 11, 14], sampleJobs: 640 } },
];

export type MockAlertKey = "fintech" | "startup" | "saas";

/** Source platform each alert was aggregated from — the "multi-source" signal. */
export type AlertSource = "VietnamWorks" | "ITviec" | "LinkedIn";

export type MockAlert = {
  key: MockAlertKey;
  source: AlertSource;
  salaryTr: readonly [number, number];
  match: number;
  skills: readonly string[];
};

/**
 * Fake alert cards for the AlertShowcase phone mock. Company/title strings are
 * generic-but-plausible and live in i18n (keyed by `key`) — NO real brand names,
 * to avoid implying a real endorsement.
 */
export const MOCK_ALERTS: readonly MockAlert[] = [
  { key: "fintech", source: "LinkedIn", salaryTr: [30, 45], match: 95, skills: ["React", "TypeScript", "AWS"] },
  { key: "startup", source: "ITviec", salaryTr: [22, 32], match: 88, skills: ["Python", "PyTorch", "LLM"] },
  { key: "saas", source: "VietnamWorks", salaryTr: [25, 40], match: 82, skills: ["Docker", "K8s", "Go"] },
];

export type TrackedStatus = "applied" | "interviewing" | "offer";

export type TrackedApp = {
  company: string;
  role: string;
  status: TrackedStatus;
  needsFollowUp?: boolean;
};

/**
 * Demo snapshot of a user's application board — powers the hero "AI job manager"
 * showcase and the large Bento tile. Company names are generic (no real brands).
 * The hero AI-insight line is DERIVED from these rows (counts must match).
 */
export const DEMO_TRACKED_APPS: readonly TrackedApp[] = [
  { company: "Fintech Q1", role: "Senior React Developer", status: "interviewing" },
  { company: "Product Startup", role: "AI/ML Engineer", status: "applied", needsFollowUp: true },
  { company: "Global SaaS", role: "DevOps Engineer", status: "applied", needsFollowUp: true },
  { company: "E-commerce Co.", role: "Backend Engineer", status: "offer" },
];
