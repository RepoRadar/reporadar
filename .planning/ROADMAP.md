# Roadmap: RepoRadar

## Overview

This milestone turns RepoRadar from a hackathon demo into a credible, retained, monetizable product. We start by laying the two prerequisites that gate everything downstream (an app-owned GitHub token and a real email-delivery lib), then make the product look maintained and measurable (credibility batch + analytics), then ship the retention hook (threshold alerts), then the premium anchor (Repo Intelligence), a lean audio overview, monetization (Stripe), and finally a public launch — built strictly in that order because each earlier workstream unlocks or derisks the next. Premium and launch come last, only after real usage data justifies them.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Prerequisites** - App-owned GitHub token + tag caching, and an email-delivery `sendEmail()` lib
- [ ] **Phase 2: Credibility Batch + Analytics** - Changelog, blog, contact, suggestion box, donation, analytics (~5 small PRs)
- [ ] **Phase 3: Threshold Alerts** - D1 subscriptions/snapshots, cron job, double opt-in email, Alerts UI (retention hook)
- [ ] **Phase 4: Repo Intelligence** - Talk-to-a-repo chat, adoption report, concierge recommendation (premium anchor)
- [ ] **Phase 5: Audio Overview** - On-demand per-repo spoken overview via Gemini → ElevenLabs → R2
- [ ] **Phase 6: Premium + Stripe** - Stripe Checkout + webhook + D1 entitlements + server-side gating
- [ ] **Phase 7: Launch Prep** - HN / Product Hunt launch readiness checklist

## Phase Details

### Phase 1: Prerequisites
**Goal**: The infrastructure that gates the alerts workstream is in place — a dedicated, rate-safe GitHub token and a real email-delivery path.
**Depends on**: Nothing (first phase)
**Requirements**: PRE-01, PRE-02, PRE-03
**Success Criteria** (what must be TRUE):
  1. `fetchTrending` runs on an app-owned, fine-scoped token (not a personal `gh` token), with distinct tags cached/batched so scheduled polling stays within the rate budget. (Minting the secret is a human handoff — code + config land; the executor flags where the owner must supply the token.)
  2. A `sendEmail()` lib exists and can deliver real email through a configured provider (Resend or equivalent); the real API key is a human-supplied secret, so the lib + routes build and pass with the key stubbed.
  3. Existing repo browsing/search keeps working unchanged — no regression from the token swap or caching.
**Plans**: 2 plans
- [ ] 01-01-PLAN.md — sendEmail() lib (Resend) + refactor deploy route to use it (PRE-03)
- [ ] 01-02-PLAN.md — fetchTrendingCached() cache+coalesce wrapper + repos-route refactor + .dev.vars.example env contract (PRE-01, PRE-02)
**Human handoff**: PRE-01 prod token and PRE-03 provider API key are owner-only secrets — the autonomous executor stops at a green PR with clearly flagged stubs.

### Phase 2: Credibility Batch + Analytics
**Goal**: RepoRadar looks like a real, maintained product and its core actions are measurable — shipped as ~5 small, independent PRs.
**Depends on**: Phase 1 (contact form uses `sendEmail()`)
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05, CRED-06
**Success Criteria** (what must be TRUE):
  1. A visitor can open `/changelog` and `/blog` (with 1–2 "how & why we built it" posts), each on-brand and linked from footer/header.
  2. A visitor can submit the contact form and the team receives a real email (via `sendEmail()`); submissions are validated and rate-limited.
  3. A visitor can suggest a feature through the existing FeedbackWidget's "suggest a feature" path (not a duplicate widget), and can follow a "Buy us a coffee" donation link out.
  4. Analytics records pageviews and fires on the core events (search run, tag picked, deploy clicked, alert signup).
  5. The dashboard is not regressed and the hackathon-frozen UI contracts are intact.
**Plans**: 5 plans
- [ ] 02-01-PLAN.md — (site) route group + Prose + bundled content + static /changelog, /blog, /blog/[slug] (CRED-01, CRED-02)
- [ ] 02-02-PLAN.md — /contact static page + POST /api/contact (validated, rate-limited, sendEmail) (CRED-03)
- [ ] 02-03-PLAN.md — extend FeedbackWidget + /api/feedback with a feature-suggestion type path (CRED-04)
- [ ] 02-04-PLAN.md — on-brand Footer + donation link + nav links, mounted after the grid (CRED-05)
- [ ] 02-05-PLAN.md — CF Web Analytics beacon + provider-agnostic track() wired at 4 core events (CRED-06)
**UI hint**: yes

