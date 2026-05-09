// reporadar-deploy worker
// Receives deploy requests from the Next.js app, asks Gemini to emit an
// A2UI surface description for the target repo, persists it to R2 + D1,
// and returns the URL where reporadar-serve will render the surface.

const A2UI_FORM_FACTORS = [
  "dashboard",
  "playground",
  "control-panel",
  "wizard",
  "widget-grid",
  "reader",
] as const;

const SYSTEM_PROMPT = `You are RepoRadar's deploy agent. Your job is to look at a GitHub repo and decide what kind of interactive surface would best demonstrate or let a user play with it. Then emit an A2UI JSON surface description.

Form factors: ${A2UI_FORM_FACTORS.join(", ")}.
- "dashboard" — for data/analytics/monitoring repos
- "playground" — for libraries / SDKs / parsers / algorithms
- "control-panel" — for IoT / hardware / devices / system controls
- "wizard" — for workflow / onboarding / setup repos
- "widget-grid" — for UI component libraries
- "reader" — for content / docs / educational repos

Available components (each node has a "type" string, listed):
- Layout { direction: "row"|"column", gap?: number, children: [] }
- Container { padding?: number, tone?: "default"|"subtle"|"highlight", children: [] }
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

Output a single JSON object:
{
  "title": string,
  "formFactor": one of the above,
  "root": A2UINode,
  "meta": { "repo": string, "hint": string|null }
}

Make the surface USEFUL and INTERESTING for that specific repo. Populate sample data, examples, and inputs that demonstrate what the repo does. Avoid lorem ipsum.`;

export interface Env {
  DB: D1Database;
  SURFACES: R2Bucket;
  GOOGLE_API_KEY: string;
  GEMINI_MODEL?: string;
  GITHUB_TOKEN?: string;
  GITHUB_API_BASE: string;
  PUBLIC_HOST?: string; // e.g. "reporadar.io" — appended to slugs to form deploy URL
}

type DeployRequest = {
  repo: string;
  hint?: string;
};

type Surface = {
  title: string;
  formFactor: string;
  root: unknown;
  meta?: Record<string, unknown>;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/persist" && req.method === "POST") {
      const body = (await req.json()) as { slug: string; surface: Surface };
      await persist(body.slug, body.surface, env);
      const host = env.PUBLIC_HOST || "reporadar.io";
      return json({ ok: true, url: `https://${body.slug}.${host}` });
    }

    if (url.pathname === "/deploy" && req.method === "POST") {
      try {
        const body = (await req.json()) as DeployRequest;
        const result = await deploy(body, env);
        return json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ ok: false, error: msg }, 500);
      }
    }

    return new Response("Not Found", { status: 404, headers: cors });
  },
};

async function deploy(body: DeployRequest, env: Env) {
  const slug = makeSlug(body.repo);
  const buildLog: string[] = [];
  const log = (m: string) => buildLog.push(m);

  log(`reading repo ${body.repo}`);
  const repoCtx = await fetchRepoContext(body.repo, env).catch((e: Error) => {
    log(`github fetch failed: ${e.message}`);
    return { description: null, topics: [] as string[] };
  });

  log("calling Gemini for A2UI surface");
  const surface = await generateSurface(body.repo, body.hint, repoCtx.description, repoCtx.topics, env);
  log(`form factor: ${surface.formFactor}`);

  await persist(slug, surface, env);
  log("persisted to R2 + D1");

  const host = env.PUBLIC_HOST || "reporadar.io";
  const url = `https://${slug}.${host}`;
  log(`deploy complete → ${url}`);

  return { ok: true, slug, url, formFactor: surface.formFactor, surface, buildLog };
}

async function persist(slug: string, surface: Surface, env: Env): Promise<void> {
  await env.SURFACES.put(`${slug}/surface.json`, JSON.stringify(surface), {
    httpMetadata: { contentType: "application/json" },
  });
  await env.DB.prepare(
    `INSERT INTO deploys (slug, repo, hint, form_factor, r2_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET repo=excluded.repo, hint=excluded.hint,
       form_factor=excluded.form_factor, r2_key=excluded.r2_key, created_at=excluded.created_at`,
  )
    .bind(
      slug,
      String(surface.meta?.repo ?? ""),
      String(surface.meta?.hint ?? ""),
      surface.formFactor,
      `${slug}/surface.json`,
      Date.now(),
    )
    .run();
}

async function generateSurface(
  repo: string,
  hint: string | undefined,
  description: string | null,
  topics: string[],
  env: Env,
): Promise<Surface> {
  if (!env.GOOGLE_API_KEY) {
    return stubSurface(repo, hint, description);
  }

  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`;

  const userText = `Repo: ${repo}
Description: ${description ?? "(none)"}
Topics: ${topics.join(", ") || "(none)"}
User hint: ${hint ?? "(none)"}

Emit an A2UI JSON surface that best demonstrates this repo. Output ONLY the JSON object, no prose.`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gemini ${res.status}: ${t}`);
  }
  type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const j = (await res.json()) as GeminiResponse;
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const surface = JSON.parse(extractJson(text)) as Surface;
  surface.meta = { ...(surface.meta ?? {}), repo, hint, generatedAt: new Date().toISOString() };
  return surface;
}

function stubSurface(repo: string, hint: string | undefined, description: string | null): Surface {
  return {
    title: repo,
    formFactor: "reader",
    root: {
      type: "Container",
      padding: 16,
      children: [
        { type: "Heading", level: 1, text: repo },
        { type: "Text", text: description ?? "Stub surface (set GOOGLE_API_KEY)." },
        { type: "Text", tone: "muted", text: `Hint: ${hint ?? "(none)"}` },
      ],
    },
    meta: { repo, hint, generatedAt: new Date().toISOString() },
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function makeSlug(repo: string): string {
  const base = repo.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base.slice(0, 32)}-${suffix}`;
}

async function fetchRepoContext(
  fullName: string,
  env: Env,
): Promise<{ description: string | null; topics: string[] }> {
  const headers: Record<string, string> = {
    "User-Agent": "reporadar-deploy/0.1",
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const res = await fetch(`${env.GITHUB_API_BASE}/repos/${fullName}`, { headers });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const j = (await res.json()) as { description: string | null; topics?: string[] };
  return { description: j.description, topics: j.topics ?? [] };
}

function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
