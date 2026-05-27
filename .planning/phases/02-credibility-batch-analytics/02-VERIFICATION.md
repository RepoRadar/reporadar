---
phase: 02-credibility-batch-analytics
verified: 2026-05-27T10:45:00Z
status: human_needed
score: 5/5 must-haves verified (automated checks)
overrides_applied: 0
human_verification:
  - test: "Open /changelog in a browser and confirm it renders curated content on-brand (dark theme, green links, mono timestamps) with no white flash"
    expected: "Changelog page loads with dark background, green/blue token colors, Prose-rendered markdown sections"
    why_human: "Visual rendering and theming can only be confirmed in-browser"
  - test: "Open /blog, click both posts, confirm on-brand rendering, correct dates, and full body text"
    expected: "Blog list shows 2 posts with date in secondary blue. Each post page renders full markdown body via Prose"
    why_human: "Visual rendering quality and content completeness require a browser pass"
  - test: "Submit the /contact form with valid data while CONTACT_TO is unset; then supply a real CONTACT_TO and confirm an email is received"
    expected: "With no CONTACT_TO: 200 + queued toast. With CONTACT_TO set and RESEND_API_KEY: email received with correct sender/subject/reply-to"
    why_human: "Email delivery requires live environment with CONTACT_TO and RESEND_API_KEY configured (owner handoff)"
  - test: "Click 'Suggest a feature' in the Footer; confirm FeedbackWidget opens in Suggest mode, not Review mode"
    expected: "Widget opens with 'Suggest a feature' toggle selected and feature-framed placeholder copy"
    why_human: "CustomEvent dispatch and widget UI state require browser interaction to verify"
  - test: "Click 'Buy us a coffee' in the Footer; confirm it opens in a new tab at the configured donation URL"
    expected: "Opens ko-fi.com/reporadar (or NEXT_PUBLIC_DONATION_URL override) in a new tab"
    why_human: "Outbound link navigation requires browser verification; real handle is a human handoff"
  - test: "In dev, run a search (TYPE), pick a tag (TAGS panel or card chip), click Deploy, and subscribe to alerts; confirm [track] console lines appear for all 4 events"
    expected: "Console shows: [track] search_run {…}, [track] tag_picked {…}, [track] deploy_clicked {…}, [track] alert_signup {…}"
    why_human: "track() fires console.debug in dev only; confirming all 4 wiring points requires exercising each UI path"
  - test: "Scroll to the Footer on the dashboard and confirm it does not overlap any card, slider, or the radar; check on mobile viewport too"
    expected: "Footer renders below the grid, fully below all dashboard content, with no positional overlap"
    why_human: "Layout overlap can only be confirmed visually in-browser, especially on narrow viewports"
---

# Phase 2: Credibility Batch + Analytics Verification Report

