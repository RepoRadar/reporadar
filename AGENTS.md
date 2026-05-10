<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RepoRadar Agent Rules

## Tooling and Workflow

- Use GetShitDone / GSD skills for project planning, execution, review, and verification work. If an instruction says "GASD memory", treat that as the repo's GSD/gstack memory workflow unless a more specific memory tool is configured.
- Use gstack skills for coding workflows when the user names them or the task matches them. In particular: `/qa` for browser QA, `/qa-only` for report-only QA, `/design-shotgun` or `/design-review` for visual work, `/review` for diff review, `/context-save` and `/context-restore` for handoff memory.
- Use Superpowers skills when they apply. For bugs or visual regressions, start with systematic debugging; before claiming completion, run verification and report the exact commands.
- Prefer persistent repo instructions in this file over one-off assumptions. If you learn a durable rule, add it here.
- Before editing any Next.js code, read the relevant local doc under `node_modules/next/dist/docs/`. This repo uses Next.js 16 and assumptions from older versions can be wrong.

## Hackathon Goal

- Until the AI Tinkerers Generative UI Hackathon results are declared, make no changes that could reduce demo quality, user clarity, reliability, or the project's chance of winning.
- During this window, only ship changes that make RepoRadar better for real users or materially improve the hackathon presentation.
- Track hackathon context in durable memory when it affects decisions: the project was built for the AI Tinkerers Generative UI Hackathon, the header text should stay, and the near-term goal is improving the product for users and judges.
- Prefer small, verifiable improvements over broad refactors. If a change is not clearly helpful, do not make it.

## Current UI Contracts

- Repo cards must show rank first, then repository name, then a compact star count in one readable line. Only the repo name may truncate.
- Star count display should sit at the top-right of the card as icon then value, e.g. `★ 141.7k`, with star and number at the same visual size.
- Do not let stars, rank badges, tooltips, or metadata squeeze the repo name into one or two characters.
- Repo cards should have exactly one GitHub link: the lower-left "GitHub repo" action with a GitHub icon. The repo title is display text, not a link.
- The metadata block under the repo title should prioritize `owner/repo · language`; put timeline beneath it if needed so the repo identity does not get squeezed.
- Slider rails and card match-score bars should use the same green, blue, yellow, red gradient language so tuning controls visually match the scoring output.
- Tags, descriptions, and match-score bars should occupy consistent vertical positions across cards in the same row.
- Infinite scroll should show a visible loading state with spinner and explanatory slide text, plus a retry affordance if loading fails.
- Do not use fake/decorative icons for tag chips. Only use a tag icon when it is the real, recognizable icon for that exact technology or brand; otherwise show plain text.
- The GitHub action should show the GitHub mark plus "GitHub repo", with an accessible label for screen readers.
- Long descriptions should stay clamped in the card, then reveal the full description on hover after a short delay.
- Do not put a native `title` tooltip on the entire repo card. It creates a large browser tooltip over the grid and makes the dashboard harder to read. Use `aria-label` for card-level affordance and keep tooltips scoped to specific controls.
- Slider rails in "Slide to tune" must be visible as filled bars, and slider thumbs must be vertically centered on the rail in Chromium and Firefox.
- Avoid overlapping text in the repo grid. Long repo names, long descriptions, translated labels, and large star counts should truncate or wrap cleanly inside their own regions.
- Keep the "AI Tinkerers Generative UI Hackathon" header text and May 10, 2026 context unless the user explicitly asks to change it.
- Brand mark must stay faithful to the provided RepoRadar icon: circular green radar, four ticks, sweep beam, curved arrow, white nodes, and green hex node. Improve sharpness/quality only; do not invent a different icon.
- The dashboard wordmark should render as text, not a wordmark image: white `Repo` plus green `Radar`, paired with the radar mark.

## Recent Visual Regression Notes

- May 10, 2026 screenshot regression: first cards showed repo names as tiny fragments like `h.`, `o.`, and `A.` because the title shared a row with large star counts.
- Same screenshot showed the card-level hover tooltip covering the middle of the grid.
- Same screenshot showed slider thumbs sitting low relative to the visible bar. The WebKit thumb needs a negative top margin that matches the custom track height.

## Verification Expectations

- For UI changes, run `npm run lint` and `npm run build`.
- For visual/card/slider changes, also run a browser check against the local dev server and inspect rendered dimensions or screenshots.
- If `/qa` is requested, use browser-based QA. Do not substitute lint/build for QA.
