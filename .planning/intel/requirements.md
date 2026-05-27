# Requirements

Synthesized scoped requirements. The source BUILD-BRIEF.md is typed SPEC but carries
PRD-flavored workstream goals and acceptance criteria; per ingest instruction the workstreams
are captured as scoped requirements with their stated acceptance criteria.

---

## PRE-github-token (prerequisite — before WS2)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (Prerequisites § A)
- scope: GitHub trending fetch (`app/lib/github.ts` `fetchTrending`), prod `GITHUB_TOKEN` secret
- description:
  Replace the personal `gh` token in the prod `GITHUB_TOKEN` secret with a fine-scoped,
  app-owned token (public-repo read is sufficient). Add caching/batching of distinct tags so
  scheduled polling does not exhaust a human's rate budget.
- acceptance:
  - Prod `GITHUB_TOKEN` is an app-owned, fine-scoped token (not Christo's personal token).
  - Distinct tags are cached/batched; rate-limit failures traced to the shared token no longer occur.

## PRE-email-provider (prerequisite — before WS2)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (Prerequisites § B)
- scope: email delivery (`sendEmail()` lib, Resend or equivalent)
- description:
  Pick an email delivery provider (Resend simplest on Workers), add an API-key secret, and a
  small `sendEmail()` lib. Notifications v1 currently sends only a dummy payload.
- acceptance:
  - A real provider is configured with a secret API key.
  - `sendEmail()` lib delivers real email used by downstream workstreams (WS1 contact, WS2 alerts).

## REQ-credibility-batch (WS1)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS1)
- scope: /changelog, /blog, contact form, suggestion box, donation link, analytics
- description:
  Ship ~5 small PRs that make RepoRadar look like a real, maintained product, all on-brand
  (dark theme + `globals.css` tokens):
  - /changelog route rendering a human-curated `CHANGELOG.md` (or derived from merged PR titles).
  - /blog with MDX/markdown posts; ship 1–2 "how & why we built it" posts; plan a recurring
    "30-day check-in" template.
  - Contact form: route + `POST /api/contact` that emails the team via `sendEmail()` (or queues
    to D1). Validate + rate-limit.
  - Suggestion box: EXTEND existing `/api/feedback` + `FeedbackWidget` with a "suggest a feature"
    path; do not duplicate.
  - Donation link: simple "Buy us a coffee" outbound link (Ko-fi/BMC/Stripe Payment Link); no
    integration yet.
  - Analytics: privacy-respecting, free, on-brand (Cloudflare Web Analytics or Plausible/Umami);
    capture pageviews + key events (search run, tag picked, deploy clicked, alert signup).
- acceptance:
  - Each route renders, is linked from footer/header, matches the theme, does not regress the dashboard.
  - Analytics events fire on the core actions.
- out_of_scope: auth, payments, comments.

## REQ-threshold-alerts (WS2)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS2)
- scope: D1 subscriptions + repo_snapshots, Cloudflare Cron Trigger, email delivery, Alerts UI
- description:
  Let a user subscribe to a tag or search term with a growth threshold and receive an email
  when a repo crosses it (e.g. ">20% stars/week" or "passes 1k stars"). Build on notifications
  v1; replace in-memory/dummy with real persistence + delivery.
  - Data (D1): `subscriptions(id, email, kind['topic'|'query'], term, metric['stars_pct'|'stars_abs'|'velocity'],
    threshold, window_days, created_at, verified_at, last_notified_at, unsub_token)`;
    `repo_snapshots(term, full_name, stars, captured_at)` for growth baselines.
  - Scheduled job (Cloudflare Cron Trigger in `wrangler.jsonc`): for each DISTINCT subscribed
    term (dedupe), call `fetchTrending` with the dedicated token, diff against latest snapshot
    over `window_days`, detect crossings, send email (repo card + why it fired) for matched
    subscriptions, set `last_notified_at` to dedupe repeats, write fresh snapshots. Batch / cache /
    back off on GitHub limits; never block on slow upstream.
  - Delivery: double opt-in (verify email), one-click unsubscribe (`unsub_token`), digest vs.
    instant option, via `sendEmail()`.
  - UI: "Alerts" panel to create/manage subscriptions (term + metric + threshold), list active
    alerts, unsubscribe. Reuse dashboard styling.
- acceptance:
  - Verify end-to-end (not just API): subscribe → verify email → on a real crossing (or seeded
    fixture) an email arrives ONCE with the right repo; unsubscribe stops it; cron job is
    idempotent and stays within rate limits.
  - Tests at both the API and scheduled-handler level.
- out_of_scope: SMS/push, per-repo (vs per-term) alerts.

## REQ-repo-intelligence (WS3)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS3)
- scope: CopilotKit chat, fetchTrending search, 10 dimension scores, GitHub API repo content
- description:
  Shift RepoRadar from "find repos" to "decide, adopt, and improve" via three surfaces:
  1. Talk to a repo (free funnel): CopilotKit chat scoped to one repo, seeded with README +
     file tree + RepoRadar scores; suggested prompts; single fast model.
  2. Personalized adoption report (paid): user pastes their stack (and optionally their repo URL);
     return a structured report — benefit to them, integration difficulty, effort/time as a
     reasoned RANGE, risks, concrete integration sketch.
  3. Concierge recommendation (paid; apex): user describes their product; recommend the repos
     that most enhance it, each with why + pros/cons + integration read. Derive product needs →
     search/rank candidates via `fetchTrending` + dimension scores → per-candidate mini-fit →
     curated honest shortlist.
  Model tiering: free chat = one fast model; paid report/concierge = two models in tandem
  (fast for breadth + Opus for depth) synthesized.
  Phasing: v1 = report + concierge from README/metadata/file-tree/key-files + pasted product/stack,
  single strong model, effort as a range, shallow GitHub API (no full clone). v2 = multi-model
  synthesis, deeper code ingestion (embeddings/RAG), "connect your GitHub".
  Adjacent/later: "Built-with" public showcase (UGC) as its own track; concierge does not require it.
- acceptance:
  - Verify OUTPUT, not just that it ran: chat answers real questions about the specific repo;
    report (given a sample stack) returns accurate fit/difficulty/effort/risks/sketch with sane
    ranges; concierge (e.g. "blogcast.io") returns a relevant, justified shortlist with honest
    pros/cons (not generic top-stars); multi-model output is coherently synthesized;
    proprietary input not persisted without consent.
- out_of_scope (v1): full-source RAG, GitHub OAuth connect, public showcase, team seats.

## REQ-audio-overview (WS4)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS4)
- scope: Gemini script generation, ElevenLabs TTS, R2 audio caching, repo card inline player
- description:
  Lean "podcast": a button on a repo card generates a short (~60–90s) spoken overview of that
  repo (what it is, its RepoRadar dimension profile, why it stands out). Gemini generates the
  script → ElevenLabs TTS (`ELEVENLABS_API_KEY`) → store audio in R2 keyed by repo + content
  hash → inline player on the card. Cache aggressively (regenerate only on data change); show a
  clear loading state; bound generation time.
- acceptance:
  - Click "audio overview" → within a few seconds, playable audio that accurately describes
    that repo; repeat clicks serve the cached R2 object; cost-bounded.
- out_of_scope: multi-host produced episodes, episode feed/RSS (only if usage justifies).

## REQ-premium-stripe (WS5)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS5)
- scope: Stripe Checkout + webhook, D1 entitlements, UI + cron gating
- description:
  Monetize. Primary paid products are the WS3 adoption report + concierge; also gate alert
  count / finer thresholds + audio overviews. Free tier: browse + talk-to-a-repo chat + a small
  number of alerts. Build Stripe Checkout + webhook (`/api/stripe/webhook`) → entitlements in
  D1 → gate alert count / audio in the UI and the cron job. One paid tier to start. Do NOT build
  billing before people are already trying to pay.
- acceptance:
  - A test-mode purchase grants entitlements; gating enforced server-side (not just UI);
    webhook idempotent.

## REQ-launch-prep (WS6)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS6)
- scope: launch readiness across alerts, content, analytics, reliability, assets
- description:
  HN + Product Hunt launch prep, only when WS1–WS3 are solid and reliable. Checklist: alert
  hook live and dependable; changelog + about/how-we-built-it posts published; analytics in
  place; reliability verified (`npm run test:smoke` green, prod load-tested); screenshots/demo
  ready; a clear one-liner.
- acceptance:
  - All checklist items satisfied; launch only when genuinely useful.
