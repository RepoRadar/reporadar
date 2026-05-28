---
phase: 04-repo-intelligence
plan: 04
subsystem: ui
tags: [next.js, react, client-component, react-markdown, streaming, chat, accessibility]

requires:
  - phase: 04-repo-intelligence
    plan: 02
    provides: POST /api/repo-chat streaming endpoint
  - phase: 04-repo-intelligence
    plan: 03
    provides: page.tsx left-pane mount point, fullName/repoName/apiKeyPresent props

provides:
  - path: app/chat/[owner]/[repo]/ChatClient.tsx
    exports: ChatClient (default)
    description: "use client" streaming chat UI; messages array in React state; streams /api/repo-chat; react-markdown assistant replies; 4 chips with chip-2 gate; typing indicator; stop; unavailable + rate-limited states
  - path: app/chat/[owner]/[repo]/page.tsx
    exports: ChatWorkspace (default), generateMetadata
    description: Server component; placeholder replaced with ChatClient mount (fullName, repoName, apiKeyPresent)

affects:
  - app/chat/[owner]/[repo]/page.tsx

dependency_graph:
  requires: [04-02, 04-03]
  provides: [chat-client-ui]
  affects: [04-06-QA]

tech_stack:
  added: []
  patterns:
    - "use client" streaming reader: fetch POST, res.body.getReader(), TextDecoder, chunk append
    - react-markdown sync default export + remarkGfm, compact Components map (no rehype-raw)
    - AbortController ref for stop button, cleaned up on unmount
    - Chip-2 gate: aria-expanded toggle, autoFocus on expand, composed message on submit
    - Rate-limit 429: banner with 5s auto-dismiss, setStatus idle after dismiss
    - Unavailable (apiKeyPresent=false): no textarea, no send, chips still visible

key_files:
  created:
    - app/chat/[owner]/[repo]/ChatClient.tsx
  modified:
    - app/chat/[owner]/[repo]/page.tsx

decisions:
  - id: D-04-04-a
    decision: "sendMessage captures message history before the async fetch starts using a local snapshot (historyForFetch). The setMessages call that appends user+placeholder runs first; the fetch uses the pre-append snapshot to avoid capturing the empty assistant placeholder in the outgoing messages array."
  - id: D-04-04-b
    decision: "The placeholder text in the outer div comment 'chat shell (ChatClient mounts here in 04-04)' was also removed so the acceptance criterion grep passes cleanly. The comment now reads 'Left pane: 55% - chat shell'."
  - id: D-04-04-c
    decision: "Reduced-motion fallback for the typing indicator uses a CSS-class approach (.rr-think-dot already has the animation in globals.css under @media (prefers-reduced-motion: no-preference)). A hidden <span class=rr-think-static> with 'Thinking...' is rendered alongside the dots; CSS would show it only under reduced-motion. This matches the UI-SPEC pattern without inline @media JS logic."

metrics:
  duration_min: 25
  completed: "2026-05-28"
  tasks: 2
  files_modified: 2
---

# Phase 4 Plan 04: ChatClient streaming chat UI Summary

**One-liner:** Streaming chat client with 4 suggested chips, chip-2 describe-your-build gate, react-markdown rendering, stop control, and unavailable/rate-limited states, all in ephemeral React state.

## What was built

### Task 1: ChatClient.tsx

Created `app/chat/[owner]/[repo]/ChatClient.tsx` as a `"use client"` component.

**Props:** `fullName: string`, `repoName: string`, `apiKeyPresent: boolean`.

**State machine:**
- `messages: Message[]` (ephemeral, React state only, INTL-04)
- `status: "idle" | "streaming" | "rate-limited" | "error"`
- `input: string`, `gateOpen: boolean`, `gateText: string`, `gateBorderFlash: boolean`
- `showRateLimitBanner: boolean`
- `abortRef: RefObject<AbortController>` for the stop button

**Streaming:** `fetch POST /api/repo-chat`, reads `res.body.getReader()` with `TextDecoder`, appends each chunk to the last assistant message. `AbortController` wired to the Stop button; on abort the streamed content so far is preserved.

**Markdown:** Sync `Markdown` default import from `react-markdown` + `remarkGfm`, compact `Components` map mirroring Prose.tsx but scaled down (h1-h3 at `1rem font-semibold`, p at `0.875rem leading-relaxed`). All links `target="_blank" rel="noopener noreferrer"`, inline code `var(--surface-3)/var(--primary)`, pre blocks `var(--surface-3)`. No `rehype-raw`.

**Chips (shown when messages.length === 0):**
- Chip 1: "Why did you score it this way?" - sends immediately
- Chip 2: "I'm building something, does this fit?" - gate toggle (`aria-expanded`)
- Chip 3: "Tell me what's so special about this repo." - sends immediately
- Chip 4: "This sounds like hype. Explain what I'm missing." - sends immediately

