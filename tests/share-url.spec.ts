import { test, expect, type Page } from "@playwright/test";

// ========================================================================
// Shareable search URLs — the dashboard mirrors its current search (topics,
// freeform ask, sort filters, time window) into the address bar so a view is
// copy-pasteable, and opening a shared URL reproduces that view.
//
// Relative gotos (baseURL) so this runs locally against a dev server NOW
// (`npx playwright test -c playwright.local.config.ts`) and against prod after
// deploy (`npm run test:smoke`). Feature lives in app/lib/shareUrl.ts +
// app/page.tsx (SSR hydration) + app/components/RepoRadarApp.tsx (URL sync).
// ========================================================================

// Stable selectors (verified against the running app):
const TAGS = 'button[aria-controls="panel-tags"]';
const TYPE = 'button[aria-controls="panel-type"]';
const FILTER = 'button[aria-controls="panel-filter"]';
const LOGO = 'button[aria-label="RepoRadar home"]';
const TYPE_INPUT = 'input[type="text"]';

// The feature is client-side hydration; we don't need the full `load` event
// (all subresources), which can hang under GitHub anon rate-limiting. DOM-ready
// + the polling assertions below are enough and far less flaky.
async function go(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

// The address bar updates from a React effect, so poll rather than read once.
async function expectSearch(page: Page, expected: string) {
  await expect.poll(() => new URL(page.url()).search, { timeout: 6000 }).toBe(expected);
}

// Sub-label baked into the TAGS / FILTER control buttons (e.g. "TAGScloudflare",
// "FILTER2/3"), which reflects active topics / sort-priority count.
async function controlText(page: Page, selector: string): Promise<string> {
  return (await page.locator(selector).textContent())?.trim() ?? "";
}

test.describe("shareable search URLs", () => {
  test("default home view has a clean URL (no params)", async ({ page }) => {
    await go(page, "/");
    await expectSearch(page, "");
    expect(await controlText(page, TAGS)).toContain("hermes");
  });

  test("topic search writes ?topic, and multiple topics comma-join", async ({ page }) => {
    await go(page, "/");
    await page.click(TAGS);
    // Default active topic is hermes; clicking Cloudflare combines them.
    await page.locator('button:text-is("Cloudflare")').click();
    await expectSearch(page, "?topic=hermes,cloudflare");
    // Comma stays literal (not %2C) for readable shared links.
    expect(page.url()).toContain("topic=hermes,cloudflare");
    // Toggling a topic off updates the URL.
    await page.locator('button:text-is("Hermes")').click();
    await expectSearch(page, "?topic=cloudflare");
  });

  test("freeform ask writes ?q and replaces any topic", async ({ page }) => {
    await go(page, "/");
    await page.click(TYPE);
    await page.locator(TYPE_INPUT).fill("rust web frameworks");
    await page.locator(TYPE_INPUT).press("Enter");
    await expectSearch(page, "?q=rust+web+frameworks");
    // Mutually exclusive: a freeform ask carries no topic param.
    expect(page.url()).not.toContain("topic=");
  });

  test("sort filters write ?sort in click order; default Stars is omitted", async ({ page }) => {
    await go(page, "/");
    await page.click(FILTER);
    // Default priorities = ["stars"] (omitted from URL). Adding Velocity appends.
    await page.locator('#panel-filter button:has-text("Shipping Velocity")').click();
    await expectSearch(page, "?sort=stars,velocity");
    expect(await controlText(page, FILTER)).toContain("2/3");
  });

  test("time window writes ?window; default 1y is omitted", async ({ page }) => {
    await go(page, "/");
    await page.locator('button:text-is("All")').click();
    await expectSearch(page, "?window=all");
    // Back to the default window drops the param.
    await page.locator('button:text-is("1y")').click();
    await expectSearch(page, "");
  });

  test("topic + sort + window compose into one URL", async ({ page }) => {
    await go(page, "/");
    await page.click(TAGS);
    await page.locator('button:text-is("Cloudflare")').click();
    await page.locator('button:text-is("Hermes")').click(); // drop default hermes
    await page.click(FILTER);
    await page.locator('#panel-filter button:has-text("Shipping Velocity")').click();
    await page.locator('button:text-is("All")').click();
    await expectSearch(page, "?topic=cloudflare&sort=stars,velocity&window=all");
  });

  test("opening a shared URL reproduces the view with SSR cards and no errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

    await go(page, "/?topic=cloudflare&sort=stars,velocity&window=all");

    // Controls reflect the URL.
    expect(await controlText(page, TAGS)).toContain("cloudflare");
    expect(await controlText(page, FILTER)).toContain("2/3");
    // "All" window button is the active one (secondary-blue border).
    const allBorder = await page
      .locator('button:text-is("All")')
      .evaluate((el) => getComputedStyle(el).borderColor);
    expect(allBorder).toBe("rgb(59, 130, 246)");

    // Cards arrive in the first paint (SSR-prefetched the shared topic).
    await expect(page.locator('button:has-text("Deploy")').first()).toBeVisible({ timeout: 10000 });

    // Idempotent: hydrating from the URL does not rewrite/clobber it.
    await expectSearch(page, "?topic=cloudflare&sort=stars,velocity&window=all");

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("malformed ?sort self-heals: invalid dropped, capped at 3", async ({ page }) => {
    await go(page, "/?sort=bogus,stars,velocity,maturity,security");
    await expectSearch(page, "?sort=stars,velocity,maturity");
    expect(await controlText(page, FILTER)).toContain("3/3");
  });

  test("invalid ?window and empty ?topic self-heal to a clean URL", async ({ page }) => {
    await go(page, "/?window=banana&topic=");
    await expectSearch(page, "");
    expect(await controlText(page, TAGS)).toContain("hermes");
  });

  test("logo reset clears topic + sort back to the default view", async ({ page }) => {
    // Build up a non-default state, then click home.
    await go(page, "/?topic=cloudflare&sort=stars,velocity");
    await page.click(LOGO);
    // Topic resets to default (hermes → omitted) and sort resets to default
    // ("stars" → omitted). Window was already default, so the URL is clean.
    await expectSearch(page, "");
    expect(await controlText(page, TAGS)).toContain("hermes");
  });
});
