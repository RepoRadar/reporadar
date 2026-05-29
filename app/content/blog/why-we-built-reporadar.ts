import type { BlogPost } from "./index";

export const post: BlogPost = {
  slug: "why-we-built-reporadar",
  title: "Why we built RepoRadar",
  date: "2026-05-09",
  summary:
    "RepoRadar started as a hackathon project built for the AI Tinkerers Generative UI Hackathon. Here's the problem we set out to solve and why we think it matters.",
  body: `
## The problem: too many repos, not enough signal

Every day, hundreds of repositories get pushed to the top of GitHub Trending. Most of them are impressive. Very few of them are meaningful to *you*, right now, as a builder.

The existing tools for discovering repos (Trending pages, Hacker News, newsletters) treat every repo as equally interesting. A viral CSS demo ranks next to a foundational new inference engine. A one-day spike sits alongside a quietly compounding project that has been growing for three years.

We wanted a better way to answer a specific question: **what is the most meaningful repo I could build upon this week?**

That question is different from "what is trending." It requires:

- Understanding what you care about (language, topic, recency, community health).
- Scoring repos along multiple dimensions, not just stars.
- Making the scoring model *transparent and tunable* so you can trust the output.

---

## What RepoRadar does

Four things, and none of them are "here's a list, good luck."

1. **Search every repo, then judge it for you.** Search GitHub or Google and you get a list ranked by stars or SEO. You still open ten tabs and guess. RepoRadar scores each repo on the things that decide whether you'll actually adopt it, so you get a verdict instead of homework.
2. **Score what matters, in the open.** Every repo is rated across 10 tunable dimensions: topic relevance, velocity, maturity, community health, documentation, and more. Move the sliders and the rankings move with you. The score bars on each card show you *why* a repo landed where it did.
3. **Watch, instead of search again.** Searching is something you repeat forever. Alerts flip that around: set your criteria once and we tell you when a repo crosses them, like one that gained 2,000 stars in three days, scores high on security, and sits in your topic. Google can't tell you what got good this week.
4. **Ask about a specific repo.** Open the chat on any repo and ask it directly, "would this work with what I already built?" The model reads the repo against our scoring criteria, makes a judgment call, and points you to better-fit alternatives if there are any.

The pitch in one line: high signal for minimal effort, and more reason to come back as new repos keep landing.

---

## The hackathon context

RepoRadar was built for the **AI Tinkerers Generative UI Hackathon** (May 9, 2026). The theme was Generative UI: building interfaces where the AI generates the UI, not just the content.

Most teams interpreted this as "AI writes some JSX." We took it further: every repo card in RepoRadar is a fully AI-rendered Generative UI surface. When you click "Deploy" on a repo, a CopilotKit agent reads the README, infers the repo's purpose and audience, and assembles a bespoke interactive page (forms, visualizations, explanations) in real time.

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

RepoRadar is a real, actively maintained product. Phase 2 (shipping now) adds credibility surfaces: this blog, a changelog, a contact form, a suggestion box, a donation link, and privacy-respecting analytics.

The long-term roadmap includes:

- **Alerts**: subscribe to a topic and get notified when a meaningful new repo appears.
- **Audio summaries**: lean per-repo audio overviews.
- **Premium**: saved searches, alert history, priority scoring.

If you find a repo you want to build upon, and you find it here, that's exactly what we set out to do.

---

## The team {#team}

RepoRadar was built for the AI Tinkerers Generative UI Hackathon by three people.

**Christo Roberts**, founder. Builds and ships across the Cloudflare stack and creates under the "letsgochristo" handle. [letsgochristo.com](https://letsgochristo.com/), [LinkedIn](https://www.linkedin.com/in/christopherbroberts/), [X](https://x.com/letsgochristo/), [YouTube](https://www.youtube.com/@letsgochristo), [Instagram](https://www.instagram.com/letsgochristo/), [TikTok](https://www.tiktok.com/@letsgochristo).

**Priyanshu Harshbodhi**, co-founder. AI Engineer at Truxt.ai with about four years in computer science, based in the Greater Delhi Area. [LinkedIn](https://www.linkedin.com/in/priyanshu-harshbodhi), [X](https://x.com/priyanhb), [GitHub](https://github.com/priyanshuharshbodhi1).

**Craig Latta**, co-founder. Research computer scientist at Black Page Digital, with UC Berkeley degrees in music composition and computer science and a stint as an AI researcher at the IBM Watson Research Lab. He is building Orbit, an agentic pair-programming agent for livecoding. [LinkedIn](https://www.linkedin.com/in/ccrraaiigg), [GitHub](https://github.com/ccrraaiigg).

See the full roster on the [AI Tinkerers hackathon team page](https://sf.aitinkerers.org/hackathons/h_FZX7ihFWcHA/teams/ht_kAYzJVwLU68).

---

## FAQ {#faq}

### Isn't this just GitHub search or Google?
No. Search tools answer one question: what exists? They rank by stars or SEO and leave you to judge every result yourself. They're reactive (you keep searching) and generic (they don't know what you've built). RepoRadar judges repos on the dimensions you care about, watches for new ones so you don't have to, and can reason about whether a specific repo fits your stack. Short version: Google and GitHub tell you what's popular. RepoRadar tells you what's good, whether it fits you, and when something worth knowing shows up.

### How is RepoRadar different from GitHub Trending?
GitHub Trending shows what's popular right now by raw star accumulation. RepoRadar lets you tune **10 dimensions** (topic relevance, velocity, maturity, community health, documentation quality, and more) so the ranking matches your priorities, not the crowd's.

### Does RepoRadar cost money?
The core dashboard is free. Future premium features (saved searches, alert history, priority scoring) will be announced here and on the blog.

### How do I get notified about new repos?
Use the **Trend alerts** panel on the dashboard. Enter your email, a term to watch, a metric (stars gained, % growth, or stars/day), and a threshold. When a repo crosses that threshold, you get one email. No spam.

### Can I deploy a repo from RepoRadar?
Yes. Click the **Deploy →** button on any repo card. An AI agent reads the repo's README and generates a bespoke interactive surface (playground, dashboard, or wizard) at \`<slug>.reporadar.io\`.

### How do I give feedback or suggest a feature?
Click **Interact → Suggestions** in the top-right of the dashboard, or use the **Suggest a feature** link in the footer.

### Who built this?
Christo Roberts with co-founders Priyanshu Harshbodhi and Craig Latta, at the AI Tinkerers Generative UI Hackathon (May 9, 2026). Bios and links are in [The team](#team) above. It's MIT-licensed and open source at [github.com/RepoRadar/reporadar](https://github.com/RepoRadar/reporadar).

### Can I contribute?
Absolutely. The repo is public and MIT-licensed. File issues, submit PRs, or fork it. See the [GitHub repo](https://github.com/RepoRadar/reporadar) to get started.
`.trim(),
};
