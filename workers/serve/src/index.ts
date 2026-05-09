// reporadar-serve worker
// Routes *.reporadar.io requests to the right A2UI surface.
// Strategy: parse the subdomain from the Host header, look up the slug in D1,
// stream the A2UI JSON from R2, and wrap it in an HTML shell that loads the
// client A2UI renderer.

export interface Env {
  DB: D1Database;
  SURFACES: R2Bucket;
}

const RENDERER_PATH = "/_renderer.js";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const host = req.headers.get("host") ?? url.hostname;

    if (url.pathname === "/_health") {
      return json({ ok: true });
    }

    if (url.pathname === RENDERER_PATH) {
      return serveRenderer();
    }

    const slug = parseSlug(host);
    if (!slug) {
      return new Response(landingHtml(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    if (url.pathname === "/surface.json") {
      const obj = await env.SURFACES.get(`${slug}/surface.json`);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: { "content-type": "application/json" },
      });
    }

    // Default: serve HTML shell that fetches the surface JSON and renders it.
    return new Response(shellHtml(slug), {
      headers: { "content-type": "text/html;charset=utf-8" },
    });
  },
};

function parseSlug(host: string): string | null {
  // Accept "<slug>.reporadar.io" and "<slug>.reporadar-serve.<account>.workers.dev"
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const first = parts[0];
  if (first === "www" || first === "reporadar" || first === "reporadar-serve") return null;
  if (!/^[a-z0-9-]+$/i.test(first)) return null;
  return first;
}

function shellHtml(slug: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(slug)} · RepoRadar</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #0a0a0a; color: #ededed; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      #root { min-height: 100vh; padding: 24px; max-width: 960px; margin: 0 auto; }
      .loading { color: #666; font-family: ui-monospace, monospace; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="root"><div class="loading">loading surface…</div></div>
    <script type="module">
      const surface = await fetch("/surface.json").then(r => r.json());
      window.__A2UI_SURFACE__ = surface;
      const m = await import("${RENDERER_PATH}");
      m.mount(document.getElementById("root"), surface);
    </script>
  </body>
</html>`;
}

function landingHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>RepoRadar serve</title>
  <style>body{font-family:ui-monospace,monospace;background:#0a0a0a;color:#ededed;padding:48px}</style>
  </head>
  <body><h1>reporadar-serve</h1><p>Hit <code>&lt;slug&gt;.reporadar.io</code> to render an A2UI surface.</p></body>
</html>`;
}

function serveRenderer(): Response {
  // Slice 8 will replace this with a real bundled renderer.
  const js = `
export function mount(root, surface) {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:16px";
  const h = document.createElement("h1");
  h.textContent = surface.title || "Surface";
  h.style.cssText = "font-size:24px;font-weight:600;margin:0";
  wrap.appendChild(h);
  const meta = document.createElement("div");
  meta.style.cssText = "font:12px ui-monospace,monospace;color:#888";
  meta.textContent = "form factor: " + (surface.formFactor || "(unspecified)");
  wrap.appendChild(meta);
  const pre = document.createElement("pre");
  pre.style.cssText = "background:#111;border:1px solid #222;border-radius:8px;padding:16px;overflow:auto;font-size:12px";
  pre.textContent = JSON.stringify(surface, null, 2);
  wrap.appendChild(pre);
  root.appendChild(wrap);
}
`;
  return new Response(js, {
    headers: { "content-type": "application/javascript;charset=utf-8" },
  });
}

function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
