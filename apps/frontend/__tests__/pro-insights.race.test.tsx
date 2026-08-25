/**
 * Task 3 — AbortController race fix (audit C6 P1)
 * Failing test before fix: grep -c AbortController → 0, this suite FAILS.
 * After fix: count → >=1 and signal passthrough present → PASS.
 */
import * as fs from "fs";
import * as path from "path";

describe("pro-insights race condition (audit C6 P1)", () => {
  const clientPath = path.join(__dirname, "../app/pro-insights/ProInsightsClient.tsx");
  const apiPath = path.join(__dirname, "../lib/api.ts");

  const clientCode = fs.readFileSync(clientPath, "utf8");
  const apiCode = fs.readFileSync(apiPath, "utf8");

  test("ProInsightsClient uses AbortController to cancel stale fetches", () => {
    // Primary guard — the brief's Step 2 checks grep -c AbortController → 0 before fix
    expect(clientCode).toContain("AbortController");
    expect(clientCode).toContain("abortRef");
    expect(clientCode).toMatch(/useRef<AbortController/);
    expect(clientCode).toContain("abortRef.current?.abort()");
    // New AbortController created per fetchAll invocation
    expect(clientCode).toContain("new AbortController()");
  });

  test("fetchAll skips setState if aborted and handles AbortError", () => {
    expect(clientCode).toContain("signal.aborted");
    expect(clientCode).toContain("AbortError");
    // Guard before applying results
    expect(clientCode).toMatch(/if \(ac\.signal\.aborted\) return/);
    // Guard in finally for loading — must not clear loading if aborted (or check !aborted)
    expect(clientCode).toMatch(/if \(!ac\.signal\.aborted\) setLoading\(false\)/);
  });

  test("unmount cleanup aborts in-flight request", () => {
    // useEffect cleanup: return () => abortRef.current?.abort()
    expect(clientCode).toMatch(/return \(\) => abortRef\.current\?\.abort\(\)/);
  });

  test("proApi methods accept AbortSignal and forward to clientFetch", () => {
    // Each pro endpoint must accept optional signal (brief: extend proApi to accept signal param)
    expect(apiCode).toMatch(/skillsTop[\s\S]*?signal\?: AbortSignal/);
    expect(apiCode).toMatch(/toolsTop[\s\S]*?signal\?: AbortSignal/);
    expect(apiCode).toMatch(/languagesTop[\s\S]*?signal\?: AbortSignal/);
    expect(apiCode).toMatch(/benefitsTop[\s\S]*?signal\?: AbortSignal/);
    expect(apiCode).toMatch(/experience[\s\S]*?signal\?: AbortSignal/);
    expect(apiCode).toMatch(/health[\s\S]*?signal\?: AbortSignal/);
    // Forwarded as RequestInit.signal in clientFetch call
    // At least one occurrence of `signal` being passed/comma — ensures wiring not just type
    expect(apiCode).toMatch(/signal,/);
    // Also check that health forwards signal (the 6th call in fetchAll's health chase)
    expect(apiCode).toMatch(/headers: authHeaders\(token\)[\s\S]*?signal/);
  });

  test("rapid filter change does not show stale data (signal passed to proApi calls)", () => {
    // fetchAll must pass ac.signal into proApi calls — either as object prop `signal: ac.signal`
    // or as separate argument `, ac.signal` (both satisfy brief: extend proApi to accept signal)
    expect(clientCode).toContain("ac.signal");
    const hasSignalProp = /signal:\s*ac\.signal/.test(clientCode);
    const hasSignalArg = /proApi\.\w+\(token[\s\S]*?ac\.signal/.test(clientCode);
    expect(hasSignalProp || hasSignalArg).toBe(true);
  });
});
