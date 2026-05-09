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
  // Vanilla-JS A2UI renderer. Mirrors the subset in app/components/A2UIRenderer.tsx
  // so the deployed surface looks identical to what's rendered in the dev app.
  const js = `
const PALETTE = {
  bg: "#0a0a0a",
  fg: "#ededed",
  muted: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  cardBg: "rgba(24,24,27,0.6)",
  highlightBg: "rgba(16,185,129,0.10)",
  highlightBorder: "rgba(16,185,129,0.40)",
  subtleBg: "rgba(24,24,27,0.40)",
  subtleBorder: "rgba(255,255,255,0.05)",
  accent: "#34d399",
  accentFg: "#000",
  inputBg: "rgba(0,0,0,0.40)",
  danger: "#f87171",
  success: "#34d399",
};

const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

function el(tag, styles, children) {
  const e = document.createElement(tag);
  if (styles) Object.assign(e.style, styles);
  if (children) {
    for (const c of [].concat(children)) {
      if (c == null) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
  }
  return e;
}

function render(node) {
  if (!node || typeof node !== "object") return null;
  switch (node.type) {
    case "Layout": {
      const wrap = el("div", {
        display: "flex",
        flexDirection: node.direction === "row" ? "row" : "column",
        gap: (node.gap ?? 12) + "px",
      });
      (node.children || []).forEach((c) => { const r = render(c); if (r) wrap.appendChild(r); });
      return wrap;
    }
    case "Container": {
      const tone = node.tone === "highlight"
        ? { bg: PALETTE.highlightBg, border: PALETTE.highlightBorder }
        : node.tone === "subtle"
          ? { bg: PALETTE.subtleBg, border: PALETTE.subtleBorder }
          : { bg: PALETTE.cardBg, border: PALETTE.border };
      const c = el("div", {
        background: tone.bg,
        border: "1px solid " + tone.border,
        borderRadius: "12px",
        padding: (node.padding ?? 16) + "px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      });
      (node.children || []).forEach((ch) => { const r = render(ch); if (r) c.appendChild(r); });
      return c;
    }
    case "Heading": {
      const sz = node.level === 1 ? "24px" : node.level === 2 ? "20px" : "16px";
      return el("h" + (node.level || 2), { fontSize: sz, fontWeight: "600", margin: "0", letterSpacing: "-0.01em" }, node.text || "");
    }
    case "Text": {
      const color = node.tone === "muted" ? PALETTE.muted
        : node.tone === "danger" ? PALETTE.danger
        : node.tone === "success" ? PALETTE.success
        : PALETTE.fg;
      return el("p", { fontSize: "14px", lineHeight: "1.6", margin: "0", color }, node.text || "");
    }
    case "Button": {
      const variant = node.variant === "secondary"
        ? { bg: "rgba(24,24,27,1)", fg: PALETTE.fg, border: "1px solid " + PALETTE.border }
        : node.variant === "ghost"
          ? { bg: "transparent", fg: PALETTE.fg, border: "1px solid transparent" }
          : { bg: PALETTE.accent, fg: PALETTE.accentFg, border: "1px solid " + PALETTE.accent };
      const b = el("button", {
        background: variant.bg, color: variant.fg, border: variant.border,
        borderRadius: "6px", padding: "8px 16px", fontSize: "14px", fontWeight: "500",
        cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
        alignSelf: "flex-start", fontFamily: FONT_STACK,
      }, node.label || "Button");
      b.addEventListener("click", () => console.log("[a2ui] action:", node.action));
      return b;
    }
    case "TextField": {
      const wrap = el("label", { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" });
      wrap.appendChild(el("span", { color: PALETTE.muted }, node.label || ""));
      const input = el("input", null);
      input.type = "text";
      input.placeholder = node.placeholder || "";
      input.value = node.defaultValue || "";
      Object.assign(input.style, {
        background: PALETTE.inputBg, color: PALETTE.fg,
        border: "1px solid " + PALETTE.border, borderRadius: "6px",
        padding: "8px 12px", fontSize: "14px", fontFamily: FONT_STACK, outline: "none",
      });
      wrap.appendChild(input);
      return wrap;
    }
    case "CheckBox": {
      const wrap = el("label", { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" });
      const cb = el("input", null);
      cb.type = "checkbox"; cb.checked = !!node.defaultChecked;
      Object.assign(cb.style, { width: "16px", height: "16px", accentColor: PALETTE.accent });
      wrap.appendChild(cb);
      wrap.appendChild(el("span", null, node.label || ""));
      return wrap;
    }
    case "Slider": {
      const wrap = el("label", { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" });
      const row = el("div", { display: "flex", justifyContent: "space-between" });
      row.appendChild(el("span", { color: PALETTE.muted }, node.label || ""));
      const valSpan = el("span", { color: PALETTE.muted, fontFamily: MONO_STACK }, String(node.defaultValue ?? node.min ?? 0));
      row.appendChild(valSpan);
      wrap.appendChild(row);
      const r = el("input", null);
      r.type = "range";
      r.min = String(node.min ?? 0); r.max = String(node.max ?? 100); r.step = String(node.step ?? 1);
      r.value = String(node.defaultValue ?? node.min ?? 0);
      Object.assign(r.style, { width: "100%", accentColor: PALETTE.accent });
      r.addEventListener("input", () => { valSpan.textContent = r.value; });
      wrap.appendChild(r);
      return wrap;
    }
    case "List": {
      const ul = el("ul", { listStyle: "none", margin: "0", padding: "0", border: "1px solid " + PALETTE.border, borderRadius: "8px", overflow: "hidden" });
      (node.items || []).forEach((it, i) => {
        const li = el("li", {
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px",
          borderBottom: i === (node.items || []).length - 1 ? "none" : "1px solid " + PALETTE.subtleBorder,
        });
        const left = el("div", null);
        left.appendChild(el("div", { fontSize: "14px", fontWeight: "500" }, it.title || ""));
        if (it.subtitle) left.appendChild(el("div", { fontSize: "12px", color: PALETTE.muted }, it.subtitle));
        li.appendChild(left);
        if (it.meta) li.appendChild(el("span", { fontFamily: MONO_STACK, fontSize: "12px", color: PALETTE.muted }, it.meta));
        ul.appendChild(li);
      });
      return ul;
    }
    case "Tabs": {
      const wrap = el("div", { display: "flex", flexDirection: "column", gap: "12px" });
      const tabbar = el("div", { display: "flex", gap: "4px", borderBottom: "1px solid " + PALETTE.border });
      const content = el("div", null);
      const tabs = node.tabs || [];
      tabs.forEach((t, i) => {
        const btn = el("button", {
          padding: "8px 12px", fontSize: "14px", background: "transparent", border: "none",
          color: i === 0 ? PALETTE.accent : PALETTE.muted, cursor: "pointer",
          borderBottom: "2px solid " + (i === 0 ? PALETTE.accent : "transparent"),
          fontFamily: FONT_STACK,
        }, t.label || ("Tab " + (i + 1)));
        btn.addEventListener("click", () => {
          for (const b of tabbar.children) {
            b.style.color = PALETTE.muted;
            b.style.borderBottom = "2px solid transparent";
          }
          btn.style.color = PALETTE.accent;
          btn.style.borderBottom = "2px solid " + PALETTE.accent;
          content.innerHTML = "";
          const r = render(t.content);
          if (r) content.appendChild(r);
        });
        tabbar.appendChild(btn);
      });
      wrap.appendChild(tabbar);
      if (tabs[0]) { const r = render(tabs[0].content); if (r) content.appendChild(r); }
      wrap.appendChild(content);
      return wrap;
    }
    case "ProgressBar": {
      const pct = Math.max(0, Math.min(100, ((node.value ?? 0) / (node.max ?? 100)) * 100));
      const wrap = el("div", { display: "flex", flexDirection: "column", gap: "4px" });
      if (node.label) wrap.appendChild(el("div", { fontSize: "12px", color: PALETTE.muted }, node.label));
      const track = el("div", { height: "8px", width: "100%", background: "rgba(255,255,255,0.10)", borderRadius: "9999px", overflow: "hidden" });
      const fill = el("div", { height: "100%", background: PALETTE.accent, width: pct + "%" });
      track.appendChild(fill);
      wrap.appendChild(track);
      return wrap;
    }
    case "Image": {
      const img = el("img", null);
      img.src = node.src || ""; img.alt = node.alt || "";
      if (node.width) img.width = node.width;
      if (node.height) img.height = node.height;
      Object.assign(img.style, { borderRadius: "8px", border: "1px solid " + PALETTE.border, maxWidth: "100%" });
      return img;
    }
    case "Code": {
      const pre = el("pre", {
        background: "rgba(0,0,0,0.60)", border: "1px solid " + PALETTE.border, borderRadius: "6px",
        padding: "12px", overflow: "auto", fontSize: "12px", fontFamily: MONO_STACK, color: PALETTE.fg, margin: "0",
      });
      pre.textContent = node.code || "";
      return pre;
    }
    default: {
      return el("span", { fontSize: "12px", color: PALETTE.danger }, "[unknown node: " + (node.type || "?") + "]");
    }
  }
}

export function mount(root, surface) {
  root.innerHTML = "";
  const wrap = el("div", { display: "flex", flexDirection: "column", gap: "16px", fontFamily: FONT_STACK, color: PALETTE.fg });
  const meta = el("div", {
    fontFamily: MONO_STACK, fontSize: "11px", color: PALETTE.muted,
    display: "flex", justifyContent: "space-between",
    paddingBottom: "12px", borderBottom: "1px solid " + PALETTE.border,
  });
  meta.appendChild(el("span", null, "form factor: " + (surface.formFactor || "(unspecified)")));
  if (surface.meta && surface.meta.repo) {
    meta.appendChild(el("span", null, surface.meta.repo));
  }
  wrap.appendChild(meta);
  const r = render(surface.root);
  if (r) wrap.appendChild(r);
  root.appendChild(wrap);
}
`;
  return new Response(js, {
    headers: { "content-type": "application/javascript;charset=utf-8", "cache-control": "public, max-age=60" },
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
