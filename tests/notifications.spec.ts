import { expect, test } from "@playwright/test";

const LOCAL_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const sampleRepos = [
  {
    fullName: "acme/launch-kit",
    description: "A clean starter for AI launch pages",
    stars: 48200,
    forks: 2100,
    openIssues: 18,
    recentCommits: 42,
    readmeLength: 12000,
    topics: ["ai", "starter", "product-hunt"],
    language: "TypeScript",
    htmlUrl: "https://github.com/acme/launch-kit",
    pushedAt: new Date().toISOString(),
    createdAt: "2024-02-01T00:00:00.000Z",
  },
  {
    fullName: "northstar/agent-trends",
    description: "Trend monitoring for agentic products",
    stars: 27100,
    forks: 1400,
    openIssues: 9,
    recentCommits: 31,
    readmeLength: 9000,
    topics: ["agents", "analytics", "trending"],
    language: "Python",
    htmlUrl: "https://github.com/northstar/agent-trends",
    pushedAt: new Date().toISOString(),
    createdAt: "2023-09-10T00:00:00.000Z",
  },
];

test.describe("notification email v1", () => {
  test("subscription endpoint queues a dummy trend email", async ({ request }) => {
    const res = await request.post(`${LOCAL_BASE}/api/notifications/subscribe`, {
      data: {
        email: "builder@example.com",
        sources: ["RepoRadar", "Product Hunt demo"],
        digest: [
          {
            title: "acme/launch-kit",
            subtitle: "48.2k stars · TypeScript",
            score: 94,
            source: "RepoRadar",
          },
        ],
      },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      status: "queued",
      email: "builder@example.com",
    });
    expect(body.dummyEmail.subject).toContain("RepoRadar Trend Pulse");
    expect(body.stored).toBe("memory");
  });

  test("subscription endpoint rejects invalid email", async ({ request }) => {
    const res = await request.post(`${LOCAL_BASE}/api/notifications/subscribe`, {
      data: { email: "not-an-email", sources: ["RepoRadar"], digest: [] },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("valid email");
  });

  test("dashboard stores notification preferences and queues demo email", async ({ page }) => {
    await page.route("**/api/repos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sampleRepos),
      });
    });

    await page.goto(LOCAL_BASE);
    await expect(page.getByRole("heading", { name: "Trend alerts" })).toBeVisible();
    await expect(page.getByText("Product Hunt demo")).toBeVisible();

    await page.getByLabel("Notification email").fill("builder@example.com");
    await page.getByRole("button", { name: "Send demo email" }).click();

    await expect(page.getByText("Demo email queued")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("builder@example.com")).toBeVisible();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("reporadar-notification-profile-v1"),
    );
    expect(stored).toContain("builder@example.com");
  });
});
