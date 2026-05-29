<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RepoRadar Agent Rules

## Writing style (NON-NEGOTIABLE)

All user-facing and outbound text MUST follow the avoid-ai-writing skill at `.claude/skills/avoid-ai-writing/SKILL.md`. This covers everything RepoRadar emits: UI copy, blog and changelog content, email bodies (verify, alert, contact, deploy notifications), the suggestions and feedback flows, and any AI-generated text the app produces for users. It applies equally to Claude and Hermes (and any other agent).

The rules that bite most:
- NO em dashes (the `—` character) or double-hyphens (`--`). Use commas, periods, parentheses, colons, or split into two sentences. Target zero.
- Sentence case for headings, not Title Case.
- No AI-isms: delve, leverage, robust, seamless, comprehensive, utilize, "it's not X, it's Y", "the future looks bright", chatbot openers like "Certainly!", and the rest of the skill's tier tables.
- Be concrete and direct, vary sentence length, cut filler.

Run new or edited copy through the skill before shipping it. When the app generates text with Gemini or another model for users (repo descriptions, summaries, audio scripts, adoption reports), bias those prompts toward these same rules.

## Tooling and Workflow

- Use GetShitDone / GSD skills for project planning, execution, review, and verification work. If an instruction says "GASD memory", treat that as the repo's GSD/gstack memory workflow unless a more specific memory tool is configured.
- **QA gate before every feature push (NON-NEGOTIABLE):** before you push a branch or open a PR for any feature (anything touching UI, a route, or behavior), run gstack `/qa` (open the real app, test the change against its acceptance criteria, fix bugs found) AND `/browse` (dogfood the affected pages in a real headless browser). Do not push the feature until both pass. This is in addition to `npm run lint` / `npm run build` / tests. Pure copy or docs edits may skip it.
- gstack is installed at `~/.claude/skills/gstack` (run `/gstack-upgrade` to update). Use its skills for coding workflows: `/qa` and `/qa-only` (browser QA), `/browse` (headless browser for QA + dogfooding), `/review` (pre-landing diff review), `/ship` (test + review + PR), `/design-review` and `/design-shotgun` (visual work), `/context-save` and `/context-restore` (handoff memory), plus the planning + `/cso` security skills.
- For all web browsing and browser-based QA, prefer the gstack `/browse` and `/qa` skills. Do not use `mcp__claude-in-chrome__*` tools.
- Use Superpowers skills when they apply. For bugs or visual regressions, start with systematic debugging; before claiming completion, run verification and report the exact commands.
- Prefer persistent repo instructions in this file over one-off assumptions. If you learn a durable rule, add it here.
- Before editing any Next.js code, read the relevant local doc under `node_modules/next/dist/docs/`. This repo uses Next.js 16 and assumptions from older versions can be wrong.

## Project Goal (post-hackathon)

- RepoRadar won 2nd place in the AI Tinkerers Generative UI Global Hackathon, finishing second out of 302 teams across all 17 host cities (result declared 2026-05-28). The demo-quality freeze that applied during judging is lifted.
- The winning differentiator was real Generative UI: every repo card and deploy surface is genuinely AI-rendered, backed by four interconnected Cloudflare Workers and the A2UI, AG-UI/CopilotKit, and MCP protocols running in production. Protect that in future changes.
- Keep the "AI Tinkerers Generative UI Hackathon" header text and the May 9, 2026 context (see UI contracts) unless the user explicitly asks to change it.
- Near-term focus is the post-hackathon roadmap: alerts, per-repo audio, premium, and growth. Prefer small, verifiable improvements with browser QA over broad refactors. If a change is not clearly helpful, do not make it.

## Current UI Contracts

- Repo cards must show rank first, then repository name, then a compact star count in one readable line. Only the repo name may truncate.
- Star count display should sit at the top-right of the card as icon then value, e.g. `★ 141.7k`, with star and number at the same visual size.
- Do not let stars, rank badges, tooltips, or metadata squeeze the repo name into one or two characters.
- Repo cards should have exactly one GitHub link: the left-most "Open Repo" action with the GitHub mark. The repo title is display text, not a link.
- The card footer is a single row of three actions, left/center/right aligned (justify-between), all on one line at the same height: "Open Repo" (GitHub link, left), "Chat" (opens the per-repo chat workspace in a new tab, center, accent yellow), and "Deploy" (right).
- The metadata block under the repo title should prioritize `owner/repo · language`; put timeline beneath it if needed so the repo identity does not get squeezed.
- Slider rails and card match-score bars should use the same green, blue, yellow, red gradient language so tuning controls visually match the scoring output.
- Tags, descriptions, and match-score bars should occupy consistent vertical positions across cards in the same row.
- Infinite scroll should show a visible loading state with spinner and explanatory slide text, plus a retry affordance if loading fails.
- Do not use fake/decorative icons for tag chips. Only use a tag icon when it is the real, recognizable icon for that exact technology or brand; otherwise show plain text.
- The GitHub action should show the GitHub mark plus "Open Repo", with an accessible label for screen readers.
- Long descriptions should stay clamped in the card, then reveal the full description on hover after a short delay.
- Do not put a native `title` tooltip on the entire repo card. It creates a large browser tooltip over the grid and makes the dashboard harder to read. Use `aria-label` for card-level affordance and keep tooltips scoped to specific controls.
- Slider rails in "Slide to tune" must be visible as filled bars, and slider thumbs must be vertically centered on the rail in Chromium and Firefox.
- Avoid overlapping text in the repo grid. Long repo names, long descriptions, translated labels, and large star counts should truncate or wrap cleanly inside their own regions.
- Keep the "AI Tinkerers Generative UI Hackathon" header text and May 9, 2026 context unless the user explicitly asks to change it.
- Brand mark must stay faithful to the provided RepoRadar icon: circular green radar, four ticks, sweep beam, curved arrow, white nodes, and green hex node. Improve sharpness/quality only; do not invent a different icon.
- The dashboard wordmark should render as text, not a wordmark image: white `Repo` plus green `Radar`, paired with the radar mark.

## Recent Visual Regression Notes

- May 10, 2026 screenshot regression: first cards showed repo names as tiny fragments like `h.`, `o.`, and `A.` because the title shared a row with large star counts.
- Same screenshot showed the card-level hover tooltip covering the middle of the grid.
- Same screenshot showed slider thumbs sitting low relative to the visible bar. The WebKit thumb needs a negative top margin that matches the custom track height.

## Verification Expectations

- For UI changes, run `npm run lint` and `npm run build`.
- For visual/card/slider changes, also run a browser check against the local dev server and inspect rendered dimensions or screenshots.
- For ANY search/query/tag/filter change, verify the **results, not just the mechanics**: type real queries into the field (TYPE), click tags (TAGS), and confirm the returned cards actually MATCH the input (e.g. type "Cloudflare Workers" → the top cards are Cloudflare/Workers repos). Asserting the URL, chip, or `?q=` updated is NOT enough — a slow/failed fetch can leave stale cards under a new chip. Also confirm a failed/slow query never shows mismatched cards.
- If `/qa` is requested, use browser-based QA. Do not substitute lint/build for QA.
