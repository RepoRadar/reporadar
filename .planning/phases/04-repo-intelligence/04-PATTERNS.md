# Phase 4: repo-intelligence - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/repoContext.ts` | service/utility | request-response | `app/lib/github.ts` | exact |
| `app/api/repo-chat/route.ts` | route handler | streaming + tool-loop | `app/api/talk/tts/route.ts` + `app/api/contact/route.ts` | role-match (streaming shape) + role-match (rate limit) |
| `app/chat/[owner]/[repo]/page.tsx` | server component | request-response | `app/d/[slug]/page.tsx` | exact |
| `app/chat/[owner]/[repo]/ChatClient.tsx` | client component | streaming (fetch reader) | `app/(site)/_components/ContactForm.tsx` | role-match |
| `app/components/RepoCard.tsx` | client component | event-driven | self (MODIFY, add action button) | self |
| `app/components/RepoRadarApp.tsx` | client component | event-driven | self (MODIFY, wire new callback) | self |

---

## Pattern Assignments

### `app/lib/repoContext.ts` (service/utility, request-response)

**Analog:** `app/lib/github.ts`

**Imports pattern** (`app/lib/github.ts`, lines 1-3):
```typescript
import { Octokit } from "octokit";
import type { Repo } from "./types";
```

**Octokit singleton pattern** (`app/lib/github.ts`, lines 9-34):
```typescript
let _octokit: Octokit | null = null;
function octokit() {
  if (!_octokit) {
    _octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined,
      userAgent: "reporadar/0.1",
      throttle: {
        onRateLimit: () => false,
        onSecondaryRateLimit: () => false,
      },
      retry: { enabled: false },
    });
  }
  return _octokit;
}
```

**fetchRepo pattern with Promise.all** (`app/lib/github.ts`, lines 149-177):
```typescript
export async function fetchRepo(fullName: string): Promise<Repo> {
  const [owner, repo] = fullName.split("/");
  const [meta, readme, commits] = await Promise.all([
    octokit().rest.repos.get({ owner, repo }),
    octokit()
      .rest.repos.getReadme({ owner, repo, mediaType: { format: "raw" } })
      .catch(() => ({ data: "" }) as unknown as { data: string }),
    octokit()
      .rest.repos.listCommits({ ... })
      .catch(() => ({ data: [] as unknown[] })),
  ]);
  const readmeStr = typeof readme.data === "string" ? readme.data : "";
  // ... map to Repo shape
}
```

**Key convention:** README body (`readmeStr`) is fetched but currently discarded after `readmeLength = readmeStr.length`. `repoContext.ts` must keep the full `readmeStr` and add a `git.getTree` call in the same `Promise.all`. Import `.ts` extensions not used here (bare specifiers are fine in lib files).

**Scoring integration** (`app/lib/scoring.ts`, lines 1-8 and 142):
```typescript
import type { Dimension, DimensionWeights, Dimensions, Repo, ScoredRepo } from "./types";
import { DIMENSION_ORDER } from "./types";
// ...
export function computeDimensions(repo: Repo): Dimensions { ... }
export function scoreRepo(repo: Repo, weights: DimensionWeights): ScoredRepo { ... }
```

**DEFAULT_WEIGHTS import** (`app/lib/scoring.ts`, line 26):
```typescript
export const DEFAULT_WEIGHTS: DimensionWeights = { momentum: 0.7, velocity: 0.7, ... };
```

---

### `app/api/repo-chat/route.ts` (route handler, streaming + tool-loop)

**Primary analog for rate-limit + route shape:** `app/api/contact/route.ts`
**Primary analog for streaming response:** `app/api/talk/tts/route.ts`
**Primary analog for Gemini call:** `app/lib/translate.ts`

**Route-level runtime declaration** (`app/api/contact/route.ts`, line 17; `app/api/talk/tts/route.ts`, line 3):
```typescript
export const runtime = "nodejs";
```

