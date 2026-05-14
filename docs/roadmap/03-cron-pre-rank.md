# 03 — Cron Triggers + Queues for a nightly top-1000 pre-rank

**Status:** Roadmap · **Effort:** 3–5 days · **Depends on:** [02 — AI Gateway](./02-ai-gateway.md) helpful

## What

Replace the current live-fetch model (every page load hits GitHub Search) with a nightly Cron job that fetches, scores, enriches, and stores the top ~1000 trending repos in D1. The home grid and topic searches read from D1 instead of GitHub directly.

## Why

Three problems with the current model:

1. **Rate limits.** Anonymous GitHub Search is capped at 60 req/hr per IP. With Cloudflare's edge cache we mostly stay under, but a viral moment kills the demo for ~an hour.
2. **Latency.** First fetch per (topic, window) is 1–3s. Even with edge cache (`s-maxage=300`), the cache miss is visible. Pre-ranked D1 hits would be ~50ms.
3. **Enrichment.** The scoring heuristic (`app/lib/scoring.ts`) wants richer signals — README length, contributor count, commit cadence, dependency graph — that each cost 1–3 extra API calls per repo. Live-fetching that is impossible inside a page-load budget. Nightly pre-rank gives us a 6-hour window to enrich each repo properly.

## How (sketch)

### Cron schedule

```toml
# wrangler.toml for a new `reporadar-ingest` worker
[triggers]
crons = ["0 7 * * *"]  # 07:00 UTC daily (midnight PT, off-peak GitHub)
```

### Ingest pipeline

1. **Tier 1 — top-of-funnel fetch.** Hit GitHub Search across 10 topic queries (the popular tags) + an "all-trending" pull. Up to 100 repos per query, dedupe, ~1000 unique repos.
2. **Tier 2 — per-repo enrichment.** Push each repo onto a Cloudflare Queue. Consumer fetches `/repos/{owner}/{repo}` + `/repos/.../readme` + `/repos/.../stats/contributors` + `/repos/.../commits?since=...`. Calls AI Gateway for non-English description translation. Aggregates into a `ranked_repos` D1 row.
3. **Tier 3 — score recalculation.** Score every repo on the 10 dimensions with the latest heuristic. Store dimensions + raw inputs separately so future heuristic changes can re-score without re-fetching.

### Storage

```sql
CREATE TABLE ranked_repos (
  full_name TEXT PRIMARY KEY,
  data JSON NOT NULL,            -- the Repo + ScoredRepo blob the UI consumes
  topics TEXT NOT NULL,          -- comma-joined for fast LIKE filtering
  stars INTEGER,
  pushed_at TEXT,
  ranked_at TEXT,                -- when this row was last refreshed
  score_overall REAL             -- cached for cheap top-N selection
);

CREATE INDEX idx_topics ON ranked_repos(topics);
CREATE INDEX idx_score ON ranked_repos(score_overall DESC);
```

### Read path

`/api/repos` becomes a D1 SELECT. Topic filter = `WHERE topics LIKE '%openclaw%'`. Multi-topic = multiple LIKEs. Time window = `WHERE pushed_at > since`. Sorted by `score_overall` desc + applied priorities client-side as today.

Live GitHub fetch becomes a fallback for queries that miss the pre-rank universe ("a podcast platform" type queries).

## Effort breakdown

| Step | Time |
|---|---|
| New `reporadar-ingest` worker + cron trigger | 0.5 day |
| D1 schema + migrations | 0.5 day |
| Queue consumer for enrichment fan-out | 1 day |
| `/api/repos` switch from GitHub fetch to D1 read | 1 day |
| Fallback to GitHub for unmatched queries | 0.5 day |
| Monitoring + alerts on failed runs | 0.5 day |
| **Total** | **3–5 days** |

## What success looks like

- Page load → first card is <100ms (D1 read vs 1–3s GitHub fetch)
- Top 1000 repos always available, even when GitHub Search is rate-limited
- Heuristic upgrades (e.g. "weight repos with a security policy") can be re-scored across the universe in seconds
- Daily snapshot of "what's trending" stored permanently in R2 (compliance: we can show a judge the May 14 snapshot any time)

## Open questions

1. **Universe size.** 1000 is a guess. Probably want 5000+ for any v1.0 product. Storage in D1 is fine at 5k rows. Ingest time is the bottleneck — each repo costs ~3 API calls, anon limit is 60/hr without a token.
2. **GitHub token.** We need a service token for the ingest worker (not the anon limit). Use a fine-scoped public-read-only PAT stored as a wrangler secret.
3. **What goes in `data` JSON.** Today's Repo + ScoredRepo blob is ~2KB. 5000 × 2KB = 10MB. D1 handles it. If we want richer per-repo content (README excerpt, top-3 issues), bumps to 100MB territory which D1 still handles but worth measuring.
4. **Real-time signals.** "Hermes just announced on X" type signals are minute-grained. Nightly is too slow. v1.x: add a streaming layer (HN firehose, GitHub event webhook) that updates a subset of rows in real-time.
