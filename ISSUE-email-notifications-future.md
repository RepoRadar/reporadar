# Future Issue: Durable Email Notifications And Real Trend Sources

## Problem

RepoRadar now has a basic notification signup that stores a user's email/preferences locally and queues a dummy trend email response. The next iteration should turn this into a real notification system with durable user storage, real trend source ingestion, and production email delivery.

## Goals

- Store notification subscribers durably in the main app runtime, preferably Cloudflare D1 or another project-standard datastore.
- Add a real email provider path, likely Resend because deploy notifications already use it.
- Support real Product Hunt/trend-source ingestion instead of the current clearly labeled demo source.
- Let users choose sources, frequency, topic interests, and threshold rules.
- Include unsubscribe and preference-management links in every email.
- Respect privacy: minimal stored data, clear consent, no silent tracking.

## Proposed Scope

- `notifications_subscribers` table with email, source preferences, topic filters, frequency, verification state, created/updated timestamps.
- `notifications_events` or queue table for generated digests, sent status, retry count, and provider response.
- Scheduled worker or cron job to assemble daily/weekly trend digests.
- Product Hunt API integration, with fallback when API credentials are missing.
- RepoRadar/GitHub trend integration using the current `/api/repos` scoring output.
- Email templates for welcome, daily trend pulse, weekly roundup, and unsubscribe confirmation.
- UI for edit/unsubscribe preferences.

## Acceptance Criteria

- User can subscribe with email and selected sources.
- User data survives server restarts and redeploys.
- Email delivery is real when provider credentials are present and safely queued when they are absent.
- Every email contains unsubscribe and preference-management links.
- Product Hunt content is fetched from an authenticated, documented integration and never represented as live data when it is mocked.
- UI passes desktop and mobile QA without overlapping text or disrupting the hackathon dashboard.

## QA Notes

- Add route tests for subscribe, update preferences, unsubscribe, and invalid tokens.
- Add browser QA for signup, validation errors, persisted preferences, and mobile layout.
- Add provider-off tests so demo/staging environments cannot accidentally pretend emails were sent.
