import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { fetchRepo } from "@/app/lib/github";
import type { A2UISurface } from "@/app/lib/a2ui-types";
import { A2UI_FORM_FACTORS } from "@/app/lib/a2ui-types";
import { sendEmail, escapeHtml } from "@/app/lib/email";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are RepoRadar's deploy agent. Your job is to look at a GitHub repo and decide what kind of interactive surface would best demonstrate or let a user play with it. Then emit an A2UI JSON surface description.

Form factors you can choose from: ${A2UI_FORM_FACTORS.join(", ")}.
- "dashboard" — for data/analytics/monitoring repos
- "playground" — for libraries / SDKs / parsers / algorithms
- "control-panel" — for IoT / hardware / devices / system controls
- "wizard" — for workflow / onboarding / setup repos
- "widget-grid" — for UI component libraries
- "reader" — for content / docs / educational repos
- "needs-runtime" — pick this ONLY when a repo genuinely cannot be demonstrated as a Cloudflare Worker static surface, e.g.:
    * skill packs / plugins that need a host runtime (OpenClaw / Hermes / Claude Code / a specific CLI to load them)
    * desktop apps / native binaries / native UI shells
    * kernel modules, ML training scripts that need GPUs, embedded firmware
    * libraries whose only meaningful interface is "import it into your code"
    * creative pieces (poems, essays, art) that don't have user-facing interaction
  When you pick this, the SURFACE STRUCTURE IS DIFFERENT (see "NEEDS-RUNTIME SHAPE" below). Don't fake interactivity — be honest that this one needs more than we can ship in a Worker, and explain what it would take.

Available components (each node has a "type" string, listed):
- Layout { direction: "row"|"column", gap?: number, children: A2UINode[] }
- Container { padding?: number, tone?: "default"|"subtle"|"highlight", recordType?: string, children: A2UINode[] }
    Set "recordType" on the Container that wraps a form (e.g. "task", "note", "feedback") so submitted records are typed.
- Heading { level: 1|2|3, text: string }
- Text { text: string, tone?: "default"|"muted"|"danger"|"success" }
- Button { label: string, action: string, variant?: "primary"|"secondary"|"ghost" }
    The "action" field drives real behavior. Use one of:
      "submit"        — collects every TextField/CheckBox/Slider in the same Container and POSTs them as a record to a per-deploy D1 database. Confirms with a toast and refreshes any sibling List(source="records").
      "refresh"       — re-fetches every List(source="records") in the surface
      "delete:<id>"   — deletes a record by id
      "increment:<n>" — bumps a named counter by 1 (use when you have a Counter in the layout)
      "link:<url>"    — opens an external URL in a new tab (use this for GitHub/Discord/issue-tracker CTAs)
      Anything else is treated as a passive action.
- TextField { id: string, label: string, placeholder?: string, defaultValue?: string }
    The "id" is the key inside the saved record's JSON, so pick semantic ids ("title", "notes", "url").
- CheckBox { id: string, label: string, defaultChecked?: boolean }
- Slider { id: string, label: string, min: number, max: number, step?: number, defaultValue: number }
- List { items?: [...], source?: "records", recordType?: string }
    If "source" is "records", the list AUTO-LOADS from the per-deploy D1 — no items needed. Filter by recordType if you set one on the form Container above.
    Each rendered row shows a title, optional subtitle, and a delete button. Title/subtitle pulls from data.title|name|subject and data.subtitle|description|body|note.
- Tabs { tabs: { label: string, content: A2UINode }[] }
- ProgressBar { label?: string, value: number, max: number }
- Counter { name: string, label?: string }
    Auto-loads from /api/counters/:name with a +1 button. Backed by the same per-deploy D1.
- Image { src: string, alt: string, width?: number, height?: number }
- Code { language?: string, code: string }

INTERACTIVITY GUIDANCE (CRITICAL):
- Every surface MUST be interactive. Pure read-only surfaces are not allowed (the one exception is the needs-runtime form factor below, which has its own honest-explainer shape).
- Wrap related TextField/CheckBox/Slider in a Container with a recordType ("task", "feedback", "lead", etc.).
- Add a primary Button with action="submit" so users can save data.
- Pair the form with a List(source="records", recordType=<same>) so users see what they've saved and can delete entries.
- For repos that suggest a counter use case (votes, claps, plays), add a Counter and a Button with action="increment:<name>".
- Don't apologize for the demo nature — make the interaction feel like a real micro-app for THAT specific repo.

