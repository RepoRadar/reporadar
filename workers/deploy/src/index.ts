// reporadar-deploy worker
// Receives deploy requests from the Next.js app, asks Anthropic to emit an
// A2UI surface description for the target repo, persists it to R2 + D1,
// and returns a URL where the surface will be served by reporadar-serve.

export interface Env {
  DB: D1Database;
  SURFACES: R2Bucket;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN?: string;
  GITHUB_API_BASE: string;
}

type DeployRequest = {
  repo: string;       // owner/name
  hint?: string;      // user freeform hint
  origin?: string;    // optional override for the public URL host
};

type DeployResponse = {
  ok: true;
  slug: string;
  url: string;
  formFactor: string;
  buildLog: string[];
} | { ok: false; error: string };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json", ...cors },
      });
    }

    if (url.pathname === "/deploy" && req.method === "POST") {
      try {
        const body = (await req.json()) as DeployRequest;
        const result = await deploy(body, env);
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json", ...cors },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(
          JSON.stringify({ ok: false, error: msg } satisfies DeployResponse),
          { status: 500, headers: { "content-type": "application/json", ...cors } },
        );
      }
    }

    return new Response("Not Found", { status: 404, headers: cors });
  },
};

async function deploy(body: DeployRequest, env: Env): Promise<DeployResponse> {
  const slug = makeSlug(body.repo);
  const buildLog: string[] = [];
  const log = (m: string) => buildLog.push(`${new Date().toISOString()} ${m}`);

  log(`reading repo ${body.repo}`);
  const repoCtx = await fetchRepoContext(body.repo, env).catch((e: Error) => {
    log(`github fetch failed: ${e.message}`);
    return { readme: "", tree: [] as string[], description: null as string | null };
  });

  log("calling Anthropic to emit A2UI surface");
  // STUB: in slice 7 we wire the real Anthropic call here.
  const surface = {
    title: body.repo,
    formFactor: "dashboard" as const,
    root: {
      type: "Layout" as const,
      direction: "column" as const,
      gap: 16,
      children: [
        { type: "Heading" as const, level: 1 as const, text: body.repo },
        {
          type: "Text" as const,
          text: repoCtx.description ?? "Generative-UI placeholder surface — slice 7 will wire Anthropic.",
        },
        {
          type: "Text" as const,
          tone: "muted" as const,
          text: `Hint: ${body.hint ?? "(none)"}`,
        },
      ],
    },
    meta: { repo: body.repo, hint: body.hint, generatedAt: new Date().toISOString() },
  };

  log("writing surface to R2");
  await env.SURFACES.put(`${slug}/surface.json`, JSON.stringify(surface), {
    httpMetadata: { contentType: "application/json" },
  });

  log("recording deploy in D1");
  await env.DB.prepare(
    `INSERT INTO deploys (slug, repo, hint, form_factor, r2_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(slug, body.repo, body.hint ?? null, surface.formFactor, `${slug}/surface.json`, Date.now())
    .run()
    .catch((e: Error) => log(`d1 insert skipped: ${e.message}`));

  const host = body.origin ?? "reporadar.io";
  const url = `https://${slug}.${host}`;
  log(`deploy complete → ${url}`);

  return { ok: true, slug, url, formFactor: surface.formFactor, buildLog };
}

function makeSlug(repo: string): string {
  const base = repo.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base.slice(0, 32)}-${suffix}`;
}

async function fetchRepoContext(
  fullName: string,
  env: Env,
): Promise<{ readme: string; tree: string[]; description: string | null }> {
  const headers: Record<string, string> = {
    "User-Agent": "reporadar-deploy/0.1",
    Accept: "application/vnd.github.v3+json",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const [meta, readme] = await Promise.all([
    fetch(`${env.GITHUB_API_BASE}/repos/${fullName}`, { headers }).then((r) =>
      r.ok ? r.json<{ description: string | null; default_branch: string }>() : Promise.reject(new Error(`repo ${r.status}`)),
    ),
    fetch(`${env.GITHUB_API_BASE}/repos/${fullName}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" } })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => ""),
  ]);
  return { readme, tree: [], description: meta.description };
}