**Phase Goal:** RepoRadar looks like a real, maintained product and its core actions are measurable — shipped as ~5 small, independent PRs.
**Verified:** 2026-05-27T10:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A visitor can open /changelog and /blog (with 1–2 "how & why" posts), each on-brand and linked from footer/header | ✓ VERIFIED (code) | `export const dynamic = "force-static"` on all 4 pages; `/changelog` imports `changelog` from `app/content/changelog.ts` (63 lines of real markdown); `/blog` renders `posts` array from index.ts (2 real posts: `why-we-built-reporadar.ts` 60 lines, `how-reporadar-scores-repos.ts` 115 lines); `generateStaticParams` pre-renders both post slugs; Footer links Changelog + Blog. Visual quality: human needed. |
| 2 | A visitor can submit the contact form and the team receives a real email via sendEmail(); validated and rate-limited | ✓ VERIFIED (code) | `app/api/contact/route.ts` imports `sendEmail`/`escapeHtml` from `app/lib/email.ts`; validates name (1–120), email (regex), message (1–4000); in-memory fixed-window rate limiter (5 req/60 s); escapeHtml on all fields; CONTACT_TO unset → 200+queued (never 500); provider exception → 200+queued. Email delivery requires live env: human needed. |
| 3 | A visitor can suggest a feature via FeedbackWidget's "suggest a feature" path and follow a "Buy us a coffee" donation link | ✓ VERIFIED (code) | `FeedbackWidget.tsx`: `OPEN_EVENT = "reporadar:open-feedback"`, useEffect listener sets mode from `detail.type`; segmented toggle "Review / Suggest a feature" wired; `type: mode` in POST body. `app/api/feedback/route.ts`: `type === "feature"` routes to feature Gemini instruction + `feature-request` label (both LLM and fallback paths). `Footer.tsx`: donation `<a>` href=`DONATION_URL` (env-override, placeholder `https://ko-fi.com/reporadar`); "Suggest a feature" `<button>` dispatches `reporadar:open-feedback` with `{type:"feature"}`. Browser verification needed for both paths. |
| 4 | Analytics records pageviews and fires on the core events (search run, tag picked, deploy clicked, alert signup) | ✓ VERIFIED (code) | `app/lib/analytics.ts`: `track()` function, no-op in prod, `console.debug` in dev; `typeof window` guard. `app/layout.tsx`: `Script` with `strategy="afterInteractive"` rendered only when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set (env-gated). `RepoRadarApp.tsx` runQuery: label `"tag: "` → `track("tag_picked")`, label `"ask: "`/`"voice: "` → `track("search_run")`. `DeployForm.tsx` line 66: `track("deploy_clicked", {repo})`. `NotificationSignup.tsx` line 97: `track("alert_signup", {sources})`. All 4 wired. Prod no-op until backend chosen (documented intentional deferred decision). |
| 5 | The dashboard is not regressed and the hackathon-frozen UI contracts are intact | ✓ VERIFIED (code) | `RepoRadarApp.tsx` Phase 2 changes are strictly additive: commit f8f421e = 3 lines added (1 import + `<Footer />`); commit e1b8e2a = 18 lines added (imports + track calls). Header text "AI Tinkerers Generative UI Hackathon · 5/10/26" at lines 750–761 unchanged. Hackathon URL `https://sf.aitinkerers.org/hackathons/h_FZX7ihFWcHA/handbook` unchanged. Footer mounts at line 1083, after `</main>` and before `<CopilotPopup>`. No fs.readFileSync in any content/page file. Visual non-overlap: human needed. |

