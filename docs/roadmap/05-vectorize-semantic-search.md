# 05 — Vectorize for semantic search alongside the radar

**Status:** Roadmap · **Effort:** 3–5 days · **Depends on:** [03 — Cron pre-rank](./03-cron-pre-rank.md)

## What

Embed every pre-ranked repo's `name + description + topics + README excerpt` into a Cloudflare Vectorize index. When a user's TYPE or TALK query doesn't match any known topic slug (the parser returns no topic, just a `query` keyword string), embed the query and run a vector search — surface repos that are *semantically* similar even if they share no keywords.

Concrete example: TYPE "podcast platform". Today: keyword GitHub search for "podcast platform", which only finds repos with those exact words. With Vectorize: nearest neighbors to "podcast platform" embedding could include `souzatharsis/podcastfy` (no exact match in name/desc but obviously what you want), and we surface it.

## Why

The "search box" is currently the worst input modality. Topic tags work great (deterministic). Sliders + hex work great (deterministic). The CopilotKit chat works because Gemini does intent extraction. But raw text search through `/api/repos?q=...` falls back to GitHub's keyword matcher, which is terrible at intent.

Semantic search closes that gap.

## How (sketch)

### Index build (runs in the cron pre-rank pipeline)

For each pre-ranked repo:

```ts
const text = [
  repo.fullName,
  repo.description ?? "",
  (repo.topics ?? []).join(" "),
  repo.readmeExcerpt?.slice(0, 1000) ?? "",
].join("\n");

const { vector } = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });

await env.VECTORIZE.upsert([{
  id: repo.fullName,
  values: vector,
  metadata: { stars: repo.stars, topics: repo.topics?.join(",") },
}]);
```

### Query path

```ts
// In /api/repos, when topic is empty but q is set and the keyword-search tier returns < 10 hits:
const { vector } = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: q });
const matches = await env.VECTORIZE.query(vector, {
  topK: 100,
  returnMetadata: true,
});

// Hydrate full repo records from D1 keyed by id (= fullName)
const repos = await db.batch(matches.map(m => db.prepare("SELECT data FROM ranked_repos WHERE full_name=?").bind(m.id)));
```

Re-rank the Vectorize matches with the user's current weights + priorities (same `rankRepos` pipeline) before returning.

### Hybrid search

Best results usually come from blending keyword + semantic. v1.0 path:

1. Run the GitHub-style keyword tiers (today's tier 1–4).
2. If results are sparse (< 12), run Vectorize.
3. Dedupe by `fullName`.
4. Score: keyword hits get a small boost; Vectorize matches contribute their similarity score as a tiebreaker.

## Effort breakdown

| Step | Time |
|---|---|
| Create Vectorize index | 30 min |
| Embedding worker (uses Workers AI bge-base) | 1 day |
| Backfill embeddings for the existing ranked_repos | 0.5 day |
| Query path integration | 1 day |
| Hybrid scoring tuning | 1 day |
| **Total** | **3–5 days** |

## What success looks like

- "podcast platform" → top hits include podcastfy, podcast-ai, similar repos with no exact keyword match
- "agent that does X" type queries work as well as "X agents"
- Slider re-ranking still works on the Vectorize-fetched set (radar still drives ranking)
- p50 semantic query latency < 200ms

## Open questions

1. **Embedding model.** `bge-base-en-v1.5` is the default Workers AI English model. For multi-language repos (Chinese MCP repos are a real population) we might want a multilingual model. v1: stay with bge. v1.1: evaluate `bge-m3` if the cross-language fallout is real.
2. **README excerpt size.** 1000 chars probably captures the right signal for most repos. Some long-form READMEs (awesome-lists) would benefit from longer context. Trade-off vs storage cost — 768-dim float vectors × 5000 repos = ~15MB index. Fine.
3. **Re-embedding cadence.** Daily? Weekly? README content changes more slowly than star counts. Weekly re-embed for content, daily refresh of metadata.
4. **Beyond search.** Same vectors enable "show me repos like THIS one" — a new card-level action that uses the clicked repo's embedding as the query. Probably v1.x.
