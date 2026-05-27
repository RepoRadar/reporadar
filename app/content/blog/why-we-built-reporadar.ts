import type { BlogPost } from "./index";

export const post: BlogPost = {
  slug: "why-we-built-reporadar",
  title: "Why we built RepoRadar",
  date: "2026-05-10",
  summary:
    "RepoRadar started as a hackathon project built for the AI Tinkerers Generative UI Hackathon. Here's the problem we set out to solve and why we think it matters.",
  body: `
## The problem: too many repos, not enough signal

Every day, hundreds of repositories get pushed to the top of GitHub Trending. Most of them are impressive. Very few of them are meaningful to *you*, right now, as a builder.

The existing tools for discovering repos — Trending pages, Hacker News, newsletters — treat every repo as equally interesting. A viral CSS demo ranks next to a foundational new inference engine. A one-day spike sits alongside a quietly compounding project that has been growing for three years.

We wanted a better way to answer a specific question: **what is the most meaningful repo I could build upon this week?**

That question is different from "what is trending." It requires:

- Understanding what you care about (language, topic, recency, community health).
- Scoring repos along multiple dimensions — not just stars.
- Making the scoring model *transparent and tunable* so you can trust the output.

---

## The hackathon context

RepoRadar was built for the **AI Tinkerers Generative UI Hackathon** (May 10, 2026). The theme was Generative UI — building interfaces where the AI generates the UI, not just the content.

Most teams interpreted this as "AI writes some JSX." We took it further: every repo card in RepoRadar is a fully AI-rendered Generative UI surface. When you click "Deploy" on a repo, a CopilotKit agent reads the README, infers the repo's purpose and audience, and assembles a bespoke interactive page — forms, visualizations, explanations — in real time.

The dashboard itself is the tuning interface. The sliders and match-score bars use the same visual grammar so the controls and the output speak the same language.

---

## The 10-dimension scoring model

Rather than a single "relevance" score, RepoRadar scores every repo on 10 dimensions (see [How RepoRadar scores repos](/blog/how-reporadar-scores-repos) for the full breakdown). Each dimension is normalized 0–1 and blended with user-tunable weights. The resulting match score is the weighted sum.

This means:

- You can tune the model toward your priorities.
- The score bars on each card mirror the slider positions, so you can see *why* a repo ranked where it did.
- A repo with 200 stars but perfect topic match can outrank a 20,000-star repo that's irrelevant to your query.

---

## What's next

RepoRadar is a real, actively maintained product. Phase 2 (shipping now) adds credibility surfaces — this blog, a changelog, a contact form, a suggestion box, a donation link, and privacy-respecting analytics.

The long-term roadmap includes:

- **Alerts**: subscribe to a topic and get notified when a meaningful new repo appears.
- **Audio summaries**: lean per-repo audio overviews.
- **Premium**: saved searches, alert history, priority scoring.

If you find a repo you want to build upon — and you find it here — that's exactly what we set out to do.
`.trim(),
};