**Score:** 5/5 truths verified (code); 7 items routed to human verification

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/content/changelog.ts` | Curated changelog markdown string | ✓ VERIFIED | 63 lines, exports `changelog` string |
| `app/content/blog/index.ts` | BlogPost type + posts array | ✓ VERIFIED | 31 lines, exports `posts: BlogPost[]` with 2 entries |
| `app/content/blog/why-we-built-reporadar.ts` | Founding post (why + hackathon origin) | ✓ VERIFIED | 60 lines, real body markdown |
| `app/content/blog/how-reporadar-scores-repos.ts` | 10-dimension scoring post | ✓ VERIFIED | 115 lines, real body markdown |
| `app/content/blog/_template-30-day-checkin.ts` | Commented recurring template (not in posts array) | ✓ VERIFIED | Exists; intentionally excluded from index |
| `app/(site)/layout.tsx` | Shared article layout, dark theme, back-link | ✓ VERIFIED | Uses `var(--bg)`/`var(--fg)` tokens; `<Link href="/">← RepoRadar</Link>` |
| `app/(site)/_components/Prose.tsx` | react-markdown Server Component, on-brand | ✓ VERIFIED | Full components map (h1-h4, p, a, ul, ol, li, blockquote, code, pre, hr, table/th/td); no `use client`; no rehype-raw |
| `app/(site)/changelog/page.tsx` | `force-static`, imports changelog, renders via Prose | ✓ VERIFIED | All three conditions met |
| `app/(site)/blog/page.tsx` | `force-static`, maps posts to list | ✓ VERIFIED | All conditions met |
| `app/(site)/blog/[slug]/page.tsx` | `force-static`, `dynamicParams=false`, `generateStaticParams`, `generateMetadata` | ✓ VERIFIED | All conditions met; Next 16 `params: Promise<{slug}>` pattern |
| `app/(site)/contact/page.tsx` | `force-static`, renders ContactForm | ✓ VERIFIED | ContactForm imported and rendered in surface card |
| `app/(site)/_components/ContactForm.tsx` | `"use client"`, status machine, posts to /api/contact | ✓ VERIFIED | Status: idle/sending/sent/queued/error; client-side validation; `aria-live="polite"` |
| `app/api/contact/route.ts` | `runtime="nodejs"`, validation, rate-limit, sendEmail | ✓ VERIFIED | All elements present and wired |
| `app/components/FeedbackWidget.tsx` | Segmented toggle + external open hook | ✓ VERIFIED | `OPEN_EVENT` listener; `mode` state; `COPY` map; `type: mode` in POST body |
| `app/api/feedback/route.ts` | type-aware, feature-request label routing | ✓ VERIFIED | `type === "feature"` guard at line 49; feature-request in LLM prompt, fallback, normalizeLabels |
| `app/components/Footer.tsx` | All required links, donation, GitHub mark, hackathon | ✓ VERIFIED | Changelog/Blog/Contact links; "Suggest a feature" button; "Buy us a coffee" donation; GitHub SVG mark; hackathon link in `--secondary` |
| `app/lib/links.ts` | DONATION_URL, GITHUB_URL, HACKATHON_URL constants | ✓ VERIFIED | Env-override pattern for DONATION_URL; constants exported |
| `app/lib/analytics.ts` | Provider-agnostic track(), dev log / prod no-op | ✓ VERIFIED | `typeof window` guard; dev console.debug; prod no-op with wiring comments |
| `.dev.vars.example` | Phase 2 handoffs documented (CONTACT_TO, DONATION_URL, CF_BEACON_TOKEN) | ✓ VERIFIED | All 3 handoff vars with descriptions; analytics backend note |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ContactForm.tsx` | `POST /api/contact` | `fetch("/api/contact", {method:"POST"})` | ✓ WIRED | Line 55; response handled (sent/queued/error states) |
| `api/contact/route.ts` | `sendEmail()` | `import {sendEmail, escapeHtml}` | ✓ WIRED | Line 15 import; line 183 call with to/subject/html/text/replyTo |
| `FeedbackWidget.tsx` | `POST /api/feedback` | `fetch("/api/feedback", {method:"POST"})` with `type: mode` | ✓ WIRED | Line 113; `type: mode` in body at line 121 |
| `Footer.tsx` | FeedbackWidget feature mode | `window.dispatchEvent(new CustomEvent("reporadar:open-feedback", {detail:{type:"feature"}}))` | ✓ WIRED | Footer line 13–16; FeedbackWidget OPEN_EVENT listener lines 72–81 |
| `Footer.tsx` | Donation URL | `href={DONATION_URL}` from `app/lib/links.ts` | ✓ WIRED | Line 89; env-override with placeholder |
| `RepoRadarApp.tsx` | `track("tag_picked")` | `runQuery` label discrimination `label.startsWith("tag: ")` | ✓ WIRED | Line 397–398; covers card chips + header TAGS panel |
| `RepoRadarApp.tsx` | `track("search_run")` | `runQuery` label discrimination `"ask: "` / `"voice: "` | ✓ WIRED | Lines 399–400 |
| `DeployForm.tsx` | `track("deploy_clicked")` | call before `/api/deploy` fetch | ✓ WIRED | Line 66 |
| `NotificationSignup.tsx` | `track("alert_signup")` | call on successful subscribe | ✓ WIRED | Line 97; payload `{sources: selectedSources.length}` (no PII) |
| `app/layout.tsx` | CF Web Analytics beacon | `Script` with `strategy="afterInteractive"` gated on `NEXT_PUBLIC_CF_BEACON_TOKEN` | ✓ WIRED | Lines 48–55; no beacon rendered when token unset |
| `RepoRadarApp.tsx` | `<Footer />` | import at line 23, mount at line 1083 | ✓ WIRED | After `</main>`, before `<CopilotPopup>` |

### Data-Flow Trace (Level 4)

