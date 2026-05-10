# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> home page >> the 10 quick-scan tag chips are rendered
- Location: tests/smoke.spec.ts:25:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Cloudflare")').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("Cloudflare")').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - heading "RepoRadar" [level=1] [ref=e6]
        - generic [ref=e7]: agent-rendered repos · generative-UI deploys at ·.reporadar.io
      - generic [ref=e8]:
        - generic [ref=e9]: ● LIVE
        - generic [ref=e10]: v0.2 · gen-ui hackathon
    - generic [ref=e11]:
      - generic "Pick one of these popular GitHub topic tags or type your own in the white box. Hover any chip to see what that topic is about." [ref=e12]:
        - text: Tags
        - generic [ref=e13]: "?"
      - generic [ref=e14]:
        - button "◈ Hermes" [ref=e15]:
          - generic [ref=e16]: ◈
          - text: Hermes
        - button "◇ OpenClaw" [ref=e17]:
          - generic [ref=e18]: ◇
          - text: OpenClaw
        - button "◆ AG-UI" [ref=e19]:
          - generic [ref=e20]: ◆
          - text: AG-UI
        - button "✸ A2UI" [ref=e21]:
          - generic [ref=e22]: ✸
          - text: A2UI
        - button "✦ Claude Code" [ref=e23]:
          - generic [ref=e24]: ✦
          - text: Claude Code
      - generic [ref=e25]:
        - textbox "✦ or type your own topic — 'a podcast platform', 'rust cli for the weekend'…" [ref=e26]
        - button "Search" [disabled] [ref=e27]: ↵ Enter
    - generic [ref=e28]:
      - generic [ref=e29]:
        - generic "Click up to 3 of these dimensions in priority order. First click = primary sort, second click breaks ties, third refines further. Hover any chip to read what that dimension means." [ref=e30]:
          - text: Sort by
          - generic [ref=e31]: "?"
        - generic "How many sort dimensions you've picked, out of the 3 max." [ref=e32]: (0/3)
      - generic [ref=e33]:
        - button "Momentum" [ref=e34]
        - button "Velocity" [ref=e35]
        - button "Maturity" [ref=e36]
        - button "Community" [ref=e37]
        - button "Recency" [ref=e38]
        - button "Heat" [ref=e39]
        - button "Prod" [ref=e40]
        - button "License" [ref=e41]
        - button "Docs" [ref=e42]
        - button "Ecosystem" [ref=e43]
    - main [ref=e44]:
      - complementary [ref=e45]:
        - generic [ref=e46]:
          - generic [ref=e47]:
            - heading "Tune your radar" [level=2] [ref=e48]
            - button "reset" [ref=e49]
          - generic "How fast this repo is gaining attention right now. Higher = stars climbing fast in the last weeks." [ref=e50]:
            - generic [ref=e51]:
              - generic [ref=e52]: Momentum
              - generic [ref=e53]: "70"
            - slider "Momentum 70" [ref=e54] [cursor=pointer]: "0.7"
          - generic "How actively the maintainers are shipping. Higher = more commits in the last 30 days." [ref=e55]:
            - generic [ref=e56]:
              - generic [ref=e57]: Velocity
              - generic [ref=e58]: "70"
            - slider "Velocity 70" [ref=e59] [cursor=pointer]: "0.7"
          - generic "How established + stable the project is. Higher = older, with more releases and adoption signals." [ref=e60]:
            - generic [ref=e61]:
              - generic [ref=e62]: Maturity
              - generic [ref=e63]: "70"
            - slider "Maturity 70" [ref=e64] [cursor=pointer]: "0.7"
          - button "+7 more dimensions ▼" [ref=e65]:
            - generic [ref=e66]: +7 more dimensions
            - generic [ref=e67]: ▼
        - generic [ref=e68]:
          - heading "Drag to tune" [level=2] [ref=e69]
          - generic [ref=e70]:
            - img [ref=e72]:
              - generic "How fast this repo is gaining attention right now. Higher = stars climbing fast in the last weeks." [ref=e106]: Mom
              - generic "How actively the maintainers are shipping. Higher = more commits in the last 30 days." [ref=e107]: Vel
              - generic "How established + stable the project is. Higher = older, with more releases and adoption signals." [ref=e108]: Mat
              - generic "How alive the community is. Higher = more contributors, faster issue cadence." [ref=e109]: Comm
              - generic "How recently anything happened. Higher = pushed within the last few days." [ref=e110]: Rec
              - generic "Engagement intensity. Higher = lots of forks + PRs relative to stars." [ref=e111]: Heat
              - generic "Production readiness signals. Higher = tests, CI, docs, security policy present." [ref=e112]: Prod
              - generic "Permissive-license safety for commercial use. Higher = MIT/Apache-style; lower = copyleft or unclear." [ref=e113]: Lic
              - generic "Documentation quality. Higher = long README, examples, docs site." [ref=e114]: Docs
              - generic "Downstream pull. Higher = lots of dependents, downloads, wide adoption." [ref=e115]: Eco
            - generic [ref=e116]: Drag vertices to tune · 10 axes · higher = better
        - generic [ref=e117]: Sliders, hex, and chat all share the same state. Click Deploy on any card to materialize a bespoke generative-UI surface at ·.reporadar.io.
      - generic [ref=e119]:
        - generic [ref=e120]:
          - generic [ref=e121]: ›
          - text: "trending: agents"
          - generic [ref=e122]: ·
          - generic [ref=e123]: 6 repos
        - generic [ref=e124]:
          - 'button "1st place medal 4.2k #agent #ai-agent #chat-ui #dashboard #hermes Web dashboard for Hermes Agent — multi-platform AI chat, session management, scheduled jobs, usage analytics match score 63/100 EKKOLearnAI/hermes-web-ui · TypeScript Deploy →" [ref=e126] [cursor=pointer]':
            - generic [ref=e127]:
              - generic "1st place medal" [ref=e128]: "1"
              - generic "4,225 stars on GitHub" [ref=e129]:
                - generic [ref=e130]: 4.2k
                - generic [ref=e131]: ★
            - generic [ref=e132]:
              - button "#agent" [ref=e133]
              - button "#ai-agent" [ref=e134]
              - button "#chat-ui" [ref=e135]
              - button "#dashboard" [ref=e136]
              - button "#hermes" [ref=e137]
            - paragraph [ref=e138]: Web dashboard for Hermes Agent — multi-platform AI chat, session management, scheduled jobs, usage analytics
            - 'generic "Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune." [ref=e140]':
              - generic [ref=e141]: match score
              - generic [ref=e142]: 63/100
            - generic [ref=e145]:
              - link "EKKOLearnAI/hermes-web-ui · TypeScript" [ref=e146]:
                - /url: https://github.com/EKKOLearnAI/hermes-web-ui
              - button "Deploy →" [ref=e147]
          - 'button "2nd place medal 95 #agentic-ai #ai-agents #android-automation #claude #claude-code Hire a phone to do your growth work: An open-source AI mobile operator that automates Android apps for growth, research, social media, and long-running phone-based workflows. match score 46/100 Core-Mate/OpenGUI · Kotlin Deploy →" [ref=e149] [cursor=pointer]':
            - generic [ref=e150]:
              - generic "2nd place medal" [ref=e151]: "2"
              - generic "95 stars on GitHub" [ref=e152]:
                - generic [ref=e153]: "95"
                - generic [ref=e154]: ★
            - generic [ref=e155]:
              - button "#agentic-ai" [ref=e156]
              - button "#ai-agents" [ref=e157]
              - button "#android-automation" [ref=e158]
              - button "#claude" [ref=e159]
              - button "#claude-code" [ref=e160]
            - paragraph [ref=e161]: "Hire a phone to do your growth work: An open-source AI mobile operator that automates Android apps for growth, research, social media, and long-running phone-based workflows."
            - 'generic "Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune." [ref=e163]':
              - generic [ref=e164]: match score
              - generic [ref=e165]: 46/100
            - generic [ref=e168]:
              - link "Core-Mate/OpenGUI · Kotlin" [ref=e169]:
                - /url: https://github.com/Core-Mate/OpenGUI
              - button "Deploy →" [ref=e170]
          - 'button "3rd place medal 93 #agent #agentic-ai #hermes #orchestration UI layer for the native Hermes orchestration features match score 44/100 Naroh091/hermes-war-room · Vue Deploy →" [ref=e172] [cursor=pointer]':
            - generic [ref=e173]:
              - generic "3rd place medal" [ref=e174]: "3"
              - generic "93 stars on GitHub" [ref=e175]:
                - generic [ref=e176]: "93"
                - generic [ref=e177]: ★
            - generic [ref=e178]:
              - button "#agent" [ref=e179]
              - button "#agentic-ai" [ref=e180]
              - button "#hermes" [ref=e181]
              - button "#orchestration" [ref=e182]
            - paragraph [ref=e183]: UI layer for the native Hermes orchestration features
            - 'generic "Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune." [ref=e185]':
              - generic [ref=e186]: match score
              - generic [ref=e187]: 44/100
            - generic [ref=e190]:
              - link "Naroh091/hermes-war-room · Vue" [ref=e191]:
                - /url: https://github.com/Naroh091/hermes-war-room
              - button "Deploy →" [ref=e192]
          - 'button "04 52 #agent-framework #agent-infrastructure #ai-agent #claude-code #claude-skill 大师.skill — 输入行业，自动调研 6 轨（大佬/工具/工作流/正典/信源/术语）→ 提炼为可运行的行业 Master OS skill。所有 Claude Code / OpenClaw / Codex / Hermes agent 都能装载。Distill any sub-niche industry into a runnable Master OS skill for AI agents. match score 44/100 voidborne-d/master-skill · Shell Deploy →" [ref=e194] [cursor=pointer]':
            - generic [ref=e195]:
              - generic "Rank 4 given your current sliders + sort priorities" [ref=e196]: "04"
              - generic "52 stars on GitHub" [ref=e197]:
                - generic [ref=e198]: "52"
                - generic [ref=e199]: ★
            - generic [ref=e200]:
              - button "#agent-framework" [ref=e201]
              - button "#agent-infrastructure" [ref=e202]
              - button "#ai-agent" [ref=e203]
              - button "#claude-code" [ref=e204]
              - button "#claude-skill" [ref=e205]
            - paragraph [ref=e206]: 大师.skill — 输入行业，自动调研 6 轨（大佬/工具/工作流/正典/信源/术语）→ 提炼为可运行的行业 Master OS skill。所有 Claude Code / OpenClaw / Codex / Hermes agent 都能装载。Distill any sub-niche industry into a runnable Master OS skill for AI agents.
            - 'generic "Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune." [ref=e208]':
              - generic [ref=e209]: match score
              - generic [ref=e210]: 44/100
            - generic [ref=e213]:
              - link "voidborne-d/master-skill · Shell" [ref=e214]:
                - /url: https://github.com/voidborne-d/master-skill
              - button "Deploy →" [ref=e215]
          - 'button "05 920 #agent #hermes #open-claw An agent capable of self-evolving and dynamically hardening security match score 42/100 YeQing17-2026/OmniAgent · Python Deploy →" [ref=e217] [cursor=pointer]':
            - generic [ref=e218]:
              - generic "Rank 5 given your current sliders + sort priorities" [ref=e219]: "05"
              - generic "920 stars on GitHub" [ref=e220]:
                - generic [ref=e221]: "920"
                - generic [ref=e222]: ★
            - generic [ref=e223]:
              - button "#agent" [ref=e224]
              - button "#hermes" [ref=e225]
              - button "#open-claw" [ref=e226]
            - paragraph [ref=e227]: An agent capable of self-evolving and dynamically hardening security
            - 'generic "Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune." [ref=e229]':
              - generic [ref=e230]: match score
              - generic [ref=e231]: 42/100
            - generic [ref=e234]:
              - link "YeQing17-2026/OmniAgent · Python" [ref=e235]:
                - /url: https://github.com/YeQing17-2026/OmniAgent
              - button "Deploy →" [ref=e236]
          - 'button "06 139 #ai-ui #client #dashboard #hermes #hermes-agent Web client for Hermes agent match score 40/100 lotsoftick/hermes_client · TypeScript Deploy →" [ref=e238] [cursor=pointer]':
            - generic [ref=e239]:
              - generic "Rank 6 given your current sliders + sort priorities" [ref=e240]: "06"
              - generic "139 stars on GitHub" [ref=e241]:
                - generic [ref=e242]: "139"
                - generic [ref=e243]: ★
            - generic [ref=e244]:
              - button "#ai-ui" [ref=e245]
              - button "#client" [ref=e246]
              - button "#dashboard" [ref=e247]
              - button "#hermes" [ref=e248]
              - button "#hermes-agent" [ref=e249]
            - paragraph [ref=e250]: Web client for Hermes agent
            - 'generic "Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune." [ref=e252]':
              - generic [ref=e253]: match score
              - generic [ref=e254]: 40/100
            - generic [ref=e257]:
              - link "lotsoftick/hermes_client · TypeScript" [ref=e258]:
                - /url: https://github.com/lotsoftick/hermes_client
              - button "Deploy →" [ref=e259]
    - generic [ref=e260]:
      - button "Open Chat" [ref=e262] [cursor=pointer]:
        - img [ref=e264]
        - generic:
          - img
      - generic:
        - generic:
          - generic: RepoRadar
          - generic:
            - button "Close":
              - img
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic: Hey — ask me to find you a repo, like 'show me trending security repos' or 'find me a Rust project for a weekend'. I'll plot them and you can deploy any one as its own interactive surface at .reporadar.io.
                - generic:
                  - button "Regenerate response":
                    - img
                  - button "Copy to clipboard":
                    - img
                  - button "Thumbs up":
                    - img
                  - button "Thumbs down":
                    - img
            - contentinfo
          - generic:
            - generic:
              - textbox "Type a message..."
              - generic:
                - button "Send" [disabled]:
                  - img
            - generic:
              - paragraph: Powered by CopilotKit
  - alert [ref=e267]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | // ========================================================================
  4   | // Smoke tests for RepoRadar — run against LIVE production at reporadar.io.
  5   | // No localhost. Per Christo's "prod only" rule.
  6   | // Run: `npm run test:smoke`
  7   | // ========================================================================
  8   | 
  9   | const BASE = "https://reporadar.io";
  10  | const SAMPLE_DEPLOY = "https://anthropics-claude-cookbooks-href.reporadar.io";
  11  | const DEPLOY_WORKER = "https://reporadar-deploy.let-s-go-christo.workers.dev";
  12  | 
  13  | test.describe("home page", () => {
  14  |   test("loads with the right title and key chrome", async ({ page }) => {
  15  |     await page.goto("/");
  16  |     await expect(page).toHaveTitle(/RepoRadar/i);
  17  |     // The animated LIVE indicator appears in the header. Use a strict
  18  |     // locator on the exact string with the leading bullet so we don't match
  19  |     // tooltip <title> nodes that contain the substring "alive".
  20  |     await expect(page.locator("text=● LIVE")).toBeVisible();
  21  |     // The gradient logo text
  22  |     await expect(page.locator("h1", { hasText: "RepoRadar" })).toBeVisible();
  23  |   });
  24  | 
  25  |   test("the 10 quick-scan tag chips are rendered", async ({ page }) => {
  26  |     await page.goto("/");
  27  |     for (const label of [
  28  |       "Hermes",
  29  |       "OpenClaw",
  30  |       "AG-UI",
  31  |       "A2UI",
  32  |       "Claude Code",
  33  |       "Cloudflare",
  34  |       "Generative UI",
  35  |       "MCP",
  36  |       "LangChain",
  37  |       "Gemini",
  38  |     ]) {
  39  |       await expect(
  40  |         page.locator(`button:has-text("${label}")`).first(),
> 41  |       ).toBeVisible();
      |         ^ Error: expect(locator).toBeVisible() failed
  42  |     }
  43  |   });
  44  | 
  45  |   test("the inline white search input is rendered", async ({ page }) => {
  46  |     await page.goto("/");
  47  |     await expect(
  48  |       page.locator('input[placeholder*="type your own topic" i]'),
  49  |     ).toBeVisible();
  50  |   });
  51  | 
  52  |   test("sort-priority chips are rendered (Stars first, plus the 10 dims)", async ({ page }) => {
  53  |     await page.goto("/");
  54  |     // The "Most Stars" virtual sort priority sits first and is auto-selected
  55  |     await expect(
  56  |       page.locator('button:has-text("Most Stars")').first(),
  57  |     ).toBeVisible();
  58  |     // Each dimension chip uses its phrase-form label
  59  |     for (const label of [
  60  |       "Trending Momentum",
  61  |       "Shipping Velocity",
  62  |       "Project Maturity",
  63  |       "Community Engagement",
  64  |       "Activity Recency",
  65  |       "Engagement Heat",
  66  |       "Production Readiness",
  67  |       "Security & Trust",
  68  |       "Documentation Quality",
  69  |       "Ecosystem Pull",
  70  |     ]) {
  71  |       await expect(
  72  |         page.locator(`button:has-text("${label}")`).first(),
  73  |       ).toBeVisible();
  74  |     }
  75  |   });
  76  | 
  77  |   test("the 3 default sliders + caret expand are rendered", async ({ page }) => {
  78  |     await page.goto("/");
  79  |     // Tune your radar header
  80  |     await expect(page.locator("text=Tune your radar")).toBeVisible();
  81  |     // Top-3 slider labels
  82  |     for (const label of ["Momentum", "Velocity", "Maturity"]) {
  83  |       await expect(page.locator("label", { hasText: label }).first()).toBeVisible();
  84  |     }
  85  |     // Caret to expand the rest
  86  |     await expect(page.locator("text=more dimensions")).toBeVisible();
  87  |   });
  88  | 
  89  |   test("the InteractiveRadar SVG renders with 10 axis spokes", async ({ page }) => {
  90  |     await page.goto("/");
  91  |     // Wait briefly for the auto-load + first paint
  92  |     await page.waitForTimeout(1500);
  93  |     const svg = page.locator("svg").first();
  94  |     await expect(svg).toBeVisible();
  95  |     // Each draggable vertex handle is a circle with cursor:grab styling
  96  |     const circles = svg.locator("circle");
  97  |     expect(await circles.count()).toBeGreaterThanOrEqual(10);
  98  |   });
  99  | 
  100 |   test("auto-loads trending agent repos within 5s", async ({ page }) => {
  101 |     await page.goto("/");
  102 |     // The empty state has this exact copy; once cards land it's gone
  103 |     await page.waitForFunction(
  104 |       () => !document.body.textContent?.includes("Repo cards will materialize here"),
  105 |       undefined,
  106 |       { timeout: 8000 },
  107 |     );
  108 |     // At least one card with a Deploy button
  109 |     expect(
  110 |       await page.locator('button:has-text("Deploy")').count(),
  111 |     ).toBeGreaterThan(0);
  112 |   });
  113 | });
  114 | 
  115 | test.describe("interactions", () => {
  116 |   test("clicking a sort-priority chip adds a priority number badge", async ({ page }) => {
  117 |     await page.goto("/");
  118 |     // Click Momentum in the SORT BY row (the first occurrence)
  119 |     const chip = page.locator('button:has-text("Momentum")').first();
  120 |     await chip.click();
  121 |     // After click, the chip should show a "1" badge (priority 1)
  122 |     await expect(
  123 |       chip.locator("span", { hasText: /^1$/ }),
  124 |     ).toBeVisible({ timeout: 3000 });
  125 |   });
  126 | 
  127 |   test("typing in the search box and pressing Enter changes the activity state", async ({ page }) => {
  128 |     await page.goto("/");
  129 |     await page.waitForTimeout(1500);
  130 |     const input = page.locator('input[placeholder*="type your own topic" i]');
  131 |     await input.fill("podcast");
  132 |     await input.press("Enter");
  133 |     // The status line under the cards should reflect a new query
  134 |     await page.waitForTimeout(2500);
  135 |     const lastQuery = page.locator("text=/search:|trending:/i").first();
  136 |     await expect(lastQuery).toBeVisible();
  137 |   });
  138 | 
  139 |   test("clicking a card snaps weights (selected border + glow)", async ({ page }) => {
  140 |     await page.goto("/");
  141 |     await page.waitForTimeout(2000);
```