NEEDS-RUNTIME SHAPE (only used when formFactor === "needs-runtime"):
  Layout(direction: "column", gap: 18, children: [
    Heading(level: 1, text: "<repo name>: needs a runtime to demo live"),
    Text(text: "<1-2 sentences in plain English: what this repo actually is>"),
    Heading(level: 2, text: "What it would take to run live"),
    Text(text: "<2-3 sentences explaining the missing piece, e.g.: 'This is an OpenClaw skill pack. To see it run, we'd need to spin up an OpenClaw instance in a Cloudflare Container, load the skill, and tunnel the UI through. We're scoping that for a future RepoRadar release.'"),
    Heading(level: 2, text: "Want this live sooner?"),
    Text(text: "Ping the RepoRadar team. We can prioritize repos people actually want."),
    Layout(direction: "row", gap: 12, children: [
      Button(label: "Ping Christo on GitHub", action: "link:https://github.com/letsgochristo", variant: "primary"),
      Button(label: "Ping Priyanshu on GitHub", action: "link:https://github.com/priyanshuharshbodhi1", variant: "secondary"),
      Button(label: "Open an issue", action: "link:https://github.com/RepoRadar/reporadar/issues/new?title=Make+<repo>+deployable", variant: "ghost"),
    ]),
    Container(recordType: "runtime-request", padding: 16, tone: "subtle", children: [
      Heading(level: 3, text: "Leave us a note (we'll follow up)"),
      TextField(id: "name", label: "Your name or GitHub handle"),
      TextField(id: "interest", label: "Why you want this live", placeholder: "I want to demo this at..."),
      Button(label: "Send", action: "submit", variant: "primary"),
    ]),
    List(source: "records", recordType: "runtime-request"),
  ])

  Replace <repo> in the "Open an issue" URL with the actual full name (e.g. "RepoRadar/reporadar"), URL-encoded.

Output a single JSON object with this shape:
{
  "title": string,
  "formFactor": one of: ${A2UI_FORM_FACTORS.map((f) => `"${f}"`).join(", ")},
  "root": A2UINode (a Layout or Container with children),
  "meta": { "repo": string, "hint": string|null }
}

Make the surface USEFUL and INTERESTING for that specific repo. Populate sample data, examples, and inputs that demonstrate what the repo does. Avoid lorem ipsum. Take the user's hint seriously if provided.`;

type DeployBody = { repo: string; hint?: string; contact?: string };

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

    let notified: "sent" | "queued" | undefined;
    if (body.contact) {
      notified = await notifyContact({
        contact: body.contact,
        repo: body.repo,
        url: url.startsWith("/") ? `${req.nextUrl.origin}${url}` : url,
        formFactor: surface.formFactor,
        log,
      });
    }

    return NextResponse.json({ ok: true, slug, url, surface, buildLog, notified });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`error: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, buildLog }, { status: 500 });
  }
}

async function notifyContact({
  contact,
  repo,
  url,
  formFactor,
  log,
}: {
  contact: string;
  repo: string;
  url: string;
  formFactor: string;
  log: (m: string) => void;
}): Promise<"sent" | "queued"> {
  const isEmail = /@/.test(contact);
  const apiKey = process.env.RESEND_API_KEY;
  if (!isEmail) {
    log(`SMS notify queued for ${contact} (Twilio not wired)`);
    return "queued";
  }
  if (!apiKey) {
    log(`email notify queued for ${contact} (RESEND_API_KEY not set)`);
    return "queued";
  }
  const from = process.env.RESEND_FROM || "RepoRadar <onboarding@resend.dev>";
  const html = `<!doctype html><html><body style="margin:0;background:#08070d;color:#fafafa;font-family:ui-sans-serif,system-ui">
  <div style="max-width:520px;margin:32px auto;padding:24px;background:#14121e;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
    <h2 style="margin:0 0 12px 0;font-size:18px">Your RepoRadar surface is live</h2>
    <p style="color:#b3b1c0;line-height:1.6;font-size:14px;margin:0 0 16px 0">
      A generative-UI surface for <code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">${escapeHtml(repo)}</code> is now live as a <strong style="color:#22d3ee">${escapeHtml(formFactor)}</strong>.
    </p>
    <p style="margin:0 0 8px 0">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#f43f8a;color:#08070d;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
        Open ${escapeHtml(url.replace(/^https?:\/\//, ""))} →
      </a>
    </p>
    <p style="color:#6b6878;font-size:11px;margin:24px 0 0 0">
      Sent by RepoRadar · <a href="https://reporadar.io" style="color:#22d3ee;text-decoration:none">reporadar.io</a>
    </p>
  </div></body></html>`;
  const subject = `${repo} → ${formFactor} live at ${url.replace(/^https?:\/\//, "")}`;
  const result = await sendEmail({ to: contact, subject, html, from });
  if (result.ok) {
    log(`email sent via Resend to ${contact}`);
    return "sent";
  }
  log(`Resend send failed${result.status ? ` (${result.status})` : ""}: ${(result.error ?? "").slice(0, 120)}`);
  return "queued";
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
