import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchRepo } from "@/app/lib/github";
import type { A2UISurface } from "@/app/lib/a2ui-types";
import { A2UI_FORM_FACTORS } from "@/app/lib/a2ui-types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are RepoRadar's deploy agent. Your job is to look at a GitHub repo and decide what kind of interactive surface would best demonstrate or let a user play with it. Then emit an A2UI JSON surface description.

Form factors you can choose from: ${A2UI_FORM_FACTORS.join(", ")}.
- "dashboard" — for data/analytics/monitoring repos
- "playground" — for libraries / SDKs / parsers / algorithms
- "control-panel" — for IoT / hardware / devices / system controls
- "wizard" — for workflow / onboarding / setup repos
- "widget-grid" — for UI component libraries
- "reader" — for content / docs / educational repos

Available components: Layout (direction row|column, gap, children), Container (padding, tone, children), Heading (level 1-3), Text (tone), Button (label, action), TextField (id, label, placeholder, defaultValue), CheckBox (id, label), Slider (id, label, min, max, step, defaultValue), List (items: title, subtitle, meta), Tabs (tabs: label, content), ProgressBar (label, value, max), Image, Code (language, code).

Your output MUST be a single JSON object matching this schema:
{
  "title": string,
  "formFactor": one of the above,
  "root": A2UINode (a Layout or Container with children),
  "meta": { "repo": string, "hint": string|null }
}

Make the surface USEFUL and INTERESTING for that specific repo. Populate sample data, examples, and inputs that demonstrate what the repo does. Avoid lorem ipsum. Take the user's hint seriously if provided.`;

type DeployBody = { repo: string; hint?: string };

export async function POST(req: NextRequest) {
  let body: DeployBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!body.repo) {
    return NextResponse.json({ ok: false, error: "repo required" }, { status: 400 });
  }

  const slug = makeSlug(body.repo);
  const buildLog: string[] = [];
  const log = (m: string) => {
    buildLog.push(m);
    console.log(`[deploy ${slug}] ${m}`);
  };

  try {
    log(`reading repo ${body.repo}`);
    const ctx = await fetchRepo(body.repo).catch((e: Error) => {
      log(`github fallback: ${e.message}`);
      return null;
    });

    log("calling Anthropic to emit A2UI surface");
    const surface = await generateSurface(body.repo, body.hint, ctx?.description ?? null, ctx?.topics ?? []);
    log(`form factor: ${surface.formFactor}`);

    // Persist the surface to a Cloudflare worker if configured, else keep in memory.
    const workerUrl = process.env.DEPLOY_WORKER_URL;
    let url: string;
    if (workerUrl) {
      log(`forwarding to deploy worker ${workerUrl}`);
      const res = await fetch(`${workerUrl}/persist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, surface }),
      });
      if (!res.ok) throw new Error(`deploy worker ${res.status}`);
      const j = (await res.json()) as { url: string };
      url = j.url;
    } else {
      log("no deploy worker configured — using local /d/[slug] route");
      surfaceStore.set(slug, surface);
      url = `/d/${slug}`;
    }

    log(`deploy complete → ${url}`);
    return NextResponse.json({ ok: true, slug, url, surface, buildLog });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`error: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, buildLog }, { status: 500 });
  }
}

async function generateSurface(
  repo: string,
  hint: string | undefined,
  description: string | null,
  topics: string[],
): Promise<A2UISurface> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Stub for local dev without a key — returns a minimal valid surface.
    return stubSurface(repo, hint, description);
  }

  const client = new Anthropic({ apiKey });
  const userMessage = `Repo: ${repo}
Description: ${description ?? "(none)"}
Topics: ${topics.join(", ") || "(none)"}
User hint: ${hint ?? "(none)"}

Emit an A2UI JSON surface that best demonstrates this repo. Output ONLY the JSON object, no prose.`;

  const resp = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const jsonStr = extractJson(text);
  const parsed = JSON.parse(jsonStr) as A2UISurface;
  parsed.meta = { ...parsed.meta, repo, hint, generatedAt: new Date().toISOString() };
  return parsed;
}

function extractJson(text: string): string {
  // The model may wrap JSON in fences. Strip them.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Or it may emit prose then JSON. Find the first { and last }.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function stubSurface(repo: string, hint: string | undefined, description: string | null): A2UISurface {
  return {
    title: repo,
    formFactor: "reader",
    root: {
      type: "Container",
      padding: 16,
      children: [
        { type: "Heading", level: 1, text: repo },
        {
          type: "Text",
          text: description ?? "Stub surface (set ANTHROPIC_API_KEY to generate real ones).",
        },
        { type: "Text", tone: "muted", text: `Hint: ${hint ?? "(none)"}` },
      ],
    },
    meta: { repo, hint, generatedAt: new Date().toISOString() },
  };
}

function makeSlug(repo: string): string {
  const base = repo.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base.slice(0, 32)}-${suffix}`;
}

// Module-level in-memory store for surfaces during local dev.
// Survives across requests within the same Next.js server process.
export const surfaceStore: Map<string, A2UISurface> = ((globalThis as unknown as { __reporadar_surfaces?: Map<string, A2UISurface> }).__reporadar_surfaces ??= new Map());
