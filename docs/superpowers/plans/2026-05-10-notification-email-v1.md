# Notification Email V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a basic, polished notification email signup that stores user preferences locally and queues a dummy trend email.

**Architecture:** Add a small pure notification helper module, a Next.js route handler for dummy subscription queuing, a focused client component for the dashboard rail, and Playwright tests for API/UI behavior.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Playwright, TypeScript, localStorage.

---

### Task 1: Notification Contract And API

**Files:**
- Create: `app/lib/notifications.ts`
- Create: `app/api/notifications/subscribe/route.ts`
- Test: `tests/notifications.spec.ts`

- [ ] **Step 1: Write failing tests**
  - Add Playwright API tests that POST a valid email and expect `{ ok: true, status: "queued" }`.
  - Add an invalid email test that expects HTTP 400.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/notifications.spec.ts --reporter=list`
  - Expected: fails because the route does not exist yet.

- [ ] **Step 3: Implement helper and route**
  - Add email validation, digest item normalization, dummy email subject/body generation, and module-level in-memory queue tracking.

- [ ] **Step 4: Run test to verify it passes**
  - Run the same Playwright command against the local dev server.

### Task 2: Dashboard Notification UI

**Files:**
- Create: `app/components/NotificationSignup.tsx`
- Modify: `app/components/RepoRadarApp.tsx`
- Modify: `app/globals.css`
- Test: `tests/notifications.spec.ts`

- [ ] **Step 1: Write failing UI test**
  - Mock `/api/repos`, open the homepage, click/focus the notification card, fill the email field, submit, and expect a queued demo email state.

- [ ] **Step 2: Run test to verify it fails**
  - Expected: fails because the component is not rendered yet.

- [ ] **Step 3: Implement UI**
  - Add a compact dashboard-rail card with source chips, digest preview, email field, localStorage persistence, and accessible success/error states.

- [ ] **Step 4: Run test to verify it passes**
  - Run the notification Playwright test against the local dev server.

### Task 3: Future Issue And Verification

**Files:**
- Create: `ISSUE-email-notifications-future.md`

- [ ] **Step 1: Write issue**
  - Document durable storage, Product Hunt ingestion, email provider, scheduling, unsubscribe, privacy, analytics, and QA requirements.

- [ ] **Step 2: Verify**
  - Run `npm run lint`.
  - Run `npm run build`.
  - Run the local Playwright notification test.
  - Run browser QA and inspect desktop/mobile visual layout.
