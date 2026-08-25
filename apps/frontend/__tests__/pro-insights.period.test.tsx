/**
 * Task 4 — Period TZ Fix + City Dynamic (audit C2/C3 P2)
 * Failing test before fix: ProInsightsClient lacks VN_TZ + dynamic cities → FAIL.
 * After fix: uses getVNNow with Asia/Ho_Chi_Minh and dynamicCities merged from API → PASS.
 */
import * as fs from "fs";
import * as path from "path";

describe("pro-insights period TZ (audit C2/C3 P2)", () => {
  const clientPath = path.join(__dirname, "../app/pro-insights/ProInsightsClient.tsx");
  const apiPath = path.join(__dirname, "../lib/api.ts");
  const proBackendPath = path.join(__dirname, "../../backend/app/api/pro.py");

  const clientCode = fs.readFileSync(clientPath, "utf8");
  const apiCode = fs.readFileSync(apiPath, "utf8");
  const backendCode = fs.existsSync(proBackendPath) ? fs.readFileSync(proBackendPath, "utf8") : "";

  test("getPeriodDates uses VN_TZ Asia/Ho_Chi_Minh via getVNNow", () => {
    // Must contain VN TZ marker — brief: Use UTC+7 or toLocaleString tz
    expect(clientCode).toContain("Asia/Ho_Chi_Minh");
    expect(clientCode).toMatch(/getVNNow/);
    expect(clientCode).toMatch(/toLocaleString\s*\(\s*["']en-US["']\s*,\s*\{\s*timeZone\s*:\s*["']Asia\/Ho_Chi_Minh["']/);
    // getPeriodDates must delegate to getVNNow instead of raw new Date()
    // Allow export function getVNNow and exported getPeriodDates
    expect(clientCode).toMatch(/function getVNNow\s*\(/);
    // Ensure getPeriodDates body calls getVNNow (not just `new Date()` alone for now)
    // Find getPeriodDates definition and check it contains getVNNow
    const periodFnMatch = clientCode.match(/function getPeriodDates[\s\S]{0,500}getVNNow/);
    expect(periodFnMatch).not.toBeNull();
    // Also ensure formatLocal or date math still present
    expect(clientCode).toContain("formatLocal");
  });

  test("getPeriodDates week is VN Monday (functional)", async () => {
    // This test verifies functional correctness when VN date is Monday 2026-08-24 01:00 +07
    // which is Sunday 2026-08-23 18:00 UTC. A browser-TZ (UTC) implementation would
    // incorrectly return Monday 2026-08-17, while VN_TZ correctly returns 2026-08-24.
    // We also test the Tue 2026-08-25 case from the brief.

    // Import after fix: getPeriodDates should be exported. Before fix, this will throw or be undefined → FAIL.
    let mod: any;
    try {
      mod = await import("../app/pro-insights/ProInsightsClient");
    } catch (e) {
      // Before fix, module may not export getPeriodDates → force failure with clear message
      throw new Error("ProInsightsClient does not export getPeriodDates — expected after Task 4 fix. " + String(e));
    }
    const getPeriodDates = mod.getPeriodDates || mod.default?.getPeriodDates;
    if (typeof getPeriodDates !== "function") {
      throw new Error("getPeriodDates not exported from ProInsightsClient.tsx — Task 4 requires export function getPeriodDates");
    }

    // Helper to set system time and test
    const realDate = Date;
    // Mock to VN Monday 01:00 (UTC Sun 18:00) — Mondays diverge
    jest.useFakeTimers();
    try {
      // Case 1: VN Monday boundary — expect week Monday 2026-08-24
      jest.setSystemTime(new Date("2026-08-23T18:00:00.000Z"));
      const r1 = getPeriodDates("week");
      // Correct VN behavior: Monday 2026-08-24, Sunday 2026-08-30
      expect(r1.dateFrom).toBe("2026-08-24");
      expect(r1.dateTo).toBe("2026-08-30");

      // Case 2: Brief's Tue 2026-08-25 — expect Monday 2026-08-24 (same week)
      jest.setSystemTime(new Date("2026-08-24T19:00:00.000Z")); // VN Tue 2026-08-25 02:00
      const r2 = getPeriodDates("week");
      expect(r2.dateFrom).toBe("2026-08-24");

      // Case 3: Brief's Tue + functional: month should be VN month
      jest.setSystemTime(new Date("2026-08-24T19:00:00.000Z")); // VN Tue 25 Aug
      const r3 = getPeriodDates("month");
      expect(r3.dateFrom).toBe("2026-08-01");
      expect(r3.dateTo).toBe("2026-08-31");

      // Case 4: all period returns empty
      const r4 = getPeriodDates("all");
      expect(r4.dateFrom).toBe("");
      expect(r4.dateTo).toBe("");
    } finally {
      jest.useRealTimers();
    }
  });

  test("CITIES comes from API (dynamic, not hardcode only)", () => {
    // Before fix: ProInsightsClient renders `CITIES.map` directly with 7 hardcoded entries and no fetch.
    // After fix: must have dynamicCities state and merge from API (dashboardApi or proApi) with fallback.

    // Must keep fallback constant (either CITIES or FALLBACK_CITIES) but also have dynamic state
    expect(clientCode).toMatch(/const CITIES\s*=\s*\[/);
    expect(clientCode).toMatch(/dynamicCities/);
    expect(clientCode).toMatch(/useState<string\[\]>\(CITIES\)|useState\(CITIES\)/);
    // Must fetch cities via API — either dashboardApi.dashboardCities / dashboardApi.cities or proApi.cities
    const usesDashboardCities = /dashboardApi\.(dashboardCities|cities)/.test(clientCode);
    const usesProCities = /proApi\.cities/.test(clientCode);
    expect(usesDashboardCities || usesProCities).toBe(true);
    // Must have useEffect that updates dynamicCities
    expect(clientCode).toMatch(/useEffect[\s\S]*?setDynamicCities/);
    // Render must use dynamicCities, not just CITIES
    expect(clientCode).toMatch(/dynamicCities\.map/);
    // Should NOT render solely CITIES after fix — but we check dynamic is primary
    // At least one occurrence of dynamicCities in JSX
    expect((clientCode.match(/dynamicCities\.map/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  test("backend provides GET /api/pro/cities or frontend merges dashboard cities", () => {
    // Brief says: add GET /api/pro/cities that returns distinct city_canonical (optional), OR merge dashboardApi cities.
    // Audit requires at least one path to be dynamic. Before fix, neither exists → FAIL.
    // After fix, at least one of:
    //  - backend has `/cities` route with city_canonical
    //  - frontend fetches via dashboardApi
    //  - frontend fetches via proApi.cities
    const hasBackendCities =
      backendCode.includes('"/cities"') || backendCode.includes("'/cities'") || backendCode.includes("/cities") && backendCode.includes("city_canonical");
    const hasFrontendDashboard = /dashboardApi\.(dashboardCities|cities)/.test(clientCode);
    const hasFrontendPro = /proApi\.cities/.test(apiCode) || /proApi\.cities/.test(clientCode);

    // Must have at least frontend dynamic (brief's simpler fix) OR backend endpoint
    expect(hasFrontendDashboard || hasFrontendPro || hasBackendCities).toBe(true);

    // If backend exists, it should query distinct city_canonical from jd_insight or gold
    if (hasBackendCities) {
      expect(backendCode).toContain("city_canonical");
      // Should be pro router and require_pro-ish protection (similar to other endpoints)
      expect(backendCode).toMatch(/@router\.get\(".*cities.*"/);
    }

    // api.ts must expose proApi.cities if backend exists (so frontend can call it)
    if (hasBackendCities) {
      // Check proApi has cities method
      expect(apiCode).toMatch(/cities\s*:\s*\(token/);
    }
  });
});
