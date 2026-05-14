import { NextRequest, NextResponse } from "next/server";
import { fetchRepo, fetchTrending } from "@/app/lib/github";
import { translateRepoDescriptions } from "@/app/lib/translate";
import type { Repo } from "@/app/lib/types";

export const runtime = "nodejs";

// 5-minute in-memory cache to keep the demo within GitHub's anon rate limit.
const cache = new Map<string, { at: number; data: Repo[] }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const topic = params.get("topic") ?? "";
  const query = params.get("q") ?? "";
  const since = params.get("since") ?? ""; // YYYY-MM-DD; empty = default 30d
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  // Big-page mode: up to 100 per request (GitHub Search API's per_page cap).
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "10", 10) || 10));
  const enrich = params.get("enrich") === "1";

  const cacheKey = `t:${topic}|q:${query}|s:${since}|p:${page}|n:${limit}|e:${enrich ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const base = await fetchTrending({
      topic: topic || undefined,
      query: query || undefined,
      since: since || undefined,
      page,
      perPage: limit,
    });
    let data = base;
    if (enrich) {
      data = await Promise.all(
        base.map(async (r) => {
          try {
            const full = await fetchRepo(r.fullName);
            return { ...r, readmeLength: full.readmeLength, recentCommits: full.recentCommits };
          } catch {
            return r;
          }
        }),
      );
    }
    // Translate non-English descriptions to English (batched single Gemini
    // call). Mutates repos in place; cached at module level so repeat hits
    // are free.
    await translateRepoDescriptions(data);

    cache.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