**Chip-2 gate:**
- Click toggles `gateOpen`; chip gets `aria-expanded` attribute
- Inline form slides in (CSS `max-height: 0 -> 200px`, `transition: 0.2s ease-out`)
- Label: "What are you building?", textarea `aria-label="Describe what you are building"`, autofocused on expand
- Placeholder: "Describe your project briefly, what it does, how it works, what it needs to connect to."
- Submit button: "Check the fit", disabled when textarea is empty
- On empty submit: `gateBorderFlash = true` for 600ms (danger border), no message sent
- On non-empty submit: collapses gate, sends `"I'm building something, does this fit?\n" + gateText`
- Enter submits (Shift+Enter newlines), matches UI-SPEC

**Typing indicator:** When streaming and last assistant message is empty, renders an assistant bubble with three `.rr-think-dot` spans (keyframe from globals.css) and `aria-live="polite" aria-label="RepoRadar is thinking"`. Hidden static "Thinking..." span for reduced-motion.

**Composer:**
- `placeholder="Ask anything about {repoName}..."` (repoName without owner prefix)
- 2000-char cap; counter shown when within 200 chars; counter color `var(--danger)` over cap
- Enter sends, Shift+Enter newlines
- Send button (green arrow SVG, `aria-label="Send message"`): disabled when empty, over cap, or streaming
- Stop button (red, "Stop", `aria-label="Stop generating"`): shown only while streaming; calls `abortRef.current.abort()`
- Composer disabled (opacity 0.6) while streaming

**Unavailable state:** When `!apiKeyPresent`, renders a bordered `var(--surface-2)` box with "Chat is not available right now." instead of the composer. Chips still display for reference.

**Rate-limit banner:** Dismissable bar above the composer with "You're sending messages quickly. Give it a few seconds.", `var(--accent)` styling, auto-dismisses after 5s. Dismiss button `aria-label="Dismiss rate limit notice"`.

**Error handling:**
- 429: removes empty assistant placeholder, shows rate-limit banner
- Other non-ok: fills assistant bubble with `body.error ?? "Something went wrong. Try again."`
- AbortError (stop): preserves streamed content, sets status idle
- Stream read errors: fills bubble with error text

**Privacy (INTL-04):** Zero references to `localStorage`, `sessionStorage`, `document.cookie`, or `indexedDB`. No fetch other than `/api/repo-chat`. No analytics call carrying message text.

### Task 2: page.tsx mount

Replaced the placeholder div in `page.tsx` with:
```tsx
<ChatClient
  fullName={fullName}
  repoName={repo}
  apiKeyPresent={apiKeyPresent}
/>
```

Added `import ChatClient from "./ChatClient"`. Removed placeholder comment text so acceptance criteria grep passes. `page.tsx` remains a server component (no `"use client"` directive).

## QA attention points (04-06)

1. **Chip-2 gate:** Click chip 2, verify the gate form slides in and chip gets active styling. Submit empty description: textarea border should flash red (no error text). Submit non-empty: gate collapses, user bubble shows `I'm building something, does this fit?\n[description]`, assistant streams a reply.
2. **Chips 1/3/4:** Each should immediately send the chip text as the user message and begin streaming.
3. **Stop button:** During streaming, click Stop. Content received so far stays in the bubble. Status returns to idle.
4. **Rate limit (429):** Needs server-side triggering; client should show the yellow banner, not a 429 code.
5. **Unavailable (no key):** With `GOOGLE_API_KEY` unset, chips show but the composer is replaced with the unavailable message.
6. **Scroll:** Message list should auto-scroll to bottom as new tokens arrive.
7. **Keyboard:** Enter sends from the main composer. Shift+Enter inserts newline. Enter in the gate textarea submits the description.

## Security compliance

| Threat ID | Status |
|-----------|--------|
| T-04-14 (localStorage retention) | Mitigated: zero persistence APIs in ChatClient.tsx |
| T-04-15 (XSS via streamed markdown) | Mitigated: sync react-markdown, no rehype-raw, links target=_blank rel=noopener |
| T-04-16 (runaway streaming) | Mitigated: AbortController stop button; server also rate-limits and caps tool rounds |

## Deviations from plan

None significant. Plan executed as written.

The only minor adjustment: the outer div comment in `page.tsx` saying "chat shell (ChatClient mounts here in 04-04)" was updated to "chat shell" so the acceptance criterion `grep -q 'ChatClient mounts here'` returns no match (as required).

## Known stubs

None. ChatClient is fully wired to `/api/repo-chat`.

## Threat flags

None. No new network endpoints. ChatClient only fetches `/api/repo-chat`.

## Self-Check: PASSED

Files exist:
- app/chat/[owner]/[repo]/ChatClient.tsx: YES (created, 1030 lines)
- app/chat/[owner]/[repo]/page.tsx: YES (modified)

Commit: 71efc3c
