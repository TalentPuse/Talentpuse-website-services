#!/usr/bin/env node
/**
 * shot.mjs — quick full-page responsive screenshot tool for UI audits.
 *
 * Usage:
 *   node tools/shot.mjs <path> <name> [baseUrl]
 *
 * Example:
 *   node tools/shot.mjs /jobs jobs-page
 *   node tools/shot.mjs /admin/alerts admin-alerts http://localhost:3000
 *
 * For each width in [375, 768, 1440], opens `${baseUrl}${path}` in a
 * Chromium viewport of width×900 (deviceScaleFactor 1), waits for the
 * page to settle, and writes a full-page PNG to:
 *   docs/ui-audit/<name>/<width>.png
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const WIDTHS = [375, 768, 1440];
const VIEWPORT_HEIGHT = 900;
const SETTLE_DELAY_MS = 800;
const DEFAULT_BASE_URL = "http://localhost:8002";

function printUsageAndExit() {
  console.error("Usage: node tools/shot.mjs <path> <name> [baseUrl]");
  console.error('Example: node tools/shot.mjs /jobs jobs-page');
  process.exit(1);
}

async function loadChromium() {
  try {
    const playwright = await import("playwright");
    return playwright.chromium;
  } catch (playwrightError) {
    try {
      const playwrightTest = await import("@playwright/test");
      return playwrightTest.chromium;
    } catch (playwrightTestError) {
      console.error("[shot.mjs] Could not find a Playwright installation.");
      console.error("[shot.mjs] Tried: playwright, @playwright/test");
      console.error("[shot.mjs] Install one of them, then install the browser binary:");
      console.error("[shot.mjs]   npm i -D playwright && npx playwright install chromium");
      process.exit(1);
    }
  }
}

async function revealByScrolling(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.round(window.innerHeight * 0.8);
    let y = 0;
    const maxY = () => document.body.scrollHeight;
    // Step down until the bottom, pausing so IntersectionObserver fires.
    while (y < maxY()) {
      window.scrollTo(0, y);
      await sleep(120);
      y += step;
    }
    window.scrollTo(0, maxY());
    await sleep(250);
    window.scrollTo(0, 0);
    await sleep(250);
  });
  // Let the last reveal transitions settle before capture.
  await page.waitForTimeout(500);
}

async function captureWidth({ chromium, targetUrl, outDir, width }) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: 1,
    });

    // Optional: inject an auth token so ProtectedRoute-gated pages render
    // logged-in. Set SHOT_TOKEN to a valid JWT; it is written to
    // localStorage under the app's key before any page script runs.
    const authToken = process.env.SHOT_TOKEN;
    if (authToken) {
      await context.addInitScript((t) => {
        try {
          window.localStorage.setItem("tp_token", t);
        } catch {
          /* storage unavailable — ignore */
        }
      }, authToken);
    }

    const page = await context.newPage();

    try {
      await page.goto(targetUrl, { waitUntil: "networkidle" });
    } catch (navigationError) {
      throw new Error(
        `Navigation to ${targetUrl} failed at width=${width}: ${navigationError.message}`
      );
    }

    await page.waitForTimeout(SETTLE_DELAY_MS);

    // Trigger scroll-reveal animations (framer-motion `whileInView`,
    // IntersectionObserver): step-scroll to the bottom so every section
    // enters the viewport at least once (reveals are `once: true`, so they
    // stay shown), then return to the top before the full-page capture.
    await revealByScrolling(page);

    const outFile = path.join(outDir, `${width}.png`);
    await page.screenshot({ path: outFile, fullPage: true });
    console.log(`[shot.mjs] Saved ${outFile}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const [, , rawPath, name, baseUrlArg] = process.argv;

  if (!rawPath || !name) {
    printUsageAndExit();
  }

  const baseUrl = baseUrlArg || DEFAULT_BASE_URL;
  const urlPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const targetUrl = `${baseUrl}${urlPath}`;

  const outDir = path.join(process.cwd(), "docs", "ui-audit", name);
  await mkdir(outDir, { recursive: true });

  const chromium = await loadChromium();

  for (const width of WIDTHS) {
    try {
      await captureWidth({ chromium, targetUrl, outDir, width });
    } catch (error) {
      console.error(`[shot.mjs] ERROR: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`[shot.mjs] Done. Screenshots written to ${outDir}`);
}

main().catch((error) => {
  console.error(`[shot.mjs] Unexpected error: ${error.message}`);
  process.exit(1);
});
