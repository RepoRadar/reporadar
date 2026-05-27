import { defineConfig } from "@playwright/test";

// Smoke tests run against the LIVE production site on reporadar.io —
// not localhost. Christo's standing rule: prod only.
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  // notifications.spec.ts + feedback.spec.ts target localhost:3000 (they default
  // to a local dev server and mock /api/repos), so they can't run against prod —
  // exclude them here. Run those against a dev server, e.g.
  // `npx playwright test tests/feedback.spec.ts` with `npm run dev` up.
  testIgnore: [/notifications\.spec\.ts/, /feedback\.spec\.ts/],
  fullyParallel: true,
  // Cap concurrency: the prod home route does a per-isolate GitHub SSR prefetch,
  // so a wide parallel blast overloads cold isolates / the API rate limit and
  // flakes data-dependent tests. 2 workers keeps it reliable; retries absorb
  // the occasional slow GitHub response.
  workers: 2,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "https://reporadar.io",
    trace: "on-first-retry",
    video: "off",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
