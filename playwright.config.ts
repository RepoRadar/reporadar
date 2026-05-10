import { defineConfig } from "@playwright/test";

// Smoke tests run against the LIVE production site on reporadar.io —
// not localhost. Christo's standing rule: prod only.
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
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
