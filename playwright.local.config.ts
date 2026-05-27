import { defineConfig, devices } from "@playwright/test";

// ========================================================================
// LOCAL e2e config — for features not yet on production.
//
// The default playwright.config.ts is prod-only (reporadar.io) per Christo's
// "prod only" smoke rule. That suite can't validate an undeployed feature, so
// this config runs the shareable-URL spec and the alerts-panel spec against a
// local dev server instead. AGENTS.md explicitly sanctions local dev-server
// browser checks for UI work.
//
//   npx playwright test -c playwright.local.config.ts
//   npx playwright test tests/alerts-panel.spec.ts -c playwright.local.config.ts
//
// After features ship, share-url.spec.ts (relative gotos) also runs against
// prod via the normal `npm run test:smoke`.
// ========================================================================

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: /(share-url|alerts-panel)\.spec\.ts/,
  fullyParallel: false,
  retries: 1,
  // Per-test budget must exceed navigationTimeout below: the home route SSR-
  // prefetches from GitHub (uncached, and `window=all` is a heavier all-time
  // query), which on a local box can be slow. Default 30s would cut off a slow
  // goto before navigation even times out.
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    actionTimeout: 15000,
    // Generous: the home route SSR-prefetches from GitHub, which can be slow
    // under anon rate-limiting on a local box without a GITHUB_TOKEN. Prod has
    // a token (5000/hr) so this never bites real users.
    navigationTimeout: 75000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
