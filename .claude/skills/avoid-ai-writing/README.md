<div align="center">

# avoid-ai-writing

Audit & rewrite content to remove AI writing patterns. A practical skill for any AI agent. Supports detection-only mode.

[![GitHub stars](https://img.shields.io/github/stars/conorbronsdon/avoid-ai-writing?style=social)](https://github.com/conorbronsdon/avoid-ai-writing/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![X](https://img.shields.io/badge/X-@ConorBronsdon-black?style=flat-square&logo=x)](https://x.com/ConorBronsdon)
[![Web App](https://img.shields.io/badge/Try_the_web_app-ff6b35?style=flat-square&logo=vercel&logoColor=white)](https://avoid-ai-writing-app.vercel.app)
</div>

---

> Vendored into RepoRadar from https://github.com/conorbronsdon/avoid-ai-writing (MIT, by Conor Bronsdon).
> See `SKILL.md` for the canonical ruleset. AGENTS.md makes this an always-on rule for all RepoRadar outbound text (UI copy, emails, blog, changelog, comms) for both Claude and Hermes.

A portable writing skill for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenClaw](https://github.com/openclaw/openclaw), [Hermes](https://github.com/NousResearch/hermes-agent), and any other [agentskills.io](https://agentskills.io)-compatible agent. Audits and rewrites content to remove AI writing patterns ("AI-isms").

**Two modes:**
- **Rewrite** (default): flags AI patterns and rewrites the text to fix them. A built-in second pass catches patterns that survived the first edit.
- **Detect**: flags AI patterns without rewriting. Shows which flags are real problems vs. judgment calls. Useful when patterns might be intentional, when auditing content you don't want altered, or when you just want a quick scan.

## Quick demo

**Input:**
> Certainly! Acme Analytics, a vibrant startup nestled in the heart of Boulder's thriving tech ecosystem, has secured $40M in Series B funding — marking a watershed moment for the observability landscape. The platform serves as a unified hub, featuring real-time dashboards, boasting sub-second queries, and presenting a seamless integration layer. Moreover, experts believe Acme is poised to disrupt the market. In conclusion, the future looks bright!

**Output:**
> Acme Analytics raised a $40M Series B led by Sequoia. The Boulder-based startup makes an observability platform that runs queries in under a second and plugs into existing monitoring stacks without custom integration work.

**What it caught:** chatbot opener ("Certainly!"), promotional language ("vibrant," "nestled," "thriving"), significance inflation ("watershed moment"), copula avoidance ("serves as," "featuring," "boasting"), 4 word replacements, vague attribution ("experts believe"), filler ("Moreover"), generic conclusion ("the future looks bright"), over-polished uniformity. 15+ AI tells in one paragraph.

## Why a skill, not just a prompt

A one-shot "make this sound human" prompt catches the obvious stuff. This skill is different:

- **Structured audit**: returns identified issues with quoted text, the rewrite, a change summary, and a second-pass audit in four discrete sections.
- **Two-pass detection**: the second pass re-reads the rewrite and catches patterns that survive the first edit.
- **109-entry word replacement table across 3 tiers + 10 Tier 3 phrases.** Every flagged word has a specific, plainer alternative. "Leverage" becomes "use." "Commence" becomes "start." Tier 1 words always flag, Tier 2 flag when they cluster, Tier 3 flag only at high density.
- **42 pattern categories**, each with before/after examples. Includes structural detection (hashtag stuffing, bare-NP bullet lists, hedge-stacked predictions), rhythm/uniformity checks, and a rewrite-vs-patch threshold.
- **Detect mode**: flag patterns without rewriting.
- **Works across Claude Code, OpenClaw, Hermes, Cursor**: single `SKILL.md` with compatible frontmatter.

## Installation & Usage

### Claude Code
```bash
git clone https://github.com/conorbronsdon/avoid-ai-writing ~/.claude/skills/avoid-ai-writing
```
Or copy `SKILL.md` into any directory Claude Code can read and reference it from `CLAUDE.md`.

### OpenClaw
```bash
clawhub install avoid-ai-writing
# or
git clone https://github.com/conorbronsdon/avoid-ai-writing ~/.openclaw/skills/avoid-ai-writing
```

### Cursor
Drop the ported rule into `.cursor/rules/avoid-ai-writing.mdc`. Functionally identical to the Claude Code skill.

### Triggering the skill
- "Remove AI-isms from this post"
- "Audit this draft for AI tells"
- "Make this sound less like AI"
- "Clean up AI writing in this paragraph"

Trigger detect mode with: "detect," "flag only," "audit only," "just flag," "scan," or similar.

## 42 patterns detected

Content: significance inflation, notability name-dropping, superficial -ing analyses, promotional language, vague attributions, formulaic challenges, novelty inflation.

Language: word/phrase replacements (3 tiers), copula avoidance, synonym cycling, template phrases, filler phrases, false ranges, parenthetical hedging.

Structure: formatting (em dashes, bold overuse, emoji headers, bullet-heavy), sentence structure, structural issues, transition phrases, inline-header lists, title case headings, numbered list inflation, false concession, rhetorical question openers.

Communication: chatbot artifacts, "let's" constructions, cutoff disclaimers, generic conclusions, emotional flatline, reasoning chain artifacts, sycophantic tone, acknowledgment loops, confidence calibration.

Meta: excessive structure, rhythm and uniformity, over-polishing, rewrite-vs-patch threshold.

Structural detection (v3.4): Tier 3 multi-word boilerplate, future-narrative closers, hedge-stacked predictions, real/actual adjective inflation, hashtag stuffing, bullet lists of bare noun phrases.

## Credits

Pattern research informed by:
- [Pangram Labs](https://www.pangram.com/) AI detection research
- Wikipedia's [Signs of AI-generated text](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- [blader/humanizer](https://github.com/blader/humanizer) Claude Code skill
- [brandonwise/humanizer](https://github.com/brandonwise/humanizer) tiered vocabulary system
- [OpenClaw](https://github.com/openclaw/openclaw) humanizer skill ecosystem

Authored by [Conor Bronsdon](https://github.com/conorbronsdon) · [LinkedIn](https://www.linkedin.com/in/conorbronsdon/) · [Chain of Thought podcast](https://chainofthought.show)

## License

MIT
