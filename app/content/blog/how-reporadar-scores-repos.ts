import type { BlogPost } from "./index";

export const post: BlogPost = {
  slug: "how-reporadar-scores-repos",
  title: "How RepoRadar scores repos: the 10 dimensions",
  date: "2026-05-20",
  summary:
    "RepoRadar ranks repos using a 10-dimension scoring model. Each dimension is normalized 0–1 and blended with your tuning weights. Here's what each dimension measures and why it matters.",
  body: `
## A score you can trust, and tune

Most "repo discovery" tools rank by raw star count. Stars are a popularity signal, not a relevance signal. A five-year-old library with 40,000 stars may be less useful today than a 6-month-old tool with 800 stars and weekly releases.

RepoRadar uses a **10-dimension scoring model** that you can tune via the dashboard sliders. Each dimension is normalized to a 0–1 range; your slider positions set the blend weights; the weighted sum becomes the match score shown on each card.

---

## The 10 dimensions

### 1. Topic relevance
How closely does the repo match your search query or selected topic tag? Measured by embedding similarity between your query and the repo's name, description, README excerpt, and topics list.

**Why it matters:** A repo that perfectly matches your intent but has few stars will outrank a famous repo that's tangentially related.

---

### 2. Star velocity
How fast is the repo gaining stars right now, relative to its total star count? A repo that gained 500 stars in the last 7 days on a base of 2,000 is growing faster than one that gained 500 on a base of 50,000.

**Why it matters:** Velocity predicts community momentum better than absolute star count.

---

### 3. Recency
How recently was the repo created? Newer repos score higher on this dimension (normalized by the "Since" filter window).

**Why it matters:** For fast-moving fields (LLMs, edge compute, AI infra), a 2-year-old repo may already be superseded.

---

### 4. Freshness (last commit)
How recently was the repo's default branch updated? A project with no commits in 18 months is likely unmaintained, regardless of stars.

**Why it matters:** You need a repo you can build upon. Stale repos incur maintenance risk.

---

### 5. Issue health
The ratio of closed issues to total issues, adjusted for issue volume. A project that closes 95% of issues shows responsive maintainers.

**Why it matters:** Community health predicts whether your PRs and bug reports will be addressed.

---

### 6. Fork activity
The ratio of forks to stars, combined with recent fork velocity. High fork-to-star ratio indicates that builders are actively copying and extending the codebase, a strong signal of practical utility.

**Why it matters:** Stars can be passive; forks are an action. Someone found the repo worth building upon.

---

### 7. License permissiveness
Does the license allow commercial use, modification, and distribution? Repos under MIT, Apache 2.0, or BSD-2/3 score highest. Copyleft (GPL) and "no license" score lower.

**Why it matters:** If you're building a product, license compatibility is non-negotiable.

---

### 8. Documentation quality
Does the repo have a substantive README? Does it include installation instructions, usage examples, and a contributing guide? Scored by heuristics (length, section headers, code blocks, links).

**Why it matters:** Poor docs mean high onboarding cost. You're choosing whether to invest time here.

---

### 9. Ecosystem fit
How many of the repo's dependency languages and topic tags match your own tuning preferences (language filter, topic filter)? Measured by overlap with your active filters.

**Why it matters:** A perfect Python library is useless if you're building in TypeScript.

---

### 10. Community size
Absolute community size (stars + forks + watchers), log-normalized to prevent large repos from dominating. Provides a floor of "real interest exists."

**Why it matters:** All else equal, a larger community means more tutorials, Stack Overflow answers, and third-party integrations.

---

## How the blend works

Every slider on the RepoRadar dashboard maps to one of these dimensions. The match-score bar on each card uses the same green-to-red gradient language as the sliders, so you can see at a glance which repos score well on your priorities.

The sliders use softmax normalization: they sum to 1.0, so increasing the weight of one dimension slightly reduces the others. This keeps the total score comparable across tuning configurations.

---

## What the model doesn't do

- It does not read the codebase, run tests, or evaluate code quality. That would require per-repo compute we don't yet have.
- It does not account for organizational trust (is this a CNCF project? a Fortune 500 OSS release?). This is a planned dimension for a future version.
- It does not personalize based on your GitHub activity. That requires OAuth, which is a future premium feature.

---

## Tuning tips

- **New tech, unknown authors:** maximize Recency + Star Velocity, lower Community Size.
- **Production dependencies:** maximize Freshness + Issue Health + License Permissiveness.
- **Learning projects:** maximize Documentation Quality + Community Size.
- **Finding hidden gems:** lower Community Size, raise Star Velocity + Fork Activity.

The model is designed to be trustworthy because it is transparent. If you disagree with a ranking, adjust the sliders and watch the grid reorder in real time.
`.trim(),
};
