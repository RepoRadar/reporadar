# Auth Setup WIP

This branch adds the first RepoRadar login surface and auth route handlers. It is intentionally a WIP stack branch and must not be deployed to production until durable storage and secrets are configured.

## Current State

- Email/password register, login, logout, and `/api/auth/me` work in local runtime memory.
- Passwords are hashed with Node `scrypt` and never stored in plain text.
- Sessions are issued as `HttpOnly`, `SameSite=Lax` cookies.
- GitHub and Google OAuth start/callback routes are wired.
- `migrations/0001_auth.sql` defines the durable D1 tables needed before production.

## Required Secrets

Set these for the apex Next.js worker:

```bash
wrangler secret put AUTH_SECRET
wrangler secret put GITHUB_OAUTH_CLIENT_ID
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
```

`AUTH_URL` must match the deployed origin, for example `https://reporadar.io`.

## OAuth Callback URLs

GitHub OAuth app:

```text
https://reporadar.io/api/auth/oauth/github/callback
```

Google OAuth client:

```text
https://reporadar.io/api/auth/oauth/google/callback
```

Local development callbacks:

```text
http://localhost:3000/api/auth/oauth/github/callback
http://localhost:3000/api/auth/oauth/google/callback
```

## Production Blockers

- Wire route handlers to D1 instead of in-memory maps.
- Hash session tokens at rest before writing to D1.
- Add CSRF protection for state-changing auth routes if they become form-post endpoints outside same-origin fetch.
- Add account verification and password reset email flows.
- Add rate limiting for login, register, and OAuth callback routes.
- Add CI coverage for OAuth callback error paths with provider fetches mocked.