No dynamic data-fetching components introduced in this phase. All content surfaces (`/changelog`, `/blog`, `/blog/[slug]`) are fully static — their data is bundled TypeScript modules resolved at build time, not runtime state. Contact form and feedback form POST to APIs but do not render fetched data as a list. Level 4 not applicable.

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| All 4 content pages have `force-static` | `grep "export const dynamic" app/(site)/*/page.tsx app/(site)/blog/[slug]/page.tsx` | All 4 confirmed | ✓ PASS |
| No runtime fs calls in content/page files | `grep -rn "fs\.\|readFileSync\|readFile" app/(site)/ app/content/` | Empty output | ✓ PASS |
| Footer mounted in RepoRadarApp (line ~1083) | `grep -n "Footer" app/components/RepoRadarApp.tsx` | Lines 23 (import) + 1083 (mount) | ✓ PASS |
| track() wired at all 4 core events | `grep -n "track(" app/components/RepoRadarApp.tsx app/components/DeployForm.tsx app/components/NotificationSignup.tsx` | 4 events confirmed at correct sites | ✓ PASS |
| CF beacon gated on env var | `grep -n "beaconToken" app/layout.tsx` | Conditional `{beaconToken && <Script…>}` at line 48 | ✓ PASS |
| sendEmail + escapeHtml used in contact route | `grep -n "sendEmail\|escapeHtml" app/api/contact/route.ts` | Import line 15; escapeHtml on name/email/message lines 144–146; sendEmail at line 183 | ✓ PASS |
| FeedbackWidget has external open hook + type-aware mode | `grep -n "OPEN_EVENT\|reporadar:open-feedback\|type: mode" app/components/FeedbackWidget.tsx` | Lines 23, 79, 121 | ✓ PASS |
| Feedback route has feature-request label routing | `grep -n "feature-request\|type.*feature" app/api/feedback/route.ts` | Lines 49, 96, 206, 315 | ✓ PASS |
| Header hackathon text unchanged | `grep -n "AI Tinkerers\|5/10/26" app/components/RepoRadarApp.tsx` | Lines 759, 761 intact | ✓ PASS |
| Phase 2 RepoRadarApp changes additive only | `git show f8f421e --stat && git show e1b8e2a --stat` | f8f421e = +3 lines; e1b8e2a = +18 lines; both additive-only | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| CRED-01 | `/changelog` route renders curated CHANGELOG.md, on-brand, linked from footer | ✓ SATISFIED | `app/(site)/changelog/page.tsx` force-static; real content from `changelog.ts`; Footer links /changelog |
| CRED-02 | `/blog` renders posts with 1–2 "how & why" posts and 30-day template | ✓ SATISFIED | 2 real posts; `_template-30-day-checkin.ts` (commented, not in list per spec); blog list + slug pages |
| CRED-03 | Contact form + POST /api/contact via sendEmail(), validated, rate-limited | ✓ SATISFIED | All code elements verified; live delivery needs owner handoff |
| CRED-04 | Suggestion box extends existing FeedbackWidget + /api/feedback with "suggest a feature" path | ✓ SATISFIED | Segmented toggle; type field; feature-request label; external open hook |
| CRED-05 | Donation "Buy us a coffee" outbound link (Ko-fi); no integration | ✓ SATISFIED | Footer donation anchor with env-override URL, `rel="noopener noreferrer"` |
| CRED-06 | Privacy-respecting analytics: pageviews + key events (search, tag, deploy, alert signup) | ✓ SATISFIED (deferred backend) | track() at all 4 sites; CF beacon gated; prod no-op until backend chosen (intentional, documented) |

**Note on CRED-01 "header" link:** Per the verification brief, the success criterion "linked from footer/header" is fulfilled by footer-only linking. The header is frozen by AGENTS.md (hackathon UI contracts). This is a documented tradeoff, not a gap.