### Phase 3: Threshold Alerts
**Goal**: A user can subscribe to a tag/search term with a growth threshold and reliably get exactly one email when a repo crosses it — turning browse into a habit.
**Depends on**: Phase 1 (needs the dedicated token AND `sendEmail()`)
**Requirements**: ALRT-01, ALRT-02, ALRT-03, ALRT-04, ALRT-05
**Success Criteria** (what must be TRUE):
  1. A user can create an alert in the Alerts UI (term + metric + threshold), see it listed as active, and manage/remove it, reusing dashboard styling.
  2. A new subscriber must confirm via double opt-in before alerts fire, and can unsubscribe in one click via the `unsub_token`.
  3. On a real crossing (or a seeded fixture), the matched subscriber receives ONE email containing the right repo card and why it fired — verified end-to-end, not just via the API.
  4. The Cron Trigger dedupes distinct terms, diffs against snapshots over `window_days`, is idempotent (no repeat alerts via `last_notified_at`), writes fresh snapshots, and stays within GitHub rate limits.
  5. Tests exist at both the API and scheduled-handler level.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Repo Intelligence
**Goal**: RepoRadar shifts from "find repos" to "decide, adopt, and improve" via three surfaces — a free talk-to-a-repo chat and two paid analysis products — with honest, reasoned output.
**Depends on**: Phase 3 (built after the retention hook proves engaged users)
**Requirements**: INTL-01, INTL-02, INTL-03, INTL-04
**Success Criteria** (what must be TRUE):
  1. A user can chat with a single repo (seeded with README + file tree + RepoRadar scores) and get answers that are accurate to that specific repo, with helpful suggested prompts.
  2. A user who pastes their stack/repo URL gets an adoption report with accurate benefit, integration difficulty, effort/time as a reasoned RANGE, risks, and a concrete integration sketch — not false precision.
  3. A user who describes their product (e.g. "blogcast.io") gets a relevant, justified shortlist with honest pros/cons and integration reads — not a generic top-stars list.
  4. Proprietary pasted input is handled explicitly and is not logged/retained without consent.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Audio Overview
**Goal**: A user can get a fast, accurate spoken overview of any repo from its card, cached so it costs little to serve.
**Depends on**: Phase 4
**Requirements**: AUDIO-01, AUDIO-02
**Success Criteria** (what must be TRUE):
  1. Clicking "audio overview" on a card produces, within a few seconds and with a clear loading state, playable audio that accurately describes that repo (what it is, its dimension profile, why it stands out).
  2. Repeat clicks serve the cached R2 object (keyed by repo + content hash); audio regenerates only when the repo's data changes, keeping generation cost-bounded.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Premium + Stripe
**Goal**: RepoRadar can take payment and enforce a free/paid boundary server-side, gating the high-cost paid surfaces.
**Depends on**: Phase 4 and Phase 5 (the paid products must exist and have engaged users first)
**Requirements**: PREM-01, PREM-02
**Success Criteria** (what must be TRUE):
  1. A test-mode Stripe Checkout purchase results in entitlements stored in D1 via an idempotent `/api/stripe/webhook`.
  2. Paid surfaces (adoption report, concierge, alert count/finer thresholds, audio) are gated by entitlements server-side — in both the UI and the cron job — while the free tier still allows browse + talk-to-a-repo + a small number of alerts.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Launch Prep
**Goal**: RepoRadar is genuinely ready for a Hacker News + Product Hunt launch — reliable, credible, and clearly described.
**Depends on**: Phase 3 (and a solid Phase 4); Phases 5–6 strengthen it
**Requirements**: LNCH-01
**Success Criteria** (what must be TRUE):
  1. The launch-readiness checklist is satisfied: alert hook live and dependable, changelog + about/how-we-built-it posts published, analytics in place.
  2. Reliability is verified: `npm run test:smoke` is green and prod has been load-tested.
  3. Launch assets are ready: screenshots/demo and a clear one-liner.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Prerequisites | 0/2 | Not started | - |
| 2. Credibility Batch + Analytics | 0/5 | Not started | - |
| 3. Threshold Alerts | 0/TBD | Not started | - |
| 4. Repo Intelligence | 0/TBD | Not started | - |
| 5. Audio Overview | 0/TBD | Not started | - |
| 6. Premium + Stripe | 0/TBD | Not started | - |
| 7. Launch Prep | 0/TBD | Not started | - |