**Rate-limit block, copy verbatim, adjust constants** (`app/api/contact/route.ts`, lines 26-51):
```typescript
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX = 5; // raise to 20 for chat

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}
```

**IP extraction pattern** (`app/api/contact/route.ts`, line 122-128):
```typescript
const ip =
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
if (!checkRateLimit(ip)) {
  return NextResponse.json(
    { ok: false, error: "Too many messages, give it a few seconds." },
    { status: 429 },
  );
}
```

**Key-absent graceful degrade** (`app/lib/translate.ts`, lines 38-39):
```typescript
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) return; // no-op without key
```

For the route, the equivalent is returning a `503` response with a user-friendly message rather than throwing.

**Gemini client initialisation** (`app/lib/translate.ts`, lines 56-65):
```typescript
const client = new GoogleGenerativeAI(apiKey);
const model = client.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  systemInstruction: "...",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.2,
  },
});
```

For `repo-chat`, use `generateContentStream` instead of `generateContent`, omit `responseMimeType`, pass `tools`, and pipe to a `ReadableStream`. The streaming + tool-loop uses the `@google/generative-ai` `0.24.1` API shape (confirm in `node_modules/@google/generative-ai`).

**Streaming response shape** (`app/api/talk/tts/route.ts`, lines 73-79):
```typescript
return new Response(upstream.body, {
  status: 200,
  headers: {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store",
  },
});
```

For text streaming the content-type is `text/plain; charset=utf-8` and a `ReadableStream` is constructed from a `TextEncoder` + the Gemini async iterator.

**Error handling pattern** (`app/lib/translate.ts`, lines 91-93):
```typescript
} catch (err) {
  console.warn("[translateRepoDescriptions] failed:", err instanceof Error ? err.message : err);
}
```

In the route, translate this to a caught exception that returns a `{ ok: false, error: "..." }` JSON response. Never log message bodies.

**Imports block for repo-chat route:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchTrending } from "@/app/lib/github.ts";
import { computeDimensions, scoreRepo, DEFAULT_WEIGHTS } from "@/app/lib/scoring.ts";
import { fetchRepoContext } from "@/app/lib/repoContext.ts";
```

Note: CONTEXT.md instructs to use `.ts` extensions on local imports (mirrored from existing routes that use `@/app/lib/...` without extension, check existing routes for actual convention; `contact/route.ts` uses `@/app/lib/email` without extension, so follow that convention: **no `.ts` extension** on `@/app/...` imports).

---

### `app/chat/[owner]/[repo]/page.tsx` (server component, request-response)

**Analog:** `app/d/[slug]/page.tsx`

**Server component shape with dynamic params** (`app/d/[slug]/page.tsx`, lines 1-31):
```typescript
import { notFound } from "next/navigation";
// ...

export const runtime = "nodejs";

export default async function DeployedSurface({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // ... fetch data, call notFound() if not found
  return (
    <div ...>
      ...
    </div>
  );
}
```

For the chat page, params are `{ owner: string; repo: string }` (both destructured from `await params`). The page calls `fetchRepoContext(owner + "/" + repo)`, handles not-found with `notFound()`, renders the two-pane layout as server HTML (right pane fully rendered, left pane shells `<ChatClient>`).

**No `"use client"` directive**, this is a server component. Client interactivity is isolated in `ChatClient.tsx`, which is imported and rendered with serialisable props only.

**Metadata export pattern** (`app/(site)/contact/page.tsx`, lines 13-16):
```typescript
export const metadata: Metadata = {
  title: "Contact | RepoRadar",
  description: "...",
};
```

Apply same pattern: `title: "${repoName} | RepoRadar chat"`.

---

### `app/chat/[owner]/[repo]/ChatClient.tsx` (client component, streaming)

**Directive and state machine analog:** `app/(site)/_components/ContactForm.tsx`

**"use client" + useState state machine** (`ContactForm.tsx`, lines 1-21):
```typescript
"use client";

import { type FormEvent, useState } from "react";

type ContactStatus = "idle" | "sending" | "sent" | "queued" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  // ...
}
```

ChatClient extends this pattern with a messages array and streaming state:
```typescript
"use client";

