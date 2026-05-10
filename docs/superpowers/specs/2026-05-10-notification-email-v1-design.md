# Notification Email V1 Design

## Goal

Add a polished, basic notification signup to RepoRadar so users can save an email preference and queue a dummy trend email about recent/high-signal repositories.

## Scope

V1 stores the user's notification email and simple preferences in browser `localStorage`. A new `/api/notifications/subscribe` route validates the email and returns a dummy queued email payload. The UI must make it clear this is a demo email preview, not a real Product Hunt integration yet.

## UX

Add a compact notification card in the left dashboard rail below tuning controls. The card should feel operational and premium: small header, clear status, email input, source chips, and a preview of the trend pulse. It should use RepoRadar's green/blue/yellow/red palette without disrupting existing card contracts.

The card shows:
- a `Trend alerts` heading and `demo email` status badge
- an email input
- selectable source chips for RepoRadar, GitHub, and Product Hunt demo
- three trend items derived from the currently ranked repos when available
- a primary `Send demo email` button
- success/error state after submission

## Data Flow

1. `RepoRadarApp` computes a small trend digest from the current ranked repos.
2. `NotificationSignup` renders the digest and captures email/source preferences.
3. On submit, the component POSTs to `/api/notifications/subscribe`.
4. The API validates the email and returns a dummy email subject, preview text, and queued status.
5. The component stores the email/preferences locally under `reporadar-notification-profile-v1`.

## Error Handling

Invalid email addresses return `400` from the route and show an inline error in the card. Network or server errors show a concise retryable message. Successful submissions show that the demo email was queued and summarize what would be sent.

## Tests

Add Playwright coverage for the API validation/queued response and for the UI flow against a local dev server with `/api/repos` mocked. Run lint, build, and browser QA before claiming completion.

## Future Work

Create a future-development issue for durable user storage, real email delivery, scheduled digests, real Product Hunt integration, preferences, unsubscribe, privacy controls, and analytics.
