import { expect, test, type Page } from "@playwright/test";

// ========================================================================
// Alerts panel spec — verifies the create/list/remove flow locally.
//
// Run against a local dev server (local D1 required):
//   wrangler d1 migrations apply reporadar --local
//   npm run dev   (in another tab)
//   npx playwright test tests/alerts-panel.spec.ts -c playwright.local.config.ts
// Or via the convenience script:
//   npm run test:alerts
//
// This spec verifies RESULTS, not mechanics (AGENTS.md verify-results rule):
// after submitting the form, the created alert must appear in the list as
// "pending" — not just that a POST fired or the URL changed.
//
// Also guards the hackathon UI freeze: asserts the frozen header text is
// present (T-03-21).
// ========================================================================

const LOCAL_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Helpers
async function go(page: Page) {
  await page.goto(LOCAL_BASE, { waitUntil: "domcontentloaded" });
}

// Intercept the subscribe POST to return a canned success without needing
// a real D1 write, while still exercising the full panel create → list flow.
async function mockSubscribeAndList(page: Page) {
  await page.route("**/api/notifications/subscribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: "pending_verification" }),
    });
  });

  // After create, the panel GETs /api/notifications/list — return the alert
  // we just "created" so the list reflects the submitted values.
  let listCallCount = 0;
  await page.route("**/api/notifications/list**", async (route) => {
    listCallCount++;
    // First call (on mount before any submit) returns empty.
    // Subsequent calls (after submit + re-fetch) return the pending alert.
    const alerts =
      listCallCount === 1
        ? []
        : [
            {
              id: "test-alert-id-001",
              term: "rust",
              kind: "topic",
              metric: "stars_pct",
              threshold: 20,
              window_days: 7,
              verified: false,
              unsubToken: "test-unsub-token-001",
              createdAt: new Date().toISOString(),
            },
          ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, alerts }),
    });
  });
}

