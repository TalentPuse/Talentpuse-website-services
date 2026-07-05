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

async function captureWidth({ chromium, targetUrl, outDir, width }) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    try {
      await page.goto(targetUrl, { waitUntil: "networkidle" });
    } catch (navigationError) {
      throw new Error(
        `Navigation to ${targetUrl} failed at width=${width}: ${navigationError.message}`
      );
    }

    await page.waitForTimeout(SETTLE_DELAY_MS);

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
