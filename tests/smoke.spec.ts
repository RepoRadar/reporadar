import { test, expect } from "@playwright/test";

// ========================================================================
// Smoke tests for RepoRadar — run against LIVE production at reporadar.io.
// No localhost. Per Christo's "prod only" rule.
// Run: `npm run test:smoke`
// ========================================================================

const BASE = "https://reporadar.io";
const SAMPLE_DEPLOY = "https://anthropics-claude-cookbooks-href.reporadar.io";
const DEPLOY_WORKER = "https://reporadar-deploy.let-s-go-christo.workers.dev";

test.describe("home page", () => {
  test("loads with the right title and key chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RepoRadar/i);
    // The animated LIVE indicator appears in the header. Use a strict
    // locator on the exact string with the leading bullet so we don't match
    // tooltip <title> nodes that contain the substring "alive".
    await expect(page.locator("text=● LIVE")).toBeVisible();
    // The gradient logo text
    await expect(page.locator("h1", { hasText: "RepoRadar" })).toBeVisible();
  });

  test("the 10 quick-scan tag chips are rendered", async ({ page }) => {
    await page.goto("/");
    for (const label of [
      "Hermes",
      "OpenClaw",
      "AG-UI",
      "A2UI",
      "Claude Code",
      "Cloudflare",
      "Generative UI",
      "MCP",
      "LangChain",
      "Gemini",
    ]) {
      await expect(
        page.locator(`button:has-text("${label}")`).first(),
      ).toBeVisible();
    }
  });

  test("the inline white search input is rendered", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator('input[placeholder*="type your own topic" i]'),
    ).toBeVisible();
  });

  test("sort-priority chips are rendered (Stars first, plus the 10 dims)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => {});
    // The "Most Stars" virtual sort priority sits first and is auto-selected
    await expect(
      page.locator('button:has-text("Most Stars")').first(),
    ).toBeVisible({ timeout: 8000 });
    // Each dimension chip uses its phrase-form label
    for (const label of [
      "Trending Momentum",
      "Shipping Velocity",
      "Project Maturity",
      "Community Engagement",
      "Activity Recency",
      "Ease of Prototyping",
      "Production Readiness",
      "Security & Trust",
      "Documentation Quality",
      "Ecosystem Pull",
    ]) {
      await expect(
        page.locator(`button:has-text("${label}")`).first(),
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test("the 3 default sliders + caret expand are rendered", async ({ page }) => {
    await page.goto("/");
    // Tune your radar header
    await expect(page.locator("text=Tune your radar")).toBeVisible();
    // Top-3 slider labels
    for (const label of ["Momentum", "Velocity", "Maturity"]) {
      await expect(page.locator("label", { hasText: label }).first()).toBeVisible();
    }
    // Caret to expand the rest
    await expect(page.locator("text=more dimensions")).toBeVisible();
  });

  test("the InteractiveRadar SVG renders with 10 axis spokes", async ({ page }) => {
    await page.goto("/");
    // Wait briefly for the auto-load + first paint
    await page.waitForTimeout(1500);
    const svg = page.locator("svg").first();
    await expect(svg).toBeVisible();
    // Each draggable vertex handle is a circle with cursor:grab styling
    const circles = svg.locator("circle");
    expect(await circles.count()).toBeGreaterThanOrEqual(10);
  });

  test("auto-loads trending agent repos within 5s", async ({ page }) => {
    await page.goto("/");
    // The empty state has this exact copy; once cards land it's gone
    await page.waitForFunction(
      () => !document.body.textContent?.includes("Repo cards will materialize here"),
      undefined,
      { timeout: 8000 },
    );
    // At least one card with a Deploy button
    expect(
      await page.locator('button:has-text("Deploy")').count(),
    ).toBeGreaterThan(0);
  });
});

test.describe("interactions", () => {
  test("clicking a sort-priority chip adds a priority number badge", async ({ page }) => {
    await page.goto("/");
    // Default priorities = ["stars"] (auto-selected priority 1) so clear
    // first to start from a known state.
    const clear = page.locator('button:has-text("clear")').first();
    if (await clear.isVisible().catch(() => false)) await clear.click();
    // Click "Trending Momentum" in the SORT BY row
    const chip = page
      .locator('button:has-text("Trending Momentum")')
      .first();
    await chip.click();
    // After click, the chip should show a numeric priority badge
    await expect(
      chip.locator("span", { hasText: /^[123]$/ }),
    ).toBeVisible({ timeout: 3000 });
  });

  test("typing in the search box and pressing Enter changes the activity state", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    const input = page.locator('input[placeholder*="type your own topic" i]');
    await input.fill("podcast");
    await input.press("Enter");
    // The status line under the cards should reflect a new query
    await page.waitForTimeout(2500);
    const lastQuery = page.locator("text=/search:|trending:/i").first();
    await expect(lastQuery).toBeVisible();
  });

  test("clicking a card snaps weights (selected border + glow)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    // Pick the first card that has a Deploy button as a stable anchor
    const firstCardDeploy = page.locator('button:has-text("Deploy")').first();
    await expect(firstCardDeploy).toBeVisible();
    // The card is the closest ancestor of the deploy button with role=button
    const card = firstCardDeploy.locator('xpath=ancestor::*[@role="button"][1]');
    await card.click();
    // Selected card carries a primary-glow box-shadow
    await page.waitForTimeout(400);
    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
    expect(shadow.length).toBeGreaterThan(4);
  });
});

