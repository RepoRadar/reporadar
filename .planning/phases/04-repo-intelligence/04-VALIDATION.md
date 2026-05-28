---
phase: 4
slug: repo-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 4, Validation Strategy (Talk to a repo MVP)

> Per-phase validation contract. This feature is mostly streaming UI plus LLM
> output, so the pure logic seams get fast unit tests and the UX/grounding gets
> browser QA (per AGENTS.md: verify results, not mechanics). Do not force unit
> tests onto streaming UI or model output where browser QA is the real check.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (node:test) for `.mjs` unit tests; Playwright for browser QA |
| **Config file** | none for unit (node built-in); `playwright.config.ts` for smoke |
| **Quick run command** | `node --test --test-concurrency=1 tests/repochat*.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** run the quick command for any task that adds/affects a pure helper.
- **After every plan wave:** run `npm test` (full unit suite).
- **Before `/gsd-verify-work`:** full unit suite green AND the browser QA checklist (PRD §16) walked on the dev server.
- **Max feedback latency:** ~10 seconds for unit.

---

## Per-Task Verification Map

| Task | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|------|-------------|-----------------|-----------|-------------------|--------|
| repoContext trimming (README ~12k, tree ~200) | INTL-01 | truncation never throws; bounds enforced | unit | `node --test tests/repochat.context.test.mjs` | ⬜ pending |
| em-dash backstop on assistant text | INTL-01 | output contains no `—` | unit | `node --test tests/repochat.style.test.mjs` | ⬜ pending |
| tool arg validation (search_reporadar / get_repo_file) | INTL-01 | rejects off-shape args; get_repo_file scoped to current repo | unit | `node --test tests/repochat.tools.test.mjs` | ⬜ pending |
| per-IP rate limit on /api/repo-chat | INTL-04 | over-limit returns 429, no model call | unit | `node --test tests/repochat.ratelimit.test.mjs` | ⬜ pending |
| no-persistence / no-logging posture | INTL-04 | endpoint never writes message bodies to D1/KV/logs | manual + code-grep | grep route for absence of console.log(message) / db writes | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] `tests/repochat.context.test.mjs`, `tests/repochat.style.test.mjs`, `tests/repochat.tools.test.mjs`, `tests/repochat.ratelimit.test.mjs` (stubs for the pure seams above)

*Pure helpers must be importable without a running Worker (extract them from the route into testable functions).*

---

## Manual-Only Verifications (browser QA, PRD §16)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-pane workspace opens from a card in a new tab | INTL-01 | rendered layout | Click "Ask this repo", confirm both panes render |
| Grounded answers (scores, "why ranked", special, hype) | INTL-01 | LLM output | Run each chip, confirm answers reference real scores/README |
| Describe-your-build gate waits for input | INTL-01 | interaction | Click chip 2, confirm no answer until a description is submitted |
| Honest poor-fit + alternatives via search_reporadar | INTL-01 | LLM + tool | Describe a mismatched project, confirm honest "no" + alternatives |
| No hallucination | INTL-01 | LLM grounding | Ask about a file that does not exist, confirm the model declines |
| No em dashes / AI-isms in answers | INTL-01 | LLM output | Read several answers, confirm clean |
| Prompt-injection resistance | INTL-04 | adversarial | Open a repo with a hostile README, confirm behavior unchanged |

---

## Validation Sign-Off

- [ ] Pure seams have unit tests; UI/LLM behaviors routed to browser QA above
- [ ] Wave 0 test stubs created before implementation of those seams
- [ ] Full unit suite green before verify
- [ ] Browser QA checklist (PRD §16) walked on the dev server
- [ ] `nyquist_compliant: true` set when the above hold

**Approval:** pending