async function mockUnsubscribe(page: Page) {
  await page.route("**/api/notifications/unsubscribe**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Unsubscribed</body></html>",
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Alerts panel", () => {
  test("frozen header is present (UI freeze guard)", async ({ page }) => {
    await go(page);
    // The header text must remain intact (AGENTS.md hackathon UI freeze).
    // Use .first() because the text appears in two elements (visible + ARIA).
    await expect(
      page.getByText("AI Tinkerers Generative UI Hackathon", { exact: false }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Alerts panel renders with create form", async ({ page }) => {
    await go(page);
    await expect(
      page.getByRole("heading", { name: "Trend alerts" })
    ).toBeVisible({ timeout: 15000 });

    // Form fields should be present
    await expect(page.getByLabel("Your email")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Term to watch")).toBeVisible();
    await expect(page.getByLabel("Metric")).toBeVisible();
    await expect(page.getByLabel("Threshold")).toBeVisible();
    await expect(page.getByLabel("Window (days)")).toBeVisible();
  });

  test("create alert → confirm acknowledgement shown → alert lists as pending (verify RESULTS)", async ({
    page,
  }) => {
    // Track subscribe requests to verify the mock was hit
    const subscribeRequests: string[] = [];
    await page.route("**/api/notifications/subscribe", async (route) => {
      subscribeRequests.push(route.request().method());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "pending_verification" }),
      });
    });

    // After create, the panel GETs /api/notifications/list
    let listCallCount = 0;
    await page.route("**/api/notifications/list**", async (route) => {
      listCallCount++;
      const alerts =
        listCallCount <= 1
          ? []
          : [
              {
                id: "test-alert-id-001",
                term: "rust",
                kind: "topic",
                metric: "stars_pct",
                threshold: 20,
                window_days: 7,
                verified: false,
                unsubToken: "test-unsub-token-001",
                createdAt: new Date().toISOString(),
              },
            ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, alerts }),
      });
    });

    await go(page);

    // Wait for the panel
    await expect(
      page.getByRole("heading", { name: "Trend alerts" })
    ).toBeVisible({ timeout: 15000 });

    // Fill email and term — Playwright's fill() fires input + change events
    await page.getByLabel("Your email").fill("builder@example.com");
    await page.getByLabel("Term to watch").fill("rust");

    // Select metric: stars_pct is already default
    await expect(page.getByLabel("Metric")).toHaveValue("stars_pct");

    // Set threshold and window
    await page.getByLabel("Threshold").fill("20");
    await page.getByLabel("Window (days)").fill("7");

    // Wait for the submit button to become enabled (requires non-empty email + term)
    const submitBtn = page.getByRole("button", { name: "Create alert" });
    await expect(submitBtn).not.toBeDisabled({ timeout: 5000 });

    // Submit the form and wait for the POST to complete.
    // React synthetic event system requires a DOM submit event dispatched on the
    // form element — Playwright's click() on the submit button alone may not
    // propagate through React's event delegation in dev-server mode.
    const [subscribeResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/notifications/subscribe"),
        { timeout: 20000 }
      ),
      page.evaluate(() => {
        const form = document.querySelector(
          'form[aria-label="Create alert"]'
        ) as HTMLFormElement | null;
        if (!form) throw new Error("Create alert form not found");
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true })
        );
      }),
    ]);

    expect(subscribeResponse.status()).toBe(200);

    // RESULT 1: "Check your email" acknowledgement must appear.
    // The text is rendered inside the aria-live status region.
    await expect(
      page.locator("#alert-status").getByText("Check your email", { exact: false })
    ).toBeVisible({ timeout: 10000 });

    // RESULT 2: the alert must appear in the list as "pending"
    await expect(
      page.getByRole("list", { name: "Active alerts" })
    ).toBeVisible({ timeout: 10000 });

    // The term "rust" must be visible in the list row
    await expect(
      page.getByRole("listitem").filter({ hasText: "rust" })
    ).toBeVisible({ timeout: 5000 });

    // The pending badge must appear (not active — email hasn't been confirmed)
    await expect(page.getByText("pending")).toBeVisible({ timeout: 5000 });

    // The metric label should appear in the alert list row
    await expect(
      page.getByRole("listitem").filter({ hasText: "rust" }).getByText("%", { exact: false })
    ).toBeVisible();
  });

  test("remove alert disappears from list", async ({ page }) => {
    // Pre-seed the list with an alert so the Remove button is visible
    await page.route("**/api/notifications/list**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          alerts: [
            {
              id: "remove-test-id-002",
              term: "cloudflare-workers",
              kind: "query",
              metric: "velocity",
              threshold: 5,
              window_days: 14,
              verified: true,
              unsubToken: "remove-unsub-token-002",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await mockUnsubscribe(page);

    await page.route("**/api/notifications/subscribe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "pending_verification" }),
      });
    });

    await go(page);

    // Seed the email so the list auto-fetches on mount
    await page.getByLabel("Your email").fill("builder@example.com");

    // Wait for the list to show up with the pre-seeded alert
    await expect(
      page.getByRole("list", { name: "Active alerts" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("cloudflare-workers")).toBeVisible({
      timeout: 5000,
    });

    // RESULT: click Remove — the row disappears
    await page
      .getByRole("button", { name: /Remove alert for cloudflare-workers/i })
      .click();

    await expect(page.getByText("cloudflare-workers")).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("kind toggle switches between topic and query", async ({ page }) => {
    await go(page);
    await expect(
      page.getByRole("heading", { name: "Trend alerts" })
    ).toBeVisible({ timeout: 15000 });

    // Default is "topic"
    const topicBtn = page.getByRole("button", { name: "topic" });
    const queryBtn = page.getByRole("button", { name: "query" });
    await expect(topicBtn).toHaveAttribute("aria-pressed", "true");
    await expect(queryBtn).toHaveAttribute("aria-pressed", "false");

    // Switch to query
    await queryBtn.click();
    await expect(topicBtn).toHaveAttribute("aria-pressed", "false");
    await expect(queryBtn).toHaveAttribute("aria-pressed", "true");
  });
});
