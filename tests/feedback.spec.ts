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
];

test.describe("feedback to issue", () => {
  test("API verifies feedback and queues an issue when GitHub issue config is missing", async ({ request }) => {
    const res = await request.post(`${LOCAL_BASE}/api/feedback`, {
      data: {
        feedback: "The repo cards need a clearer loading state after I change tags.",
        contact: "@builder",
        pageUrl: `${LOCAL_BASE}/?topic=agents`,
      },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.issue.status).toBe("queued");
    expect(body.issue.verified.title).toContain("Feedback:");
    expect(body.issue.verified.body).toContain("clearer loading state");
    expect(body.issue.verified.body).toContain("Verified details");
  });

  test("API rejects empty feedback", async ({ request }) => {
    const res = await request.post(`${LOCAL_BASE}/api/feedback`, {
      data: { feedback: "   " },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("feedback");
  });

  test("dashboard exposes a top-right feedback flow", async ({ page }) => {
    await page.route("**/api/repos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sampleRepos),
      });
    });
    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          issue: {
            status: "queued",
            verified: {
              title: "Feedback: improve repo card loading clarity",
              body: "Verified details\n\nOriginal feedback: improve loading clarity",
            },
          },
        }),
      });
    });

    await page.goto(LOCAL_BASE);
    const feedbackButton = page.getByRole("button", { name: "Review or feedback" });
    await expect(feedbackButton).toBeVisible();
    await feedbackButton.click();

    await page
      .getByRole("textbox", { name: "Review or feedback" })
      .fill("The filters are useful but the active state could be clearer.");
    await page.getByRole("button", { name: "Send feedback" }).click();

    await expect(page.getByText("Issue queued")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Feedback: improve repo card loading clarity")).toBeVisible();
  });
});
