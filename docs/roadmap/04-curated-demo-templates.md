# 04 — Manually-curated 50-repo demo templates

**Status:** Roadmap · **Effort:** 1–2 weeks (mostly content work) · **Depends on:** [01 — Cloudflare Containers](./01-cloudflare-containers.md) for the hardest cases

## What

Hand-author bespoke deploy surfaces for the 50 most-demoed repos — the ones a typical RepoRadar user is most likely to click Deploy on. Override the Gemini-generated surface with a known-good template that's been reviewed by a human and tuned for that specific repo.

Generic Gemini-emitted A2UI is a good baseline. A hand-tuned template is a *demo*.

## Why

Three reasons:

1. **Demo confidence.** For the top 50 repos, we know exactly what surface a judge will see. No surprises mid-presentation, no weak Reader fallbacks.
2. **Quality ceiling.** Gemini gets ~B+ surfaces for most repos. Humans get A+ for the ones they care about. The top 50 covers 90% of traffic — worth the lift.
3. **Educational.** Each template is a worked example of "what good A2UI looks like for this kind of repo". Doubles as documentation for contributors who want to add their own.

## How (sketch)

### Template store

```
templates/
  README.md                                # how to author a template
  by-fullname/
    NousResearch_hermes-agent.json         # exact-match override
    anthropics_claude-cookbooks.json
    ...
  by-pattern/
    openclaw-skill.json                    # matches any repo tagged 'openclaw' + 'skill'
    mcp-server.json                        # matches `mcp-server` in name
    ...
  index.json                               # mapping: repo glob → template path
```

Each `.json` is a valid A2UI surface — same schema Gemini emits. Stored in R2 alongside generated surfaces. The deploy worker checks the template store BEFORE calling Gemini; if there's a match it uses that and skips the LLM call.

### Authoring workflow

1. Pick a repo from the trending list.
2. Read its README, examples, exports.
3. Sketch a surface: what's the *one interaction* that makes this repo click for a new user?
4. Author the A2UI JSON by hand, mirroring the structure Gemini emits.
5. PR into `templates/by-fullname/`. CI validates the JSON against the A2UI schema.
6. Optional: smoke-test the deploy locally before merging.

### Match precedence

1. Exact `by-fullname/` match — wins.
2. First matching `by-pattern/` rule — wins.
3. Fall through to Gemini.

### Variable substitution

Templates support `{{repo.name}}`, `{{repo.description}}`, `{{repo.topics[0]}}` placeholders so a single pattern template (e.g. `openclaw-skill.json`) can serve dozens of repos.

## Initial 50 candidates

To be confirmed, but rough cuts:

- **Top hackathon-stack repos** (10): hermes-agent, claude-mem, ag-ui, A2UI, OpenClaw, mcp-use, LangChain, CopilotKit, awesome-mcp-servers, claude-code.
- **Buzz-of-the-week repos** (15): whatever's trending in the past 7 days on launch day. Refreshed weekly.
- **Foundational libraries** (15): the repos people most often want to "try first" — Vercel AI SDK, LangChain, vLLM, Pydantic-AI, etc.
- **Showcase deploys** (10): bespoke template demos that look incredible — e.g. an awesome-mcp-servers template that's an interactive directory, or a vercel/ai template that's a streaming playground.

## Effort breakdown

| Step | Time |
|---|---|
| Template store + R2 wiring | 1 day |
| Match precedence in deploy worker | 0.5 day |
| Variable substitution | 0.5 day |
| Schema validation + CI | 0.5 day |
| Authoring 50 templates (avg 30 min each) | 25 hours = ~3 days |
| Review pass + smoke tests | 1 day |
| **Total** | **6–7 days, can parallelize authoring** |

## Open questions

1. **Curation governance.** Who decides what makes the top 50? Internal team only, or community submissions via PR with a maintainer review?
2. **Refresh cadence.** Templates can go stale (a repo's API changes). What's the maintenance budget? Probably a monthly pass + community-flagged issues.
3. **A/B Gemini vs template.** Worth measuring: is a 30-minute human template actually better than Gemini's output for the same repo? If Gemini's getting close, prioritize the cases where it isn't.
