import { NextRequest, NextResponse } from "next/server";
import { fetchRepo, fetchTrending } from "@/app/lib/github";
import type { Repo } from "@/app/lib/types";

export const runtime = "nodejs";

// 5-minute in-memory cache to keep the demo within GitHub's anon rate limit.
const cache = new Map<string, { at: number; data: Repo[] }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const topic = params.get("topic") ?? "";
  const query = params.get("q") ?? "";
  const limit = Math.min(12, Math.max(1, parseInt(params.get("limit") ?? "8", 10) || 8));
  const enrich = params.get("enrich") === "1";

  const cacheKey = `t:${topic}|q:${query}|n:${limit}|e:${enrich ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const base = await fetchTrending({
      topic: topic || undefined,
      query: query || undefined,
      perPage: limit,
    });
    let data = base;
    if (enrich) {
      // Pull README length + recent commits for richer scoring.
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
    cache.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
