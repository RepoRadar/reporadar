import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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

Available components (each node has a "type" string, listed):
- Layout { direction: "row"|"column", gap?: number, children: A2UINode[] }
- Container { padding?: number, tone?: "default"|"subtle"|"highlight", children: A2UINode[] }
- Heading { level: 1|2|3, text: string }
- Text { text: string, tone?: "default"|"muted"|"danger"|"success" }
- Button { label: string, action: string, variant?: "primary"|"secondary"|"ghost" }
- TextField { id: string, label: string, placeholder?: string, defaultValue?: string }
- CheckBox { id: string, label: string, defaultChecked?: boolean }
- Slider { id: string, label: string, min: number, max: number, step?: number, defaultValue: number }
- List { items: { title: string, subtitle?: string, meta?: string }[] }
- Tabs { tabs: { label: string, content: A2UINode }[] }
- ProgressBar { label?: string, value: number, max: number }
- Image { src: string, alt: string, width?: number, height?: number }
- Code { language?: string, code: string }

Output a single JSON object with this shape:
{
  "title": string,
  "formFactor": one of: ${A2UI_FORM_FACTORS.map((f) => `"${f}"`).join(", ")},
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

    log("calling Gemini to emit A2UI surface");
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
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return stubSurface(repo, hint, description);
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      // We give the model a loose schema hint via the prompt — the renderer
      // is forgiving enough that a strict JSON-schema response would over-
      // constrain creative form-factor choices.
      temperature: 0.7,
    },
  });

  const userMessage = `Repo: ${repo}
Description: ${description ?? "(none)"}
Topics: ${topics.join(", ") || "(none)"}
User hint: ${hint ?? "(none)"}

Emit an A2UI JSON surface that best demonstrates this repo. Output ONLY the JSON object, no prose.`;

  const result = await model.generateContent(userMessage);
  const text = result.response.text();

  const jsonStr = extractJson(text);
  const parsed = JSON.parse(jsonStr) as A2UISurface;
  parsed.meta = { ...parsed.meta, repo, hint, generatedAt: new Date().toISOString() };
  return parsed;
}

// Suppress unused import warning — SchemaType is exported for future structured
// output if we tighten the schema later.
void SchemaType;

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
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
          text: description ?? "Stub surface (set GOOGLE_API_KEY to generate real ones).",
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

export const surfaceStore: Map<string, A2UISurface> = ((globalThis as unknown as { __reporadar_surfaces?: Map<string, A2UISurface> }).__reporadar_surfaces ??= new Map());
