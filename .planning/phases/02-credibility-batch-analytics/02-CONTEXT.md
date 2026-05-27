# Phase 2: Credibility Batch + Analytics - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Source:** discuss-phase --auto (recommended defaults; rationale in 02-DISCUSSION-LOG.md). Surfaces mapped via Explore — see file:line refs in canonical_refs.

<domain>
## Phase Boundary

Make RepoRadar look like a real, maintained, measurable product — shipped as a cohesive
"credibility batch" of small, on-brand additions that DO NOT regress the dashboard or the
hackathon-frozen UI contracts:

- `/changelog` — human-curated changelog, on-brand.
- `/blog` — 1–2 "how & why we built it" posts, on-brand, with a recurring "30-day check-in" template.
- **Contact form** — `/contact` page + `POST /api/contact` that emails the team via `sendEmail()` (Phase 1). Validated + rate-limited.
- **Suggestion box** — EXTEND the existing `FeedbackWidget` + `/api/feedback` with a "suggest a feature" path (a `type` field). Do NOT duplicate the widget.
- **Donation link** — a "Buy us a coffee" outbound link in a new footer. No payment integration.
- **Analytics** — privacy-respecting pageviews (Cloudflare Web Analytics beacon) + a provider-agnostic `track()` helper wired to the core events (search run, tag picked, deploy clicked, alert signup).
- **Footer** — a new on-brand footer (links to the above + GitHub + the frozen hackathon link).

**Out of scope:** auth, payments/Stripe, comments, a CMS, RSS.
</domain>

<decisions>
## Implementation Decisions

### Hard platform constraint (drives content decisions)
- **D-00 [BLOCKING]:** Prod is **Cloudflare Workers via OpenNext — NO runtime filesystem.** Content pages MUST be **statically rendered with content bundled at build time** (no `fs.readFileSync` at request time). Each new content/info page sets `export const dynamic = "force-static"` (or uses only build-time data) and MUST appear as `○ (Static)` in `npm run build` output. A clean local build that does runtime `fs` will 500 on Workers — this has bitten the project twice.

### Changelog & Blog (content + rendering)
- **D-01:** Render markdown with **`react-markdown` + `remark-gfm`** (add as deps). No `@next/mdx` (avoids loader/config + Workers edge cases).
- **D-02:** Content is **bundled as TypeScript modules**, not read from disk at runtime:
  - `app/content/changelog.ts` — exports a markdown string (curated). (May also be sourced from a root `CHANGELOG.md` imported as a raw string IF a raw import is configured cleanly; default to the `.ts` module to avoid loader risk.)
  - `app/content/blog/*.ts` — each post exports `{ slug, title, date, summary, body }` (body = markdown string). Ship **2 posts**: "Why we built RepoRadar" and "How RepoRadar scores repos (the 10 dimensions)". Include a commented **"30-day check-in" template** post module.
  - `app/content/blog/index.ts` — an ordered array of posts for the `/blog` list.