**Note on CRED-06 events backend:** `track()` no-ops in production until a backend (CF Zaraz / Plausible / Umami) is wired. This is an explicitly deferred product decision per D-12 and the CONTEXT deferred list. The abstraction is in place and documented; no rework at call sites when backend is chosen.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `app/lib/analytics.ts` | `track()` is a no-op in production | ℹ️ Info | Intentional deferred decision per D-12. The prod no-op is documented with explicit wiring instructions. The CF beacon covers pageviews independently. Not a blocker. |
| `app/lib/links.ts` | `DONATION_URL` defaults to placeholder `https://ko-fi.com/reporadar` | ℹ️ Info | Documented human handoff: owner sets `NEXT_PUBLIC_DONATION_URL`. Link still functional as a placeholder — no broken state. |
| `app/lib/links.ts` | `GITHUB_URL` is `https://github.com/RepoRadar/reporadar` — may be wrong org/repo | ℹ️ Info | Noted in 02-04 SUMMARY. Not a functional blocker for Phase 2 goal. Owner should verify before launch. |

No blockers or structural stubs found.

### Human Verification Required

The following items passed all automated checks but require in-browser or live-environment verification.

#### 1. Content Pages Visual Quality

**Test:** Open `/changelog`, `/blog`, and `/blog/why-we-built-reporadar` in a browser  
**Expected:** Dark background (`#06080d`), green links (`#22c55e`), blue timestamps (`#3b82f6`), mono code font, no white flash on navigation  
**Why human:** CSS token rendering and dark-theme correctness require a visual browser pass

#### 2. Blog Post Content Completeness

**Test:** Navigate to both blog posts and scroll through the full body  
**Expected:** Both posts render complete, substantive markdown content — not truncated, no broken rendering, no stray symbols  
**Why human:** Content quality and rendering completeness require reading the actual rendered output

#### 3. Contact Form Email Delivery

**Test:** Set `CONTACT_TO` and `RESEND_API_KEY` in `.dev.vars`, submit the contact form  
**Expected:** Email received at `CONTACT_TO` address with correct subject (`Contact from <name>`), reply-to set to submitter's email, on-brand HTML body  
**Why human:** Live email delivery requires owner-supplied secrets (CONTACT_TO, RESEND_API_KEY); cannot be tested without real config

#### 4. "Suggest a Feature" Footer Button

**Test:** On the dashboard, click "Suggest a feature" in the Footer  
**Expected:** FeedbackWidget opens with "Suggest a feature" toggle active (not "Review"), feature-framed placeholder copy, submit routes to feature-request label  
**Why human:** CustomEvent dispatch → Widget state requires interactive browser test

#### 5. Donation Link

**Test:** Click "Buy us a coffee" in the Footer  
**Expected:** Opens `https://ko-fi.com/reporadar` (or configured `NEXT_PUBLIC_DONATION_URL`) in a new tab; no console errors  
**Why human:** Outbound link + new-tab behavior and correct URL require browser verification; real Ko-fi handle is an owner handoff

#### 6. Analytics Event Wiring (dev console)

**Test:** In `npm run dev`, perform: (a) type a search query, (b) click a tag chip or use the TAGS panel, (c) click Deploy on any card, (d) subscribe to alerts  
**Expected:** Console shows `[track] search_run {…}`, `[track] tag_picked {…}`, `[track] deploy_clicked {…}`, `[track] alert_signup {…}` respectively  
**Why human:** Exercising each distinct UI path requires interactive browser session; the TAGS panel path in particular (HeaderControls → TagsPanel → onPick → runQuery) needs confirmation that the centralized label discrimination fires correctly

#### 7. Footer Layout — No Overlap With Dashboard

**Test:** Scroll the dashboard to the bottom on both desktop and mobile (375px) viewport widths  
**Expected:** Footer renders fully below all cards, sliders, and radar; no positional overlap; grid ends before footer begins  
**Why human:** Visual layout at responsive breakpoints requires browser inspection

### Gaps Summary

No gaps blocking goal achievement. All 5 success criteria are satisfied at the code level. Human verification items are quality/delivery confirmations, not missing implementation.

The one intentional deferred item — the analytics events backend — is explicitly called out in the CONTEXT deferred list and the `.dev.vars.example` documentation. It does not block Phase 2 because `track()` is wired at all 4 required call sites and the abstraction is in place. The CF beacon independently covers pageviews.

---

_Verified: 2026-05-27T10:45:00Z_  
_Verifier: Claude (gsd-verifier)_