import { useRef, useState } from "react";
// react-markdown import for rendering assistant messages

type ChatStatus = "idle" | "streaming" | "error" | "rate-limited" | "unavailable";
```

**fetch call pattern** (`ContactForm.tsx`, lines 54-63):
```typescript
const res = await fetch("/api/contact", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ... }),
});
```

For streaming, replace `res.json()` with a `ReadableStreamDefaultReader` loop:
```typescript
const reader = res.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  // append chunk to the last assistant message
}
```

**Rate-limit handling** (`ContactForm.tsx`, lines 72-75):
```typescript
if (res.status === 429) {
  setStatus("error");
  setStatusMessage(body.error ?? "Too many messages, try again shortly.");
  return;
}
```

Mirror this for `ChatClient` streaming errors.

**Disabled state while busy** (`ContactForm.tsx`, line 200):
```typescript
disabled={isBusy || isSuccess}
```

In `ChatClient`: `disabled={status === "streaming"}` on the send button; show a stop button alongside.

**Inline status display** (`ContactForm.tsx`, lines 219-245): use the same `role="status" aria-live="polite"` pattern for rate-limited and error states.

---

### `app/components/RepoCard.tsx` (MODIFY, add "Ask this repo" action)

**Analog:** self. The "Deploy" button is the direct pattern to copy for the new "Ask this repo" action.

**Existing Deploy button** (`RepoCard.tsx`, lines 237-259):
```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    onDeploy(repo);
  }}
  disabled={isDeploying}
  className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium tracking-wide transition disabled:opacity-50"
  style={{
    borderColor: "var(--primary)",
    background: "rgba(34,197,94,0.08)",
    color: "var(--primary)",
  }}
  onMouseEnter={(e) => {
    (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.20)";
    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px var(--primary-glow)";
  }}
  onMouseLeave={(e) => {
    (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
  }}
>
  {isDeploying ? "deploying…" : "Deploy →"}
</button>
```

The new "Ask this repo" action is an `<a>` tag (not a `<button>`) since it opens a new tab, placed beside the Deploy button in the same footer row (lines 211-261). It mirrors the GitHub link pattern (lines 214-236) for accessibility but uses the secondary-button style from Deploy:

```typescript
<a
  href={`/chat/${repo.fullName}`}
  target="_blank"
  rel="noopener noreferrer"
  onClick={(e) => e.stopPropagation()}
  aria-label={`Ask questions about ${repo.fullName}`}
  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] transition"
  style={{
    borderColor: "var(--secondary)",
    background: "var(--surface-3)",
    color: "var(--secondary)",
  }}
  onMouseEnter={(e) => { ... }} // same hover pattern
  onMouseLeave={(e) => { ... }}
>
  <ChatIcon size={13} />
  Ask this repo
</a>
```

**Footer row** (`RepoCard.tsx`, lines 211-261): the existing `<div className="mt-auto flex items-end justify-between gap-3 pt-1">` holds the GitHub link on the left and Deploy on the right. Inserting the new action between them (or as a third item) requires changing `justify-between` to a three-item flex row. Keep `e.stopPropagation()` on click to prevent the card's `onSelect` from firing.

**Component signature change:** add optional `onAsk?: (repo: ScoredRepo) => void` or simply use the `href` directly (no callback needed since it opens a new tab via `<a>`). The `href`-only approach is simpler and avoids an extra prop-drill through `RepoRadarApp`.

---

### `app/components/RepoRadarApp.tsx` (MODIFY, wire onAsk if callback-style chosen)

**Analog:** self. The `openDeploy` wiring is the exact pattern.

**openDeploy definition** (`RepoRadarApp.tsx`, lines 229-237):
```typescript
const openDeploy = (repo: ScoredRepo) => {
  if (activeDeploy && deployStatus === "running") {
    minimizeDeploy();
    return;
  }
  setActiveDeploy({ repo });
  setDeployMode("modal");
  setDeployStatus("form");
};
```

**RepoCard usage at render time** (`RepoRadarApp.tsx`, lines 998-1005):
```typescript
<RepoCard
  repo={r}
  onDeploy={openDeploy}
  onSelect={selectRepoProfile}
  onTagClick={(topic) => runQuery({ topic, label: `tag: ${topic}` })}
  selected={selectedRepo === r.fullName}
  rank={i + 1}
