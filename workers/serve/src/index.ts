// reporadar-serve worker
// Routes *.reporadar.io requests to the right A2UI surface and exposes a
// per-slug interactive backend (records + counters in D1) so the deployed
// surfaces are real apps, not static prints.

export interface Env {
  DB: D1Database;
  SURFACES: R2Bucket;
}

const RENDERER_PATH = "/_renderer.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const host = req.headers.get("host") ?? url.hostname;

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/_health") return json({ ok: true });
    if (url.pathname === RENDERER_PATH) return serveRenderer();

    const slug = parseSlug(host);
    if (!slug) {
      return new Response(landingHtml(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // ---- per-slug interactive backend ----
    if (url.pathname === "/api/records") {
      if (req.method === "GET") {
        const type = url.searchParams.get("type");
        const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20);
        const rows = type
          ? await env.DB.prepare(
              `SELECT id, type, data, created_at FROM records WHERE slug = ?1 AND type = ?2 ORDER BY created_at DESC LIMIT ?3`,
            )
              .bind(slug, type, limit)
              .all()
          : await env.DB.prepare(
              `SELECT id, type, data, created_at FROM records WHERE slug = ?1 ORDER BY created_at DESC LIMIT ?2`,
            )
              .bind(slug, limit)
              .all();
        const items = (rows.results as Array<{ id: number; type: string; data: string; created_at: number }>).map((r) => ({
          id: r.id,
          type: r.type,
          createdAt: r.created_at,
          data: safeParse(r.data),
        }));
        return json({ ok: true, items });
      }
      if (req.method === "POST") {
        const body = (await req.json()) as { type?: string; data?: unknown };
        const type = (body.type ?? "form").slice(0, 60);
        const dataStr = JSON.stringify(body.data ?? {});
        const now = Date.now();
        const result = await env.DB.prepare(
          `INSERT INTO records (slug, type, data, created_at) VALUES (?1, ?2, ?3, ?4)`,
        )
          .bind(slug, type, dataStr, now)
          .run();
        return json({ ok: true, id: result.meta.last_row_id, createdAt: now });
      }
    }

    const recordIdMatch = url.pathname.match(/^\/api\/records\/(\d+)$/);
    if (recordIdMatch && req.method === "DELETE") {
      const id = parseInt(recordIdMatch[1], 10);
      await env.DB.prepare(`DELETE FROM records WHERE id = ?1 AND slug = ?2`).bind(id, slug).run();
      return json({ ok: true });
    }

    const counterMatch = url.pathname.match(/^\/api\/counters\/([a-zA-Z0-9_-]+)$/);
    if (counterMatch) {
      const name = counterMatch[1];
      if (req.method === "GET") {
        const row = await env.DB.prepare(
          `SELECT value FROM counters WHERE slug = ?1 AND name = ?2`,
        )
          .bind(slug, name)
          .first<{ value: number }>();
        return json({ ok: true, value: row?.value ?? 0 });
      }
      if (req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { delta?: number };
        const delta = Math.trunc(body.delta ?? 1);
        const now = Date.now();
        await env.DB.prepare(
          `INSERT INTO counters (slug, name, value, updated_at) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(slug, name) DO UPDATE SET value = value + ?3, updated_at = ?4`,
        )
          .bind(slug, name, delta, now)
          .run();
        const row = await env.DB.prepare(
          `SELECT value FROM counters WHERE slug = ?1 AND name = ?2`,
        )
          .bind(slug, name)
          .first<{ value: number }>();
        return json({ ok: true, value: row?.value ?? delta });
      }
    }

    // ---- surface delivery ----
    if (url.pathname === "/surface.json") {
      const obj = await env.SURFACES.get(`${slug}/surface.json`);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: { "content-type": "application/json", ...cors },
      });
    }

    return new Response(shellHtml(slug), {
      headers: { "content-type": "text/html;charset=utf-8" },
    });
  },
};

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function parseSlug(host: string): string | null {
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
      body { margin: 0; background: #08070d; color: #fafafa; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background-image: radial-gradient(ellipse 800px 600px at 0% 0%, rgba(244, 63, 138, 0.08), transparent 60%), radial-gradient(ellipse 800px 600px at 100% 100%, rgba(34, 211, 238, 0.06), transparent 60%); background-attachment: fixed; }
      #root { min-height: 100vh; padding: 24px; max-width: 960px; margin: 0 auto; }
      .loading { color: #6b6878; font-family: ui-monospace, monospace; font-size: 12px; }
      header.rr-banner { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:16px; font:11px ui-monospace,monospace; color:#6b6878; }
      header.rr-banner a { color:#22d3ee; text-decoration:none; }
      header.rr-banner a:hover { text-decoration:underline; }
      .rr-toast { position:fixed; right:16px; bottom:16px; background:#14121e; border:1px solid #22d3ee; color:#22d3ee; padding:8px 12px; border-radius:6px; font:11px ui-monospace,monospace; z-index:1000; }
    </style>
  </head>
  <body>
    <header class="rr-banner">
      <span>● <strong style="color:#fafafa">${escapeHtml(slug)}</strong> · agent-generated · interactive D1-backed</span>
      <a href="https://reporadar.io">↗ reporadar.io</a>
    </header>
    <div id="root"><div class="loading">loading surface…</div></div>
    <footer style="margin-top:32px;padding:16px 12px;border-top:1px solid rgba(255,255,255,0.08);font:11px ui-monospace,monospace;color:#6b6878;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;">
      <span>Built by <a href="https://github.com/letsgochristo" target="_blank" rel="noopener noreferrer" style="color:#22c55e;text-decoration:none;">@letsgochristo</a> + <a href="https://github.com/priyanshuharshbodhi1" target="_blank" rel="noopener noreferrer" style="color:#22c55e;text-decoration:none;">@priyanshuharshbodhi1</a> at AI Tinkerers SF</span>
      <span><a href="https://github.com/RepoRadar/reporadar" target="_blank" rel="noopener noreferrer" style="color:#22d3ee;text-decoration:none;">github.com/RepoRadar/reporadar</a> · MIT</span>
    </footer>
    <script type="module">
      const surface = await fetch("/surface.json").then(r => r.json()).catch(() => null);
      if (!surface) {
        document.getElementById("root").innerHTML = '<p style="color:#f87171;font-family:ui-monospace,monospace">surface not found</p>';
      } else {
        window.__A2UI_SURFACE__ = surface;
        const m = await import("${RENDERER_PATH}");
        m.mount(document.getElementById("root"), surface);
      }
    </script>
  </body>
</html>`;
}

function landingHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>RepoRadar serve</title>
  <style>body{font-family:ui-monospace,monospace;background:#08070d;color:#fafafa;padding:48px}a{color:#22d3ee}</style>
  </head>
  <body><h1>reporadar-serve</h1><p>Hit <code>&lt;slug&gt;.reporadar.io</code> to render an A2UI surface.</p><p><a href="https://reporadar.io">go to reporadar.io →</a></p></body>
</html>`;
}

function serveRenderer(): Response {
  // Vanilla-JS A2UI renderer with state tracking + interactive actions:
  //   action="submit"        → collect sibling input values, POST /api/records, reload list
  //   action="refresh"       → re-fetch all <List source="records"> in the surface
  //   action="delete:N"      → DELETE /api/records/N, refresh
  //   action="increment:N"   → POST /api/counters/N, update visible value
  //   List { source: "records", recordType: "X" } → auto-loads from /api/records on mount.
  const js = `
const PALETTE = {
  bg: "#08070d", fg: "#fafafa", muted: "#a1a1aa", dim: "#6b6878",
  border: "rgba(255,255,255,0.10)", borderStrong: "rgba(255,255,255,0.16)",
  cardBg: "rgba(20,18,30,0.6)", subtleBg: "rgba(20,18,30,0.35)", highlightBg: "rgba(244,63,138,0.10)", highlightBorder: "rgba(244,63,138,0.40)",
  primary: "#f43f8a", primaryGlow: "rgba(244,63,138,0.4)", secondary: "#22d3ee", secondaryGlow: "rgba(34,211,238,0.4)",
  accent: "#fbbf24", danger: "#f87171", success: "#22d3ee", inputBg: "rgba(0,0,0,0.40)",
};
const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Global state — a registry of all input values keyed by id, plus a registry
// of List nodes that auto-load records (so refresh can re-mount them).
const State = {
  inputs: new Map(),       // id -> current value
  listNodes: new Map(),    // randomId -> { node, host, type }
  rootEl: null,
  surface: null,
};

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

function toast(msg, tone) {
  const t = document.createElement("div");
  t.className = "rr-toast";
  t.textContent = msg;
  if (tone === "danger") {
    t.style.color = PALETTE.danger;
    t.style.borderColor = PALETTE.danger;
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

async function submitForm(buttonEl) {
  // Walk up to the nearest container, collect every <input> and <select>
  // descendant id-value pair, POST to /api/records.
  const container = buttonEl.closest("[data-rr-form]") || State.rootEl;
  if (!container) return;
  const fields = container.querySelectorAll("[data-rr-input]");
  const data = {};
  for (const f of fields) {
    const id = f.getAttribute("data-rr-input");
    if (!id) continue;
    if (f.type === "checkbox") data[id] = f.checked;
    else if (f.type === "range" || f.type === "number") data[id] = parseFloat(f.value);
    else data[id] = f.value;
  }
  const recordType = container.getAttribute("data-rr-record-type") || "form";
  buttonEl.disabled = true;
  const originalLabel = buttonEl.textContent;
  buttonEl.textContent = "saving…";
  try {
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: recordType, data }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "submit failed");
    toast("saved ✓");
    refreshAllLists();
    // Clear text fields after successful submit.
    for (const f of fields) {
      if (f.type === "text") f.value = "";
    }
  } catch (err) {
    toast("save failed — " + (err.message || err), "danger");
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalLabel;
  }
}

async function deleteRecord(id) {
  try {
    const res = await fetch("/api/records/" + id, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) throw new Error("delete failed");
    toast("deleted ✓");
    refreshAllLists();
  } catch (err) {
    toast("delete failed", "danger");
  }
}

async function incrementCounter(name, host) {
  try {
    const res = await fetch("/api/counters/" + name, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delta: 1 }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error("counter failed");
    if (host) host.textContent = String(j.value);
    toast("counter +1");
  } catch (err) {
    toast("counter failed", "danger");
  }
}

async function loadCounter(name, host) {
  try {
    const res = await fetch("/api/counters/" + name);
    const j = await res.json();
    if (j.ok) host.textContent = String(j.value);
  } catch {}
}

async function refreshAllLists() {
  for (const { node, host, type } of State.listNodes.values()) {
    await loadList(node, host, type);
  }
}

async function loadList(node, host, type) {
  try {
    const url = "/api/records" + (type ? ("?type=" + encodeURIComponent(type)) : "");
    const res = await fetch(url);
    const j = await res.json();
    if (!res.ok || !j.ok) return;
    host.innerHTML = "";
    if (!j.items || j.items.length === 0) {
      host.appendChild(el("li", {
        padding: "12px 16px", color: PALETTE.dim, fontStyle: "italic", fontSize: "12px",
      }, "no records yet — submit the form above"));
      return;
    }
    j.items.forEach((rec, i) => {
      const data = rec.data && typeof rec.data === "object" ? rec.data : {};
      const title = data.title || data.name || data.subject || JSON.stringify(data).slice(0, 80);
      const sub = data.subtitle || data.description || data.body || data.note || null;
      const ts = new Date(rec.createdAt).toLocaleString();
      const li = el("li", {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px",
        borderBottom: i === j.items.length - 1 ? "none" : "1px solid " + PALETTE.border,
        gap: "12px",
      });
      const left = el("div", { display: "flex", flexDirection: "column", gap: "2px", flex: "1", minWidth: "0" });
      left.appendChild(el("div", { fontSize: "13px", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis" }, String(title)));
      if (sub) left.appendChild(el("div", { fontSize: "11px", color: PALETTE.dim }, String(sub)));
      li.appendChild(left);
      const meta = el("div", { display: "flex", alignItems: "center", gap: "8px" });
      meta.appendChild(el("span", { fontFamily: MONO_STACK, fontSize: "10px", color: PALETTE.dim }, ts));
      const delBtn = el("button", {
        background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.dim,
        borderRadius: "4px", padding: "2px 8px", fontSize: "10px", cursor: "pointer", fontFamily: MONO_STACK,
      }, "×");
      delBtn.addEventListener("click", () => deleteRecord(rec.id));
      meta.appendChild(delBtn);
      li.appendChild(meta);
      host.appendChild(li);
    });
  } catch (err) {
    console.warn("[a2ui] list load failed", err);
  }
}

function uid() { return Math.random().toString(36).slice(2); }

function render(node) {
  if (!node || typeof node !== "object") return null;
  switch (node.type) {
    case "Layout": {
      const wrap = el("div", {
        display: "flex",
        flexDirection: node.direction === "row" ? "row" : "column",
        gap: (node.gap ?? 12) + "px",
        flexWrap: node.direction === "row" ? "wrap" : "nowrap",
      });
      (node.children || []).forEach((c) => { const r = render(c); if (r) wrap.appendChild(r); });
      return wrap;
    }
    case "Container": {
      const tone = node.tone === "highlight"
        ? { bg: PALETTE.highlightBg, border: PALETTE.highlightBorder }
        : node.tone === "subtle"
          ? { bg: PALETTE.subtleBg, border: PALETTE.border }
          : { bg: PALETTE.cardBg, border: PALETTE.border };
      const c = el("div", {
        background: tone.bg, border: "1px solid " + tone.border, borderRadius: "12px",
        padding: (node.padding ?? 16) + "px", display: "flex", flexDirection: "column", gap: "12px",
      });
      // If this container holds form-like fields, mark it so submitForm can find it.
      if (node.formId || node.recordType) {
        c.setAttribute("data-rr-form", node.formId || "form");
        if (node.recordType) c.setAttribute("data-rr-record-type", node.recordType);
      } else {
        c.setAttribute("data-rr-form", "");
      }
      (node.children || []).forEach((ch) => { const r = render(ch); if (r) c.appendChild(r); });
      return c;
    }
    case "Heading": {
      const sz = node.level === 1 ? "26px" : node.level === 2 ? "18px" : "14px";
      return el("h" + (node.level || 2), { fontSize: sz, fontWeight: "600", margin: "0", letterSpacing: "-0.01em" }, node.text || "");
    }
    case "Text": {
      const color = node.tone === "muted" ? PALETTE.muted : node.tone === "danger" ? PALETTE.danger : node.tone === "success" ? PALETTE.success : PALETTE.fg;
      return el("p", { fontSize: "14px", lineHeight: "1.6", margin: "0", color }, node.text || "");
    }
    case "Button": {
      const variant = node.variant === "secondary"
        ? { bg: "transparent", fg: PALETTE.fg, border: "1px solid " + PALETTE.borderStrong, glow: "none" }
        : node.variant === "ghost"
          ? { bg: "transparent", fg: PALETTE.fg, border: "1px solid transparent", glow: "none" }
          : { bg: PALETTE.primary, fg: "#08070d", border: "1px solid " + PALETTE.primary, glow: "0 0 16px " + PALETTE.primaryGlow };
      const b = el("button", {
        background: variant.bg, color: variant.fg, border: variant.border, boxShadow: variant.glow,
        borderRadius: "6px", padding: "9px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start",
        fontFamily: FONT_STACK, transition: "all 0.15s ease",
      }, node.label || "Button");
      b.addEventListener("click", () => {
        const action = String(node.action || "");
        if (action === "submit") return submitForm(b);
        if (action === "refresh") return refreshAllLists();
        if (action.startsWith("delete:")) return deleteRecord(action.slice(7));
        if (action.startsWith("increment:")) {
          const name = action.slice(10);
          const next = b.parentElement && b.parentElement.querySelector("[data-rr-counter='" + name + "']");
          return incrementCounter(name, next);
        }
        // link:<url> — open an external URL in a new tab. Used by the
        // needs-runtime explainer surfaces so users can ping the team
        // on GitHub when a repo can't be statically demoed.
        if (action.startsWith("link:")) {
          const url = action.slice(5);
          try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
          return;
        }
        toast("action: " + action);
      });
      return b;
    }
    case "TextField": {
      const wrap = el("label", { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" });
      wrap.appendChild(el("span", { color: PALETTE.muted }, node.label || ""));
      const input = el("input", null);
      input.type = "text";
      input.placeholder = node.placeholder || "";
      input.value = node.defaultValue || "";
      input.setAttribute("data-rr-input", node.id || ("text-" + uid()));
      Object.assign(input.style, {
        background: PALETTE.inputBg, color: PALETTE.fg, border: "1px solid " + PALETTE.borderStrong,
        borderRadius: "6px", padding: "8px 12px", fontSize: "14px", fontFamily: FONT_STACK, outline: "none",
      });
      input.addEventListener("focus", () => {
        input.style.borderColor = PALETTE.primary;
        input.style.boxShadow = "0 0 0 3px " + PALETTE.primaryGlow;
      });
      input.addEventListener("blur", () => {
        input.style.borderColor = PALETTE.borderStrong;
        input.style.boxShadow = "none";
      });
      wrap.appendChild(input);
      return wrap;
    }
    case "CheckBox": {
      const wrap = el("label", { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" });
      const cb = el("input", null);
      cb.type = "checkbox";
      cb.checked = !!node.defaultChecked;
      cb.setAttribute("data-rr-input", node.id || ("check-" + uid()));
      Object.assign(cb.style, { width: "16px", height: "16px", accentColor: PALETTE.primary, cursor: "pointer" });
      wrap.appendChild(cb);
      wrap.appendChild(el("span", null, node.label || ""));
      return wrap;
    }
    case "Slider": {
      const wrap = el("label", { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" });
      const row = el("div", { display: "flex", justifyContent: "space-between" });
      row.appendChild(el("span", { color: PALETTE.muted }, node.label || ""));
      const valSpan = el("span", { color: PALETTE.primary, fontFamily: MONO_STACK }, String(node.defaultValue ?? node.min ?? 0));
      row.appendChild(valSpan);
      wrap.appendChild(row);
      const r = el("input", null);
      r.type = "range";
      r.min = String(node.min ?? 0); r.max = String(node.max ?? 100); r.step = String(node.step ?? 1);
      r.value = String(node.defaultValue ?? node.min ?? 0);
      r.setAttribute("data-rr-input", node.id || ("range-" + uid()));
      Object.assign(r.style, { width: "100%", accentColor: PALETTE.primary });
      r.addEventListener("input", () => { valSpan.textContent = r.value; });
      wrap.appendChild(r);
      return wrap;
    }
    case "List": {
      const ul = el("ul", { listStyle: "none", margin: "0", padding: "0", border: "1px solid " + PALETTE.border, borderRadius: "8px", overflow: "hidden", background: PALETTE.subtleBg });
      if (node.source === "records") {
        // Auto-load list from /api/records
        const id = uid();
        State.listNodes.set(id, { node, host: ul, type: node.recordType || null });
        loadList(node, ul, node.recordType || null);
      } else {
        (node.items || []).forEach((it, i) => {
          const li = el("li", {
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px",
            borderBottom: i === (node.items || []).length - 1 ? "none" : "1px solid " + PALETTE.border,
          });
          const left = el("div", null);
          left.appendChild(el("div", { fontSize: "13px", fontWeight: "500" }, it.title || ""));
          if (it.subtitle) left.appendChild(el("div", { fontSize: "12px", color: PALETTE.dim }, it.subtitle));
          li.appendChild(left);
          if (it.meta) li.appendChild(el("span", { fontFamily: MONO_STACK, fontSize: "11px", color: PALETTE.dim }, it.meta));
          ul.appendChild(li);
        });
      }
      return ul;
    }
    case "Tabs": {
      const wrap = el("div", { display: "flex", flexDirection: "column", gap: "12px" });
      const tabbar = el("div", { display: "flex", gap: "4px", borderBottom: "1px solid " + PALETTE.border });
      const content = el("div", null);
      const tabs = node.tabs || [];
      tabs.forEach((t, i) => {
        const btn = el("button", {
          padding: "8px 14px", fontSize: "13px", background: "transparent", border: "none",
          color: i === 0 ? PALETTE.primary : PALETTE.muted, cursor: "pointer",
          borderBottom: "2px solid " + (i === 0 ? PALETTE.primary : "transparent"),
          fontFamily: FONT_STACK,
        }, t.label || ("Tab " + (i + 1)));
        btn.addEventListener("click", () => {
          for (const b of tabbar.children) {
            b.style.color = PALETTE.muted;
            b.style.borderBottom = "2px solid transparent";
          }
          btn.style.color = PALETTE.primary;
          btn.style.borderBottom = "2px solid " + PALETTE.primary;
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
      const fill = el("div", { height: "100%", background: "linear-gradient(90deg, " + PALETTE.primary + ", " + PALETTE.accent + ", " + PALETTE.secondary + ")", width: pct + "%", boxShadow: "0 0 8px " + PALETTE.primaryGlow });
      track.appendChild(fill);
      wrap.appendChild(track);
      return wrap;
    }
    case "Counter": {
      // New interactive primitive. Reads from /api/counters/:name on mount.
      const name = node.name || "default";
      const wrap = el("div", { display: "flex", alignItems: "center", gap: "8px" });
      if (node.label) wrap.appendChild(el("span", { fontSize: "12px", color: PALETTE.muted }, node.label));
      const value = el("span", {
        fontFamily: MONO_STACK, fontSize: "20px", color: PALETTE.primary, fontWeight: "600",
      }, "—");
      value.setAttribute("data-rr-counter", name);
      wrap.appendChild(value);
      const inc = el("button", {
        background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.fg,
        borderRadius: "4px", padding: "2px 10px", fontSize: "14px", cursor: "pointer", fontFamily: FONT_STACK,
      }, "+1");
      inc.addEventListener("click", () => incrementCounter(name, value));
      wrap.appendChild(inc);
      loadCounter(name, value);
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
        background: "rgba(0,0,0,0.50)", border: "1px solid " + PALETTE.border, borderRadius: "6px",
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
  State.rootEl = root;
  State.surface = surface;
  State.listNodes.clear();
  root.innerHTML = "";
  const wrap = el("div", { display: "flex", flexDirection: "column", gap: "20px", fontFamily: FONT_STACK, color: PALETTE.fg });
  const meta = el("div", {
    fontFamily: MONO_STACK, fontSize: "11px", color: PALETTE.dim,
    display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
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
    headers: { "content-type": "application/json", ...cors },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
