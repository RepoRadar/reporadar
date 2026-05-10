import { expect, test } from "@playwright/test";

const LOCAL_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("auth WIP", () => {
  test("email/password registration creates a session and logout clears it", async ({ request }) => {
    const email = `builder-${Date.now()}@example.com`;
    const password = "LaunchRadar123";

    const register = await request.post(`${LOCAL_BASE}/api/auth/register`, {
      data: { name: "Builder", email, password },
    });
    expect(register.ok()).toBe(true);
    const body = await register.json();
    expect(body.user).toMatchObject({ email, name: "Builder", provider: "password" });

    const me = await request.get(`${LOCAL_BASE}/api/auth/me`);
    expect((await me.json()).user.email).toBe(email);

    const logout = await request.post(`${LOCAL_BASE}/api/auth/logout`);
    expect(logout.ok()).toBe(true);
    const after = await request.get(`${LOCAL_BASE}/api/auth/me`);
    expect((await after.json()).user).toBeNull();
  });

  test("weak passwords are rejected", async ({ request }) => {
    const res = await request.post(`${LOCAL_BASE}/api/auth/register`, {
      data: { email: `weak-${Date.now()}@example.com`, password: "short" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("Password");
  });

  test("OAuth starts fail closed until provider secrets are configured", async ({ request }) => {
    const res = await request.get(`${LOCAL_BASE}/api/auth/oauth/github`);
    expect(res.status()).toBe(503);
    expect((await res.json()).error).toContain("github OAuth is not configured");
  });

  test("login page supports email and OAuth entry points", async ({ page }) => {
    const hydrated = page.waitForResponse((res) => res.url().includes("/api/auth/me") && res.ok());
    await page.goto(`${LOCAL_BASE}/login`, { waitUntil: "domcontentloaded" });
    await hydrated;

    await expect(page.getByRole("heading", { name: "Sign in to save your radar." })).toBeVisible();
    await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "/api/auth/oauth/github");
    await expect(page.getByRole("link", { name: "Google" })).toHaveAttribute("href", "/api/auth/oauth/google");

    const email = `ui-${Date.now()}@example.com`;
    await page.getByRole("button", { name: "Create" }).click();
    await page.locator("input").nth(0).fill("UI Builder");
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill("LaunchRadar123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible({ timeout: 5000 });
  });
});
