# Post-hackathon roadmap

Six work items scoped after the May 9, 2026 hackathon ship. Each one is a real engineering effort with a sketch of the approach, an honest effort estimate, and the open questions worth resolving before starting. None of these need to land for judging — they're for the v1.0 milestone (target Q3 2026).

Ordered roughly by ROI per engineering hour, not by interest level.

| # | Item | Effort | Why now |
|---|---|---|---|
| [01](./01-cloudflare-containers.md) | **Cloudflare Containers + Durable Objects** for repos that need a runtime | 1–2 weeks | Unlocks the entire "needs-runtime" form factor as real demos. Today we honestly tell judges this isn't deployable — tomorrow we spin up the repo's runtime and layer the UI on top. |
| [02](./02-ai-gateway.md) | **AI Gateway** in front of Gemini | 1 day | Caching + retries + observability for every Gemini call. Lowest risk, biggest immediate quality win. |
| [03](./03-cron-pre-rank.md) | **Cron Triggers + Queues** for a nightly top-1000 pre-rank | 3–5 days | Today's discovery is live-fetch off GitHub Search (60 req/hr anon). Pre-ranking lets us serve any topic instantly, support v1.0 traffic, and add scoring axes that need expensive enrichment. |
| [04](./04-curated-demo-templates.md) | **Manually-curated 50-repo demo templates** | 1–2 weeks (mostly content work) | Per-repo bespoke deploys for the repos people actually want to try. Highest visible quality bump for selected demos. |
| [05](./05-vectorize-semantic-search.md) | **Vectorize** for semantic search alongside the radar | 3–5 days | Today's "podcast platform" fallback is keyword-only. Vectorize embeddings on the pre-ranked universe make natural-language search hit the right repos. |
| [06](./06-workers-ai-whisper.md) | **Workers AI Whisper** as a STT fallback | 1 day | TALK currently uses Web Speech API (Chrome-only on desktop, flaky on iOS Safari). Whisper backs the panel up so the demo works on every judge's laptop and phone. |

## Sequencing recommendation

1. **AI Gateway first** — small, low risk, makes everything else faster and more debuggable.
2. **Cron Triggers pre-rank** — unblocks Vectorize (need a stable index to embed) and Containers (need a stable repo set to template against).
3. **Vectorize + Whisper in parallel** — independent surfaces, both small wins.
4. **Containers + Durable Objects** — the big one. Build for one repo class (OpenClaw skill packs) end-to-end before generalizing.
5. **Curated templates** — content work that can run concurrently with everything else.

## Open product question

The current pricing model is implicit — RepoRadar is free, hackathon-funded. Several items here (Containers, Vectorize, Cron at scale) carry real Cloudflare bills. Worth deciding before deep work on items 1–3 whether we're aiming at: (a) a free OSS tool, (b) a Pro-tier SaaS, or (c) an enterprise dev-radar product. The architecture choices differ.
