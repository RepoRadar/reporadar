# Requirements: RepoRadar

**Defined:** 2026-05-27
**Core Value:** A builder can reliably find — and be alerted to — the most meaningful repo to build upon, and get an honest, reasoned read on whether and how to adopt it.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Prerequisites

- [x] **PRE-01
**: Prod `GITHUB_TOKEN` is a fine-scoped, app-owned token (public-repo read), not a personal `gh` token (human-supplied secret).
- [x] **PRE-02
**: `fetchTrending` caches/batches distinct tags so scheduled polling does not exhaust the rate budget; rate-limit failures traced to the shared token no longer occur.
- [x] **PRE-03
**: An email delivery provider (Resend or equivalent) is configured behind a `sendEmail()` lib; real API key is human-supplied (stub the key, build the lib + routes).

### Credibility (WS1)

- [x] **CRED-01
**: `/changelog` route renders a human-curated `CHANGELOG.md`, on-brand, linked from footer/header.
- [x] **CRED-02
**: `/blog` renders MDX/markdown posts with 1–2 "how & why we built it" posts and a "30-day check-in" template.
- [x] **CRED-03
**: Contact form + `POST /api/contact` emails the team via `sendEmail()` (or queues to D1), validated and rate-limited.
- [x] **CRED-04
**: Suggestion box extends existing `/api/feedback` + `FeedbackWidget` with a "suggest a feature" path (no duplication).
- [x] **CRED-05
**: Donation "Buy us a coffee" outbound link (Ko-fi/BMC/Stripe Payment Link); no integration.
- [x] **CRED-06
**: Privacy-respecting analytics fire pageviews + key events (search run, tag picked, deploy clicked, alert signup).

### Threshold Alerts (WS2)

- [x] **ALRT-01
**: D1 schema for `subscriptions` (email, kind, term, metric, threshold, window_days, verified_at, last_notified_at, unsub_token) and `repo_snapshots` (term, full_name, stars, captured_at).
- [x] **ALRT-02
**: Cloudflare Cron Trigger diffs distinct subscribed terms against latest snapshots over `window_days`, detects crossings, and is idempotent and rate-limit-safe.
- [x] **ALRT-03
**: On a crossing, a matched subscriber receives ONE email (repo card + why it fired); `last_notified_at` dedupes repeats; fresh snapshots are written.
- [x] **ALRT-04
**: Double opt-in (verify email) + one-click unsubscribe (`unsub_token`) + digest-vs-instant option, via `sendEmail()`.
- [x] **ALRT-05
**: Alerts UI panel to create/manage subscriptions (term + metric + threshold), list active alerts, and unsubscribe, reusing dashboard styling.

### Repo Intelligence (WS3)

- [x] **INTL-01
**: "Talk to a repo" CopilotKit chat scoped to one repo, seeded with README + file tree + RepoRadar scores, with suggested prompts; single fast model; answers real questions about that specific repo.
- [ ] **INTL-02**: Personalized adoption report (given a pasted stack/repo URL) returns structured benefit, integration difficulty, effort/time as a reasoned RANGE, risks, and an integration sketch.
- [ ] **INTL-03**: Concierge recommendation (given a pasted product description) returns a relevant, justified shortlist via `fetchTrending` + dimension scores, each with why/pros-cons/integration read — not generic top-stars.
- [ ] **INTL-04**: Proprietary pasted input is handled explicitly and not logged/retained without consent.

### Audio Overview (WS4)

- [ ] **AUDIO-01**: An "audio overview" button on a repo card generates a ~60–90s spoken overview via Gemini script → ElevenLabs TTS, with a clear loading state and bounded generation time.
- [ ] **AUDIO-02**: Audio is stored in R2 keyed by repo + content hash; repeat clicks serve the cached object; generation is cost-bounded (regenerate only on data change).

### Premium (WS5)

- [ ] **PREM-01**: Stripe Checkout + `/api/stripe/webhook` grants entitlements stored in D1; a test-mode purchase grants entitlements; webhook is idempotent.
- [ ] **PREM-02**: Entitlements gate paid surfaces (adoption report, concierge, alert count/finer thresholds, audio) server-side — in the UI AND the cron job — not UI-only; free tier = browse + talk-to-a-repo + a small number of alerts.

### Launch (WS6)

- [ ] **LNCH-01**: Launch-readiness checklist satisfied — alert hook live and dependable, changelog + about/how-we-built-it posts published, analytics in place, reliability verified (`npm run test:smoke` green + prod load-tested), screenshots/demo + a clear one-liner ready.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Repo Intelligence v2

- **INTLv2-01**: Multi-model synthesis (fast model for breadth + Opus for depth).
- **INTLv2-02**: Deeper code ingestion (embeddings/RAG over real source).
- **INTLv2-03**: "Connect your GitHub" so the product is read automatically (OAuth).

### Built-with Showcase

- **SHOW-01**: Public gallery of user-submitted "built-with" products (profiles, moderation) feeding concierge corpus + SEO.

### Audio v2

- **AUDIOv2-01**: Multi-host produced episodes + episode feed/RSS.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auth/accounts in WS1 | Credibility batch is static/simple; accounts only as needed for entitlements |
| Payments in WS1 | Donation is an outbound link only; real billing is Phase 6 |
| Comments | Not core to current value |
| SMS/push alerts | Email-only for v1 |
| Per-repo (vs per-term) alerts | Deferred to later |
| Full-source RAG / GitHub OAuth connect | Repo Intelligence v2 |
| Public "Built-with" showcase | Separate later track; concierge does not require it |
| Multiple paid tiers | Start with one tier |
| Hackathon UI changes | Header + AGENTS.md UI contracts frozen until results declared |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRE-01 | Phase 1 | Pending |
| PRE-02 | Phase 1 | Pending |
| PRE-03 | Phase 1 | Pending |
| CRED-01 | Phase 2 | Pending |
| CRED-02 | Phase 2 | Pending |
| CRED-03 | Phase 2 | Pending |
| CRED-04 | Phase 2 | Pending |
| CRED-05 | Phase 2 | Pending |
| CRED-06 | Phase 2 | Pending |
| ALRT-01 | Phase 3 | Pending |
| ALRT-02 | Phase 3 | Complete |
| ALRT-03 | Phase 3 | Complete |
| ALRT-04 | Phase 3 | Pending |
| ALRT-05 | Phase 3 | Pending |
| INTL-01 | Phase 4 | Pending |
| INTL-02 | Phase 4 | Pending |
| INTL-03 | Phase 4 | Pending |
| INTL-04 | Phase 4 | Pending |
| AUDIO-01 | Phase 5 | Pending |
| AUDIO-02 | Phase 5 | Pending |
| PREM-01 | Phase 6 | Pending |
| PREM-02 | Phase 6 | Pending |
| LNCH-01 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-27 after initial definition*
