# 01 — Cloudflare Containers + Durable Objects for repos that need a runtime

**Status:** Roadmap · **Effort:** 1–2 weeks for the first repo class, +days per additional class · **Depends on:** [02 — AI Gateway](./02-ai-gateway.md), [03 — Cron pre-rank](./03-cron-pre-rank.md) (helpful, not blocking)

## What

For repos that the current deploy worker classifies as `needs-runtime` (OpenClaw skill packs, Hermes adapters, libraries that need a host, native apps), spin up the repo's actual runtime inside a Cloudflare Container, layer an A2UI surface on top of it, and stream the working demo to the user at `<slug>.reporadar.io`.

Today: we honestly tell the user "this isn't deployable as a static Worker" with a CTA to ping the team.
After this: we actually deploy it.

## Why

This is the single highest-leverage thing we can do for demo quality. A judge looking at "an OpenClaw skill for design" today sees a static explainer page. After this, they see the actual OpenClaw instance running with the skill loaded and a UI to try it. That's the difference between RepoRadar-the-demo and RepoRadar-the-platform.

## How (sketch)

### 1. Pre-built container images per repo class

We're not building a container per repo. We're building a container per *class* of runtime:

- `image:openclaw` — a base OpenClaw image. Skill packs get mounted as volumes / installed at startup.
- `image:hermes` — Hermes agent image. Same pattern.
- `image:claude-code-skill` — a Claude Code CLI with the user's skill loaded.
- `image:python-cli` — generic Python CLI runner for repos with a `python -m foo` entrypoint.
- `image:node-cli` — same for Node-based CLIs.

5–6 image classes covers ~80% of the needs-runtime population. Gemini already classifies the repo when it picks the form factor — that classification extends to picking the image class.

### 2. Container lifecycle via Durable Objects

One Durable Object per session. The DO holds:
- The slug
- The container instance (or instance ID — Containers API gives us container handles via DO bindings)
- The pending interaction state
- A cleanup timer (idle eviction after N minutes)

Flow:
1. User hits `<slug>.reporadar.io`
2. `reporadar-serve` reads the surface JSON from R2
3. Surface metadata says `runtime: "openclaw"` with a config blob
4. `reporadar-serve` calls into the DO namespace, gets-or-creates a DO for this slug
5. DO checks if container is alive; spins one up if not; mounts the repo's skill files
6. DO returns a session URL / WebSocket endpoint
7. The A2UI renderer connects to that endpoint via tunneled fetches
8. User's clicks/inputs flow into the container; output flows back to the surface

### 3. Surface integration

A new A2UI node type — `RuntimePanel { runtime: string, config: object, height?: number }` — that the renderer mounts as an iframe pointing at the DO's session URL. The rest of the A2UI surface (Heading, Text, contact CTAs) wraps it.

### 4. Eviction + cost control

- Idle containers killed after 5 minutes of no traffic
- One DO per slug, not per visitor — cheaper, shared session works for a demo
- Cold-start budget: 3–5s acceptable; show a "spinning up <repo> for you…" state with the existing bouncing-dots loader
- Per-slug daily budget cap; over-budget slugs fall back to the current explainer surface

## Effort breakdown

| Phase | Time |
|---|---|
| Image building (1 class — OpenClaw) | 2–3 days |
| DO scaffolding + container lifecycle | 3–4 days |
| Renderer `RuntimePanel` + tunnel | 2 days |
| Gemini prompt update to emit `runtime` config | 1 day |
| Eviction + budget caps | 2 days |
| **First repo class end-to-end** | **~2 weeks** |
| Each additional image class | 2–3 days |

## Open questions

1. **Auth.** If a container runs OpenClaw with a user-supplied skill, do we sandbox? What if the skill makes outbound network calls? Whose Cloudflare account pays for that egress?
2. **Per-visitor vs per-slug session.** Per-visitor is the right product but multiplies the container count by 100×. Per-slug shares state across visitors — fine for a demo, weird for actual use. Start per-slug, revisit.
3. **Persistence.** The current per-slug D1 (records, counters) already gives slugs a database. Does the container also get a writable filesystem layer that survives eviction? R2-backed FS overlay? Punt for v1.
4. **Pricing.** Containers cost real money per second of CPU. The pricing model (see roadmap README open question) determines whether this is free-tier-eligible.

## What we'd ship for the OpenClaw MVP

1. A `openclaw-runtime` Container image with OpenClaw 1.x and a hot-mount directory for skills.
2. A DO class `OpenClawSession` that spins up + tears down.
3. Gemini emits `{ runtime: "openclaw", config: { skillGitUrl: "..." } }` for OpenClaw skill repos.
4. The deployed slug page shows: title + description from A2UI, plus an iframe with the live OpenClaw UI loaded with the skill.
5. A "this is running in a Cloudflare Container — here's what we did" expandable footer for the meta-narrative judges love.

## Out of scope

- General-purpose VM hosting (use Daytona / Replit / E2B for that)
- GPU containers (ML training repos are explicitly not in this scope)
- Long-running background processes (RepoRadar is for *demoing*, not hosting)
