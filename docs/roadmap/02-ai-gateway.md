# 02 — AI Gateway in front of Gemini

**Status:** Roadmap · **Effort:** 1 day · **Depends on:** Nothing

## What

Route every Gemini call (CopilotKit runtime, deploy worker A2UI emission, translate.ts, voice intent — when we move that off the client) through a Cloudflare AI Gateway endpoint instead of calling `generativelanguage.googleapis.com` directly.

## Why

Four wins, no real downside:

1. **Caching.** A2UI surface generation for the same repo + hint is deterministic-ish. Cache it. Repeat deploys are instant.
2. **Retries.** Gemini occasionally 503s under load (we've seen it during demos). AI Gateway retries transparently.
3. **Observability.** Single dashboard with per-call latency, token usage, cost, error rate. Today we have nothing.
4. **Cost guardrails.** Per-route budgets, daily caps. Useful as v1.0 traffic grows.

Risk: zero. AI Gateway is a transparent reverse proxy. If it breaks, swap the env var back to direct Gemini and re-deploy.

## How (sketch)

1. `wrangler ai gateway create reporadar-gateway`
2. Copy the gateway URL (something like `https://gateway.ai.cloudflare.com/v1/<account>/reporadar-gateway/google-ai-studio`)
3. Add `GEMINI_BASE_URL` env var pointing at the gateway endpoint in:
   - `app/api/copilotkit/route.ts` (CopilotRuntime's GoogleGenerativeAIAdapter accepts a `baseUrl`)
   - `app/api/deploy/route.ts` (calls Gemini directly via `@google/generative-ai`)
   - `workers/deploy/src/index.ts` (calls Gemini REST directly — change the fetch URL)
   - `app/lib/translate.ts` (Gemini-driven translation)
4. Enable caching with a moderate TTL (15 min for surface JSON, 1h for translation, no cache for chat).
5. Add retry config: 2 retries with exponential backoff, 5xx + 429 only.

## Effort breakdown

| Step | Time |
|---|---|
| Create gateway | 15 min |
| Wire env vars + verify each route | 2 h |
| Tune cache rules | 1 h |
| Verify observability dashboard | 30 min |
| Push to prod + monitor | 1 h |
| **Total** | **~1 day** |

## What success looks like

- Median deploy time drops 1–3s for repos previously fetched (cache hits)
- Zero user-visible failures from transient Gemini 503s
- A live dashboard we can screen-share in v1.0 demos showing call volume + cost

## Open questions

1. **Cache key for `deploy/route.ts`.** Default cache key is the full request body. We may want a custom key so two identical deploys (same repo, no hint) collapse, but a deploy with a custom hint doesn't.
2. **Translation cache TTL.** READMEs don't change minute-to-minute, but they DO get updated. 1h is a reasonable starting point.
3. **Per-user rate limit.** Not needed today (anon traffic only). Worth setting up before any user-account work.