test.describe("api", () => {
  test("/api/repos returns a non-empty JSON array", async ({ request }) => {
    const res = await request.get(`${BASE}/api/repos?topic=agent&limit=3`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("fullName");
    expect(data[0]).toHaveProperty("stars");
  });

  test("/api/repos handles freeform keyword via q=", async ({ request }) => {
    const res = await request.get(`${BASE}/api/repos?q=podcast&limit=3`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

test.describe("deploy worker", () => {
  test("/health responds 200 ok", async ({ request }) => {
    const res = await request.get(`${DEPLOY_WORKER}/health`);
    expect(res.ok()).toBe(true);
    const j = await res.json();
    expect(j).toMatchObject({ ok: true });
  });
});

test.describe("deployed surface", () => {
  test("known sample surface renders the agent-generated form", async ({ page }) => {
    const res = await page.goto(SAMPLE_DEPLOY);
    expect(res?.ok()).toBe(true);
    // The banner explicitly mentions the per-deploy D1 backing
    await expect(page.locator("text=interactive D1-backed")).toBeVisible({ timeout: 8000 });
  });

  test("surface.json endpoint returns A2UI JSON for the sample", async ({ request }) => {
    const res = await request.get(`${SAMPLE_DEPLOY}/surface.json`);
    expect(res.ok()).toBe(true);
    const j = await res.json();
    expect(j).toHaveProperty("formFactor");
    expect(j).toHaveProperty("root");
  });

  test("/api/records POST + GET round-trip writes to per-slug D1", async ({ request }) => {
    const ts = Date.now();
    const post = await request.post(`${SAMPLE_DEPLOY}/api/records`, {
      data: { type: "smoketest", data: { title: `smoke ${ts}`, ts } },
    });
    expect(post.ok()).toBe(true);
    const j = await post.json();
    expect(j.ok).toBe(true);
    expect(j.id).toBeTruthy();

    const list = await request.get(`${SAMPLE_DEPLOY}/api/records?type=smoketest&limit=10`);
    expect(list.ok()).toBe(true);
    const lj = await list.json();
    expect(lj.ok).toBe(true);
    const found = (lj.items as Array<{ id: number }>).find((r) => r.id === j.id);
    expect(found).toBeTruthy();

    // Cleanup so the test stays idempotent
    if (j.id) {
      const del = await request.delete(`${SAMPLE_DEPLOY}/api/records/${j.id}`);
      expect(del.ok()).toBe(true);
    }
  });
});