/>
```

If the "Ask this repo" action is implemented as a plain `<a href>` inside `RepoCard` (recommended), no changes to `RepoRadarApp` are needed. If a callback is preferred, add `onAsk={(repo) => window.open(\`/chat/${repo.fullName}\`, "_blank", "noopener")}` at the call site, same inline pattern as `onTagClick`.

---

## Shared Patterns

### Gradient bar (RADAR_GRADIENT)
**Source:** `app/components/RepoCard.tsx`, lines 6-7
**Apply to:** dimension score bars in the chat page right pane
```typescript
const RADAR_GRADIENT =
  "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent), var(--danger))";
// Usage on the filled bar:
style={{
  width: `${score}%`,       // score is 0..100
  background: RADAR_GRADIENT,
  boxShadow: "0 0 8px var(--primary-glow)",
}}
// Rail (background track):
style={{ background: "var(--surface-3)" }}
```

### Error handling in route handlers
**Source:** `app/api/contact/route.ts`, lines 182-201
**Apply to:** `app/api/repo-chat/route.ts`
```typescript
try {
  // ... main logic
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn("[repo-chat] exception:", msg);
  return NextResponse.json({ ok: true, queued: true }); // degrade, never 500
}
```

For the streaming route, catch before the stream starts and return a JSON error response. Errors mid-stream should close the stream with an error sentinel string the client recognises.

### Key-absent degrade
**Source:** `app/lib/translate.ts`, lines 38-39; `app/api/talk/tts/route.ts`, lines 25-28
**Apply to:** `app/api/repo-chat/route.ts`
```typescript
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  return NextResponse.json(
    { ok: false, error: "Chat is not available right now." },
    { status: 503 },
  );
}
```

### CSS variable colour tokens
**Source:** throughout `app/components/RepoCard.tsx`
**Apply to:** all new TSX files

| Token | Use |
|---|---|
| `var(--primary)` | green, main accent, active borders |
| `var(--secondary)` | blue, secondary info |
| `var(--accent)` | yellow, star counts, warnings |
| `var(--danger)` | red, errors |
| `var(--fg)` | main text |
| `var(--fg-muted)` | secondary text |
| `var(--fg-dim)` | tertiary / disabled text |
| `var(--surface)` | card backgrounds |
| `var(--surface-2)` | input backgrounds |
| `var(--surface-3)` | tag/button backgrounds |
| `var(--border)` | default border |
| `var(--border-strong)` | hover/active border |
| `var(--primary-glow)` | green glow for box-shadow |

### Writing-style guard (em-dash backstop)
**Source:** PRD §9
**Apply to:** `app/api/repo-chat/route.ts` post-process step before flushing tokens to client
```typescript
function stripEmDashes(text: string): string {
  // Replace em dash (U+2014) and double-hyphen with comma or period
  return text.replace(/,/g, ",").replace(/--/g, ",");
}
```
Run on each assembled chunk or on the full response before streaming, as described in PRD §9.

### Import convention
**Source:** `app/api/contact/route.ts`, line 14-15; `app/lib/github.ts`, line 1-2
- Use `@/app/...` alias for cross-directory imports, no `.ts` extension
- Use relative `./types` style within `app/lib/`
- `"use client"` directive is the first line of any client component, before any imports

---

## No Analog Found

All six files have close analogs in the codebase. No items in this table.

---

## Metadata

**Analog search scope:** `app/lib/`, `app/api/`, `app/components/`, `app/(site)/`, `app/d/`
**Files scanned:** 10 analog files read in full
**Pattern extraction date:** 2026-05-28
