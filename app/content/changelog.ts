/**
 * Curated changelog for RepoRadar.
 * Exported as a markdown string; bundled at build time — no runtime filesystem reads.
 * Add new entries at the top (newest first) under a `## YYYY-MM-DD` heading.
 */
export const changelog = `
# Changelog

All notable changes to RepoRadar are documented here, newest first.

---

## 2026-05-27 — Phase 2: Credibility Batch

### Added
- **/changelog** — this page: a human-curated, on-brand changelog surface.
- **/blog** — a blog list page with full per-post routes (/blog/[slug]).
- Two founding posts: "Why we built RepoRadar" and "How RepoRadar scores repos — the 10 dimensions".
- **Prose renderer** — shared \`react-markdown\` + \`remark-gfm\` component with on-brand dark-theme styling using design tokens from \`globals.css\`.
- **(site) route group** — shared article layout with back-to-dashboard navigation, no impact on the existing dashboard routes.

---

## 2026-05-14 — Phase 1: Tune Re-rank + Pulse

### Fixed
- Re-rank pulse: tuning the sliders now flashes the grid so the score update is always visually acknowledged.
- Smoke suite updated to match current panel UI.

---

## 2026-05-10 — Phase 1: Cache + Coalesce (Prerequisites)

### Added
- **trendingCache module** (\`app/lib/trendingCache.ts\`): a separate, testable cache layer wrapping \`fetchTrending\` with SWR semantics and in-flight coalescing.
- Cache key includes topic, query, since, page, perPage (lowercased for normalization).
- In-flight coalescing: one upstream GitHub call per concurrent identical key — no thundering-herd on the Cloudflare Worker edge.
- Only non-empty results are cached (rate-limited empty arrays are not persisted for the TTL).
- Existing repos route local Map+TTL removed; SWR headers and the 4-second translation race preserved.

### Added
- **sendEmail lib** (\`app/lib/email.ts\`): Resend integration via plain fetch (no SDK), including \`escapeHtml\` for safe HTML emails.
- Deploy route refactored to use \`sendEmail()\` with zero behavior change.
- \`.dev.vars.example\` committed documenting required secrets (GITHUB_TOKEN, RESEND_API_KEY, etc.) with human-handoff notes.

---

## 2026-05-09 — Hackathon Build (v1.0 launch)

### Added
- Initial launch at the **AI Tinkerers Generative UI Hackathon** (May 10, 2026).
- Dashboard with 10-dimension scored repo cards, match-score bars, tuning sliders, and AI-generated Generative UI surfaces for individual repos.
- Tag chips, search, and per-topic filtering.
- Infinite scroll with loading state, retry affordance.
- Star count display (top-right, icon + value, same visual size).
- Single "GitHub repo" action per card (lower-left, GitHub mark icon).
- Alert/notification subscription flow.
- FeedbackWidget (review modal, posts to GitHub Issues via /api/feedback).
- CopilotKit agent integration for Generative UI rendering.
- On-brand dark theme: --bg #06080d, --primary #22c55e (signal green), full token system.
- App-owned GitHub token for reliable API access.
- Deploy-on-demand surface generation with email notification (sendEmail).
`.trim();
