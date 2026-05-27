# RepoRadar — Build Brief (next milestone)

A self-contained brief to tee up the next wave of work. Hand the **whole file** to a
planning session, or hand a **single workstream block** to one agent. Every workstream
is written to be executed independently on its own branch.

---

## 0. Context the builder must load first

**What RepoRadar is:** a dashboard that surfaces trending GitHub repos as agent-rendered,
scored cards. You tune 10 weighted dimensions (sliders + a draggable radar hex), filter by
sort priority, search by tag or freeform text, and deploy a bespoke generative-UI surface
for any repo. Tagline: "Find the most meaningful repo to build upon as efficiently as possible."

**Stack (verify against the repo, don't assume from training data):**
- Next.js **16** (App Router, Turbopack). ⚠ Read the relevant doc under
  `node_modules/next/dist/docs/` before changing any Next behavior — this version has
  breaking changes. (`AGENTS.md` enforces this.)
- Deployed to **Cloudflare Workers via OpenNext** (`@opennextjs/cloudflare`, `wrangler.jsonc`).
  `npm run deploy` builds + deploys; `npx wrangler rollback <version-id>` reverts.
- **CopilotKit** chat/actions; **Gemini** (`GOOGLE_API_KEY`) for description translation;
  **ElevenLabs** (`ELEVENLABS_API_KEY`) already wired for TTS.
- Cloudflare bindings available: **R2** (`reporadar-opennext-cache`), **D1** (used by the
  per-deploy surfaces), Images, a self-reference Worker. A separate deploy Worker lives in
  `workers/deploy`.

**What already shipped (don't rebuild):** shareable search URLs (`?topic`/`?q`/`?sort`/`?window`,
`app/lib/shareUrl.ts`), SSR data caching, single-select tags + center "Loading…" state,
stale-result guard + bounded GitHub/translation fetches, tuning re-rank pulse. There's a
**notifications v1** scaffold (`app/api/notifications/subscribe` + `tests/notifications.spec.ts`)
that currently stores in-memory and sends a *dummy* email — the alerts workstream builds on it.
There's a **feedback intake** feature (`app/api/feedback`, `FeedbackWidget`) — the suggestion
box should extend it, not duplicate it.

**Key files/patterns to reuse:**
- `app/lib/github.ts` — `fetchTrending` (5-tier search, bounded by one `AbortSignal.timeout`,
  uses `GITHUB_TOKEN` when present; fail-fast). **Prod currently uses Christo's personal `gh`
  token — see Prerequisite A.**
- `app/api/repos/route.ts` — in-memory cache + `s-maxage`/SWR headers + **bounded** translation.
- `app/components/RepoRadarApp.tsx` — central state, `runQuery` (request-sequenced + 15s
  timeout + error/retry state), loading/empty/error render branches, `tuneWeights`/`tunePriorities`.
- `app/lib/translate.ts` — batched Gemini translation, module-cached, script-detect skip.

**Governance / operating rules (NON-NEGOTIABLE):**
1. Each workstream on its own branch off `main` → **PR** → green gates → **board review**
   (Christo / Craig / Priyanshu) → **human-gated deploy**. Agents do **not** auto-merge or deploy.
2. Gates before PR: `npm run build` clean (TS passes); `npx eslint <changed files>` adds **no
   new** errors (2 pre-existing `set-state-in-effect` in `RepoRadarApp.tsx` are baseline);
   relevant Playwright green.
3. **Verify results, not mechanics.** For anything touching search/query/UI, confirm the
   rendered output matches the input (type real queries, click real controls) — not just that
   a URL/flag/state changed. (See `AGENTS.md` → Verification Expectations.)
4. **Prod is on Cloudflare with per-isolate caches + a rate-limited GitHub token.** A clean
   local build can still 500/stall in prod (it has, twice). Always: build → deploy → hammer
   the live route → be ready to `wrangler rollback`. Prod smoke suite: `npm run test:smoke`
   (prod-only, `workers: 2`); local feature tests via `playwright.local.config.ts`.
5. **Hackathon freeze:** keep the "AI Tinkerers Generative UI Hackathon" header + the UI
   contracts in `AGENTS.md` intact until results are declared; ship only changes that improve
   real users / the demo.

**Sequencing (build in this order — earlier unlocks/derisks later):**
WS1 credibility batch + analytics → WS2 threshold alerts (retention hook) →
WS3 Repo Intelligence (premium anchor) → WS4 on-demand per-repo audio →
WS5 premium + Stripe → WS6 HN/PH launch.
Premium and the public launch come **last, after real usage data** justifies them.

---

## Prerequisites (do before WS2)

**A. Dedicated GitHub token.** Replace the personal `gh` token in the prod `GITHUB_TOKEN`
secret with a **fine-scoped, app-owned token** (public-repo read is enough). The alerts job
polls GitHub on a schedule for many tags — it must not share a human's rate budget. Add
caching/batching of distinct tags. (Today's rate-limit failures trace to the shared token.)

**B. Email delivery provider.** Pick one (Resend is simplest on Workers), add an API-key
secret, and a small `sendEmail()` lib. Notifications v1 only sends a dummy payload today.

---

## WS1 — Credibility batch + analytics  *(light; ship first, as ~5 small PRs)*

**Goal:** make RepoRadar look like a real, maintained product before any launch. Each item is
small; keep them static/simple and on-brand (match existing dark theme + `globals.css` tokens).

- **/changelog** — render a `CHANGELOG.md` (or derive from merged PR titles) at a `/changelog`
  route. Keep it human-curated.
- **/blog** — MDX (or simple markdown) posts under `/blog`; ship 1–2 "how & why we built it"
  posts. Plan a recurring "30-day check-in" post template.
- **Contact form** — a route + `POST /api/contact` that emails the team via the WS-prereq
  `sendEmail()` (or queues to D1). Validate + rate-limit.
- **Suggestion box** — **extend the existing `/api/feedback` + `FeedbackWidget`**, don't
  duplicate. Add a clearly-labeled "suggest a feature" path.
- **Donation link** — a simple "Buy us a coffee" link (Ko-fi/BMC, or a Stripe Payment Link).
  Just an outbound link for now; no integration.
- **Analytics** — privacy-respecting + free + on-brand: **Cloudflare Web Analytics** (or
  Plausible/Umami). Capture pageviews + key events (search run, tag picked, deploy clicked,
  alert signup). You can't tune or price what you can't measure — do this now.

**Acceptance:** each route renders, is linked from the footer/header, matches the theme, and
doesn't regress the dashboard. Analytics events fire on the core actions.
**Out of scope:** auth, payments, comments.

---

## WS2 — Threshold alerts  *(the retention hook — biggest lift; own milestone)*

**Goal:** a user subscribes to a tag or search term with a growth threshold and gets an email
when a repo crosses it (e.g., "alert me when a **hermes** repo gains **>20% stars/week**" or
"a new repo on **openclaw** passes **1k stars**"). Turns RepoRadar from browse → habit.

**Build on** notifications v1 (`app/api/notifications/subscribe`, `tests/notifications.spec.ts`)
but replace in-memory/dummy with real persistence + delivery.

**Data (D1):**
- `subscriptions(id, email, kind['topic'|'query'], term, metric['stars_pct'|'stars_abs'|'velocity'],
  threshold, window_days, created_at, verified_at, last_notified_at, unsub_token)`
- `repo_snapshots(term, full_name, stars, captured_at)` — baselines for growth deltas.

**Scheduled job (Cloudflare Cron Trigger in `wrangler.jsonc`):**
- For each **distinct** subscribed term (dedupe!), call `fetchTrending` with the dedicated
  token, diff against the latest snapshot to compute growth over `window_days`, detect
  crossings, and for matched subscriptions send an email (the repo card + why it fired), then
  set `last_notified_at` to **dedupe** repeat alerts. Write fresh snapshots.
- Respect GitHub limits: batch distinct terms, cache, back off. Never block on a slow upstream.

**Delivery:** double opt-in (verify email), one-click unsubscribe (`unsub_token`), digest vs.
instant option. Use the WS-prereq `sendEmail()`.

**UI:** extend the signup into an "Alerts" panel — create/manage subscriptions, pick term +
metric + threshold, list active alerts, unsubscribe. Reuse dashboard styling.

**Acceptance (verify end-to-end, not just the API):** subscribe → verify email → when a real
crossing occurs (or a seeded fixture) an email arrives **once** with the right repo; unsubscribe
stops it; the cron job is idempotent and stays within rate limits. Add tests at both the API
and the scheduled-handler level.
**Out of scope:** SMS/push, per-repo (vs per-term) alerts (later).

---

## WS3 — Repo Intelligence: analyze & recommend repos against the user's product  *(the premium anchor — build after WS2)*

**Goal:** shift RepoRadar from "find repos" to "decide, adopt, and improve." This is the moat
and the primary paid product. Three surfaces, increasingly valuable, all reusing what we have
(CopilotKit chat, `fetchTrending` search, the 10 dimension scores):

1. **Talk to a repo** *(free funnel)* — chat scoped to one repo with suggested prompts ("how
   would I integrate this?", "gotchas?", "learning curve?"). Reuse CopilotKit; seed a thread
   with the repo's README + file tree + its RepoRadar scores. Single fast model.

2. **Personalized adoption report** *(paid)* — the user pastes their current stack (and
   optionally their own repo URL); we return a structured report on **how this specific repo
   benefits them, integration difficulty, effort/time (a reasoned RANGE, not false precision),
   risks, and a concrete integration sketch.**

3. **Concierge recommendation** *(paid; the apex)* — the reverse of #2: the user describes their
   product ("I built blogcast.io — here's what it does / my stack") and we **recommend the
   repos that would most enhance it**, each with **why, pros/cons, and an integration read.**
   It's the report run in reverse: derive the product's needs → search/rank candidates via
   `fetchTrending` + the dimension scores → generate a per-candidate mini-fit → return a
   curated, honest shortlist. Ties the whole product together (discovery + scoring + report)
   and is the highest-value thing we can sell.

**Model tiering:** free chat = one fast model. Paid report/concierge = **two models in tandem**
(a fast model for breadth + Opus for depth) → **synthesized**. Multi-model is cost+latency, so
reserve it for the paid artifacts.

**Phase it:**
- **v1:** report + concierge from README/metadata/file-tree/key-files + the user's **pasted**
  product/stack description; single strong model; effort as a reasoned range. Repo content via
  the GitHub API (shallow — no full clone).
- **v2:** multi-model synthesis; deeper code ingestion (embeddings/RAG over real source);
  "connect your GitHub" so it reads the user's product automatically.

**Adjacent / later — "Built-with" showcase (UGC):** let people publicly post what they built;
those products become a public gallery (community + SEO + marketing) **and** a corpus that
sharpens concierge recommendations. Bigger surface (profiles, moderation) — its own track once
the private concierge proves out; the concierge does NOT require public posting to work.

**Hard constraints:**
- **Recommendations/estimates are directional and honest** — lead with reasoning + pros/cons,
  present effort/time as ranges with rationale; hype-y or wrong recs kill trust instantly.
- **Privacy:** users paste proprietary product/stack details — be explicit about handling; do
  not log/retain without consent (trust-critical, especially for paid/team use).
- **Cost must be metered/paid** — deep + multi-model analysis has real per-call cost; gate it.

**Acceptance (verify the OUTPUT, not just that it ran):** chat answers real questions about the
specific repo; the report (given a sample stack) returns accurate fit/difficulty/effort/risks/
sketch with sane ranges; the concierge (given a sample product like "blogcast.io") returns a
relevant, justified shortlist with honest pros/cons — not generic top-stars; multi-model output
is coherently synthesized; proprietary input isn't persisted without consent.
**Out of scope (v1):** full-source RAG, GitHub OAuth connect, the public showcase, team seats.

---

## WS4 — On-demand per-repo audio overview  *(lean "podcast")*

**Goal:** the leanest version of the podcast idea — a button on a repo card generates a short
spoken overview of *that* repo (what it is, its RepoRadar dimension profile, why it stands out).
Personalized + tied to existing cards; no produced series, no content treadmill.

**Build:** LLM generates a ~60–90s script from the repo's metadata + scores (Gemini, already
wired) → **ElevenLabs TTS** (`ELEVENLABS_API_KEY`, already present) → store the audio in **R2**,
keyed by repo + a content hash → inline player on the card. Cache aggressively (regenerate only
when the repo's data changes). Show a clear loading state; bound the generation time.

**Acceptance:** click "audio overview" on a card → within a few seconds, playable audio that
accurately describes that repo; repeat clicks serve the cached R2 object; cost-bounded.
**Out of scope:** multi-host produced episodes, an episode feed/RSS — only if usage justifies it.

---

## WS5 — Premium + Stripe  *(LATER — only after WS2/WS3 have engaged users)*

**Goal:** monetize. The **WS3 adoption report + concierge** are the primary paid products;
also gate alert count/finer thresholds + audio overviews. Free tier: browse + talk-to-a-repo
chat + a small number of alerts. **Do not build billing before people are already trying to pay.**

**Build:** Stripe Checkout + a webhook (`/api/stripe/webhook`) → entitlements in D1 → gate
alert count / audio in the UI + the cron job. Keep it simple (one paid tier to start).
**Acceptance:** a test-mode purchase grants entitlements; gating enforced server-side (not just
UI); webhook idempotent.

---

## WS6 — Launch prep (Hacker News + Product Hunt)  *(LAST)*

Only when WS1–WS3 are solid and reliable. Checklist: the alert hook is live and dependable;
changelog + about/how-we-built-it posts published; analytics in place; reliability verified
(`npm run test:smoke` green; prod load-tested); screenshots/demo ready; a clear one-liner. HN is
unforgiving — launch when it's genuinely useful, not before.

---

## Definition of done (every workstream)
Build + lint clean (no new issues) · relevant tests green (results verified, not just
mechanics) · on its own branch → PR → board-reviewed → human-deployed → verified live with a
rollback ready · no regression to shipped features or the hackathon-frozen UI contracts.