- **D-03:** Routes (App Router, route group `(site)` to share a layout): `/changelog`, `/blog` (list), `/blog/[slug]` (post). All `force-static`. `/blog/[slug]` uses `generateStaticParams()` over the bundled post slugs.
- **D-04:** A shared **on-brand article layout** (`app/(site)/_components/Prose.tsx` or similar) styling react-markdown output with the `globals.css` tokens (`--bg`, `--surface`, `--fg`, `--fg-muted`, `--fg-dim`; links in `--primary` #22c55e; timestamps in `--secondary` #3b82f6; `--font-geist-mono` for code). Matches the dark theme; no white flash.

### Contact form
- **D-05:** `/contact` page (`(site)` group) with a form (name/email/message), client validation; posts to **`POST /api/contact`** (`runtime = "nodejs"`).
- **D-06:** The API validates (required fields, lengths, basic email shape), **rate-limits** (simple in-memory per-IP token bucket / fixed window — mirror the lightweight in-memory patterns already in the repo; Workers per-isolate is acceptable for v1), and calls **`sendEmail()`** (Phase 1) to `process.env.CONTACT_TO`. If `CONTACT_TO` is unset, log+queue gracefully (never 500) — **`CONTACT_TO` is an owner-supplied config value (human handoff)**. Reply-to set to the submitter's email. Subject CR/LF already stripped by `sendEmail`.
- **D-07:** Success/error UX matches the FeedbackWidget status pattern (inline message, no full-page nav).

### Suggestion box (EXTEND, don't duplicate)
- **D-08:** Add an optional **`type?: "feedback" | "feature"`** field to the `/api/feedback` body (default `"feedback"`); when `"feature"`, add a `"feature-request"` GitHub label and tune the Gemini system instruction toward feature framing. Backward compatible.
- **D-09:** In `FeedbackWidget`, add a small **segmented toggle** (Review ↔ Suggest a feature) that sets `type` and swaps the title/placeholder copy. A footer **"Suggest a feature"** link opens the widget pre-set to `feature` (via a shared open-state mechanism / query hash). Single widget, two modes.

### Donation
- **D-10:** Footer **"☕ Buy us a coffee"** outbound link to `DONATION_URL` constant (default placeholder `https://ko-fi.com/reporadar`) — **confirm the real Ko-fi/BMC handle (human handoff)**. `target="_blank" rel="noopener noreferrer"`, accessible label. No integration.

### Analytics (privacy-respecting, free, on-brand)
- **D-11:** **Pageviews via Cloudflare Web Analytics beacon** — inject `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"…"}'>` in `app/layout.tsx`, rendered ONLY when `process.env.NEXT_PUBLIC_CF_BEACON_TOKEN` is set (**owner-supplied token from the CF dashboard — human handoff**). No cookies, no PII.
- **D-12:** A **provider-agnostic `track(event: string, props?: Record<string,unknown>)`** helper in `app/lib/analytics.ts` — no-op/`console.debug` when no backend configured; designed so a backend (CF Zaraz / Plausible / Umami) can be wired later WITHOUT touching call sites. **Wire `track()` at the 4 core events:** search run (`runQuery` in RepoRadarApp), tag picked (HeaderControls/tag select), deploy clicked (deploy action), alert signup (notifications subscribe). The events BACKEND choice is a follow-up product decision — flag it; the abstraction means no rework.

### Footer
- **D-13:** New `app/components/Footer.tsx`, rendered in `RepoRadarApp` AFTER the grid (around line 1082) — below the dashboard, never overlapping it. Links: Changelog, Blog, Contact, Suggest a feature, ☕ Buy us a coffee, GitHub, and the existing frozen hackathon link. On-brand via tokens. MUST NOT alter the header, cards, sliders, radar, or any frozen UI contract.

### Claude's Discretion
- Exact route-group/layout file layout, rate-limit window/bucket sizes, Prose styling details, whether changelog is a `.ts` module vs raw-imported `CHANGELOG.md` (default `.ts`).

### Human handoffs (config values only — no rework if changed)
- `CONTACT_TO` (contact recipient), `DONATION_URL` (real coffee handle), `NEXT_PUBLIC_CF_BEACON_TOKEN` (CF Web Analytics token). Document all three in `.dev.vars.example` / a note. Also: the **events analytics backend** is an open product decision (CF Zaraz vs Plausible vs Umami).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase brief
- `BUILD-BRIEF.md` — WS1 (the 6 deliverables + acceptance + out-of-scope).
- `.planning/intel/requirements.md` — `REQ-credibility-batch` acceptance criteria.

### Surfaces to EXTEND (do not duplicate) — mapped via Explore
- `app/components/FeedbackWidget.tsx` — props `{ context }`; toggle button + modal; posts `{feedback,contact,pageUrl,context}` to `/api/feedback`; status UI lines ~85–211. Add the `type` toggle here.
- `app/api/feedback/route.ts` — body fields + validation (lines 7–46), Gemini `verifyFeedback` (68–146), `createGitHubIssue` (148–173, uses `GITHUB_TOKEN`, `FEEDBACK_ISSUE_REPO`). Add `type`/label routing here.
- `app/api/deploy/route.ts` — already refactored to use `sendEmail()` (Phase 1); the contact API follows the same email call pattern.
- `app/lib/email.ts` — `sendEmail()` + `escapeHtml` (Phase 1) — the contact form's delivery path.

### Layout / footer / theme
- `app/layout.tsx` — metadata (17–27), `<body class="...bg-zinc-950...">` (34–43), `<Providers>` wrap; inject the CF beacon before `</body>`.
- `app/components/RepoRadarApp.tsx` — header (697–798, includes FeedbackWidget at 782–784 and the frozen hackathon link 738–749); grid ends ~1068–1082 → mount `<Footer/>` after it. DO NOT touch the frozen header/cards/sliders.
- `app/globals.css` — color/font tokens (lines 3–42): `--bg #06080d`, `--surface #10141b`, `--fg #fafafa`, `--fg-muted`, `--fg-dim`, `--primary #22c55e`, `--secondary #3b82f6`, `--accent #eab308`, `--font-geist-sans/mono`.

### Routing conventions
- `app/page.tsx`, `app/d/[slug]/page.tsx` — async Server Components, `params: Promise<{...}>`; API routes use `export const runtime = "nodejs"`; no existing route groups (introduce `(site)`).

### Platform docs (MANDATORY before Next-behavior changes)
- `node_modules/next/dist/docs/` — read the relevant doc for route groups, `generateStaticParams`, `dynamic = "force-static"`, and metadata before writing route code (Next 16; AGENTS.md rule).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendEmail()` / `escapeHtml` (Phase 1) → contact API.
- `FeedbackWidget` + `/api/feedback` → extend for the feature-suggestion path.
- `globals.css` tokens → all new pages/footer (no new CSS system).
- The in-memory cache/rate patterns (repos route, trendingCache) → model for the contact rate-limiter.

### Established Patterns
- Graceful degradation when a key/config is missing (translate.ts, email.ts) → contact API + analytics + donation all degrade cleanly when their config is unset.
- API routes `runtime = "nodejs"`; pages async Server Components.

### Integration Points
- `app/layout.tsx` (CF beacon), `RepoRadarApp.tsx` (Footer mount + `track()` at search/tag/deploy), notifications subscribe (`track()` alert signup), new `(site)` route group.
</code_context>

<specifics>
## Specific Ideas
- "30-day check-in" recurring blog template (commented module) per the brief.
- Footer must read as a real product footer, not a debug strip — on-brand, quiet, below the fold.
</specifics>

<deferred>
## Deferred Ideas
- MDX/file-based content pipeline + a CMS — later if content volume grows.
- RSS/feed for the blog — only if usage justifies (brief: out of scope).
- A real analytics events backend (CF Zaraz / Plausible / Umami) — product decision; `track()` abstraction is in place so wiring it later is non-breaking.
- Stripe/real donations — Phase 6.
</deferred>

---

*Phase: 02-credibility-batch-analytics*
*Context gathered: 2026-05-27 via discuss-phase --auto*
