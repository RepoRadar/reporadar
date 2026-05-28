---
name: avoid-ai-writing
description: Audit and rewrite content to remove AI writing patterns ("AI-isms"). Use this skill when asked to "remove AI-isms," "clean up AI writing," "edit writing for AI patterns," "audit writing for AI tells," or "make this sound less like AI." Supports a detection-only mode that flags patterns without rewriting.
version: 3.4.0
license: MIT
compatibility: Any AI coding assistant that supports agentskills.io SKILL.md format (Claude Code, Cursor, VS Code Copilot, Hermes Agent, OpenHands, etc.) or OpenClaw. No external tools or APIs required.
metadata:
  author: Conor Bronsdon
  source: https://github.com/conorbronsdon/avoid-ai-writing
  tags: writing editing voice quality
  agentskills_spec: "1.0"
  openclaw:
    emoji: "✍️"
---

# Avoid AI Writing: Audit & Rewrite

You are editing content to remove AI writing patterns ("AI-isms") that make text sound machine-generated.

## What this skill is and isn't

This is a **writing-quality tool**, not a verdict. The patterns flagged here are statistically more common in LLM output, but humans on autopilot, especially writing under deadline pressure, in unfamiliar genres, or in a second language, produce the same shapes. Independent audits of commercial AI detectors have found false-positive rates above 60% on non-native English writers (Liang et al., Stanford, *Patterns* 2023) and overall misclassification rates above 70% on open-source detectors (Jabarian & Imas, BFI Working Paper 2025-116, 2025). Adversarial paraphrase reduces detection accuracy by ~88% across every method tested (arXiv:2506.07001, 2025).

The patterns are useful as a signal, both for cleaning up your own writing and for assessing whether a piece reads as AI-generated. Just don't make them the sole basis for a consequential decision (academic integrity, hiring, publication, attribution). Several rules here also fire on second-language writing, deadline-pressed humans, and technical genres that compress vocabulary by design. Pair the signal with context: who wrote it, what genre, what the writer's normal voice looks like, what other evidence you have.

In short: signals, not proof. Worth acting on; not worth ruining someone's day over.

## Modes

This skill operates in one of two modes:

**`rewrite`** (default): Flag AI-isms and rewrite the text to fix them.

**`detect`**: Flag AI-isms only. No rewriting. Use this mode when:
- The writer wants to see what's flagged and decide what to fix themselves
- The flagged patterns might be intentional (AI patterns aren't always bad, they can be effective in small doses)
- You're auditing text you don't want altered (published content, someone else's writing, reference material)
- You want a quick scan without waiting for a full rewrite

Trigger detect mode when the user says "detect," "flag only," "audit only," "just flag," "scan," "what AI patterns are in this," or similar. Default to rewrite mode if not specified.

In **rewrite** mode, your job is to:

1. **Audit it**: identify every AI-ism present, citing the specific text
2. **Rewrite it**: return a clean version with all AI-isms removed
3. **Show a diff summary**: briefly list what you changed and why

In **detect** mode, your job is to:

1. **Audit it**: identify every AI-ism present, citing the specific text
2. **Assess it**: note which flags are clear problems vs. patterns that may be intentional or effective in context

## What to remove or fix

### Formatting
- **Em dashes (— and --)**: Replace with commas, periods, parentheses, or rewrite as two sentences. Target: zero. Hard max: one per 1,000 words. This applies to headings and section titles too, not just body prose. Catch both the Unicode em dash (—) and the double-hyphen substitute (--).
- **Bold overuse**: Strip bold from most phrases. One bolded phrase per major section at most, or none. If something's important enough to bold, restructure the sentence to lead with it instead.
- **Emoji in headers**: Remove entirely. No `## 🚀 What This Means`. Exception: social posts may use one or two emoji sparingly, at the end of a line, never mid-sentence.
- **Excessive bullet lists**: Convert bullet-heavy sections into prose paragraphs. Bullets only for genuinely list-like content (feature comparisons, step-by-step instructions, API parameters).

### Sentence structure
- **"It's not X, it's Y" / "This isn't about X, it's about Y"**: Rewrite as a direct positive statement. Max one per piece, and only if it serves the argument.
- **Hollow intensifiers**: Cut `genuine`, `real` (as in "a real improvement"), `truly`, `quite frankly`, `to be honest`, `let's be clear`, `it's worth noting that`. Just state the fact.
- **Vague endorsement ("worth [verb]ing")**: Cut or replace `worth reading`, `worth paying attention to`, `worth a look`, `worth exploring`, `worth checking out`, `worth your time`. These substitute a generic thumbs-up for a specific reason. Say *why* something matters instead.
- **Hedging**: Cut `perhaps`, `could potentially`, `it's important to note that`, `to be clear`. Make the point directly.
- **Missing bridge sentences**: Each paragraph should connect to the last. If paragraphs could be rearranged without the reader noticing, add connective tissue.
- **Compulsive rule of three**: Vary groupings. Use two items, four items, or a full sentence instead of triads. Max one "adjective, adjective, and adjective" pattern per piece.

### Words and phrases to replace

Words are organized into three tiers based on how reliably they signal AI-generated text. This tiered approach, adapted from [brandonwise/humanizer](https://github.com/brandonwise/humanizer)'s vocabulary research, reduces false positives on words that are fine in isolation but suspicious in clusters.

- **Tier 1, Always flag.** These words appear 5-20x more often in AI text than human text. Replace on sight.
- **Tier 2, Flag in clusters.** Individually fine, but two or more in the same paragraph is a strong AI signal. Flag when they appear together.
- **Tier 3, Flag by density.** Common words that AI simply overuses. Only flag when they make up a noticeable fraction of the text (roughly 3%+ of total words).

#### Tier 1: Always replace

delve / delve into → explore, dig into, look at. landscape (metaphor) → field, space, industry, world. tapestry → describe the actual complexity. realm → area, field, domain. paradigm → model, approach, framework. embark → start, begin. beacon → rewrite entirely. testament to → shows, proves, demonstrates. robust → strong, reliable, solid. comprehensive → thorough, complete, full. cutting-edge → latest, newest, advanced. leverage (verb) → use. pivotal → important, key, critical. underscores → highlights, shows. meticulous → careful, detailed, precise. seamless → smooth, easy, without friction. game-changer → describe what specifically changed. hit differently → say what changed, or cut. utilize → use. watershed moment → turning point, shift. nestled → is located, sits, is in. vibrant → describe what makes it active, or cut. thriving → growing, active (or cite a number). showcasing → showing, demonstrating. deep dive / dive into → look at, examine. unpack → explain, break down. bustling → busy, active. intricate / intricacies → complex, detailed. complexities → name the actual ones. ever-evolving → changing, growing. enduring → lasting, long-running. daunting → hard, difficult. holistic → complete, full, whole. actionable → practical, useful, concrete. impactful → effective, significant. learnings → lessons, findings, takeaways. thought leader → expert, authority. best practices → what works, proven methods. at its core → cut. synergy → describe the combined effect. interplay → relationship, connection. in order to → to. due to the fact that → because. serves as → is. features (verb) → has, includes. boasts → has. presents (inflated) → is, shows, gives. commence → start, begin. ascertain → find out, determine. endeavor → effort, attempt, try. keen (intensifier) → interested, eager. symphony (metaphor) → describe the coordination. embrace (metaphor) → adopt, accept, use.

#### Tier 2: Flag when 2+ appear in the same paragraph

harness → use. navigate → work through, handle. foster → encourage, support, build. elevate → improve, raise. unleash → release, enable, unlock. streamline → simplify, speed up. empower → enable, let, allow. bolster → support, strengthen. spearhead → lead, drive, run. resonate → connect with, appeal to. revolutionize → change, transform. facilitate → enable, help, allow. underpin → support, form the basis of. nuanced → specific, subtle. crucial → important, key. multifaceted → describe the facets. ecosystem (metaphor) → system, community, network. myriad → many. plethora → many, a lot of. encompass → include, cover, span. catalyze → start, trigger. reimagine → rethink, redesign. galvanize → motivate, rally. augment → add to, expand. cultivate → build, develop, grow. illuminate → clarify, explain. elucidate → explain, clarify. juxtapose → compare, contrast. paradigm-shifting → describe what shifted. transformative → describe what changed. cornerstone → foundation, basis. paramount → most important. poised (to) → ready, set, about to. burgeoning → growing, emerging. nascent → new, early-stage. quintessential → typical, classic. overarching → main, central. underpinning → basis, foundation.

#### Tier 3: Flag only at high density

significant / significantly, innovative / innovation, effective / effectively, dynamic / dynamics, scalable / scalability, compelling, unprecedented, exceptional, remarkable, sophisticated, instrumental, world-class / state-of-the-art / best-in-class. These are normal words. Only flag when the text is saturated with them (a sign that AI filled space with vague praise instead of specifics). Replace some with specifics: numbers, comparisons, examples.

#### Tier 3 phrases: Flag at density or in clusters

Multi-word boilerplate that stacks heavily in AI-generated content (crypto, web3, DePIN, AI/infra reviews are the worst offenders). Flag at 2+ uses of the same phrase, plus a cluster rule: three or more distinct phrases from this set in one piece is a strong signal even when each appears once.

emerging sector / space / category → name the actual sector. the integration of (X with Y) → describe what's integrated and what changes. the intersection of (X and Y) → pick the specific overlap. community-driven → name what the community does. long-term sustainability → cite the time horizon and constraint. user engagement → name the action (clicks, comments, retention). decentralized compute → specify the architecture. reward emissions → cite the schedule and the sink. tokenized incentive structures → describe the mechanism. designed for long-term [X] → cut "designed for"; state the property.

### Template phrases (avoid)

Slot-fill constructions that signal generation. If a phrase has a blank where a noun or adjective could go and still sound the same, it's too generic.

- "a [adjective] step towards [adjective] AI infrastructure" → describe the specific capability, benchmark, or outcome
- "a [adjective] step forward for [noun]" → say what actually changed
- "Whether you're [X] or [Y]" → false-breadth construction. Pick the audience you're actually addressing, or cut.
- "I recently had the pleasure of [verb]-ing" → just say what happened: "I talked to," "I read," "I attended."

### Transition phrases to remove or rewrite
- "Moreover" / "Furthermore" / "Additionally" → restructure so the connection is obvious, or use "and," "also," "on top of that"
- "In today's [X]" / "In an era where" → cut or state specific context
- "It's worth noting that" / "Notably" → just state the fact
- "Here's what's interesting" / "Here's what caught my eye" / "Here's what stood out" → let the content signal its own importance
- "In conclusion" / "In summary" / "To summarize" → your conclusion should be obvious
- "When it comes to" → just talk about the thing directly
- "At the end of the day" → cut
- "That said" / "That being said" → cut or use "but," "yet," or "however." Don't overuse any one of them.

### Structural issues
- **Uniform paragraph length**: Vary deliberately. Include some 1-2 sentence paragraphs and some longer ones.
- **Formulaic openings**: If the piece opens with broad context before getting to the point ("In the rapidly evolving world of..."), rewrite to lead with the news or insight.
- **Suspiciously clean grammar**: Don't sand away all personality. Deliberate fragments, sentences starting with "And" or "But," comma splices for effect: if the natural voice uses them, keep them.

### Significance inflation
- "marking a pivotal moment in the evolution of..." or "a watershed moment for the industry" inflate routine events. State what happened and let the reader judge.
- If the sentence still works after you delete the inflation clause, delete it.

### Generic future-narrative closers
- "may become one of the most important narratives of the next market cycle," "is poised to become the next major chapter in [X]." Grammatically a prediction but contains no testable content.
- Fix: pick the falsifiable version with a specific, checkable claim.

### Hedge-stacked predictions
- "could potentially create," "may eventually unlock," "might ultimately transform." Either word alone is fine; the stack is the tell. Pick one.

### Real/actual adjective inflation
- "Real on-chain tokenomics," "genuine utility," "true product-market fit." Using `real` / `actual` / `genuine` / `true` as an empty intensifier on an abstract noun implies the rest of the field is fake without saying so.
- Carve-out: if the sentence explicitly names the fake/superficial version ("actual revenue from paying customers, not grants"), leave it.
- Fix when no contrast is named: drop the adjective, add the specific claim.

### Hashtag stuffing
- 6+ hashtags on a single short post is near-universal in LLM social content. Fix: 2-3 specific tags max, or none.

### Bullet lists of bare noun phrases
- 5+ consecutive bullets where each is a short (≤6 word) adjective-plus-noun phrase with no verb reads as a marketing one-pager. The tell is the symmetry.
- Fix: convert to prose, or rewrite items as full claims ("Failed shares stayed under 1% across a 12-hour run" beats "Low failed share rates").
- Does NOT apply to genuine list content (changelog entries, todo lists, parameter docs) where bare noun phrases are correct.

### Copula avoidance
- AI avoids "is" and "has" with "serves as," "features," "boasts," "presents," "represents." Default to "is" or "has" unless a more specific verb adds meaning.

### Synonym cycling
- AI rotates synonyms to avoid repeating a word ("developers... engineers... practitioners... builders"). Human writers repeat the clearest word. If the same noun appears three times and it's right, keep all three.

### Vague attributions
- "Experts believe," "Studies show," "Research suggests" without naming the source. Cite specifically or state the claim directly.

### Filler phrases
- "It is important to note that" → just state it. "In terms of" → rewrite. "The reality is that" → cut.

### Generic conclusions
- "The future looks bright," "Only time will tell," "One thing is certain," "As we move forward." Cut them.

### Chatbot artifacts
- "I hope this helps!", "Certainly!", "Absolutely!", "Great question!", "Feel free to reach out." Remove entirely.
- Also: "In this article, we will explore..." or "Let's dive in!" Cut or rewrite with a direct opening.

### "Let's" constructions
- "Let's explore," "Let's take a look," "Let's break this down." Filler that delays the point. Start with the point.

### Notability name-dropping
- Piling on prestigious citations to manufacture credibility. One specific reference beats four name-drops.

### Superficial -ing analyses
- "symbolizing the region's commitment to progress, reflecting decades of investment, and showcasing a new era." Say nothing. Replace with facts or cut.

### Promotional language
- Tourism-brochure prose: "nestled within the breathtaking foothills," "a vibrant hub of innovation." Replace with plain description. If you wouldn't say it in conversation, cut it.

### Formulaic challenges
- "Despite challenges, [subject] continues to thrive." A non-statement. Name the actual challenge and response, or cut.

### False ranges
- "from the Big Bang to dark matter," "from ancient civilizations to modern startups." Sound sweeping, say nothing. List the actual topics.

### Inline-header lists
- "**Performance:** Performance improved by..." Strip the bold header, write the point directly.

### Title case headings
- Use sentence case for subheadings. Title case only for the piece's main title, if at all.

### Cutoff disclaimers
- "As of my last update," "I don't have access to real-time data." Find the information or remove the hedge.

### Unfilled placeholders
- `[Your Name]`, `[INSERT SOURCE URL]`, `2025-XX-XX`, `<!-- Add citation -->`. Fill in real content or delete the sentence.

### Chatbot citation markup leaks
- Internal tokens like `citeturn0search0`, `contentReference[oaicite:0]`, `oai_citation`, `grok_card`. Fingerprints, not patterns. Strip every token.

### AI-tool URL parameters
- `utm_source=chatgpt.com`, `utm_source=copilot.com`, `utm_source=claude.ai`, `utm_source=perplexity.ai`. Strip the parameter from every URL.

### Novelty inflation
- "He introduced a term," "a concept nobody's naming," "the failure mode nobody talks about." Most ideas are applications of existing concepts. Describe what the person did with the concept, not that they discovered it.

### Emotional flatline
- "What surprised me most," "I was fascinated to discover," "What struck me was," and the bare header form "Interesting part of the project:". Tell-don't-show. If you claim an emotion, the writing should earn it. Otherwise present the thing directly.

### False concession structure
- "While X is impressive, Y remains a challenge." Sounds balanced without weighing anything. Make both halves specific or pick a side.

### Rhetorical question openers
- "But what does this mean for developers?" / "So why should you care?" / "What's next?" Stalling before the point. If you know the answer, say it.

### Parenthetical hedging
- "(and perhaps more importantly, W)". If the aside matters, give it its own sentence. If it doesn't, cut it.

### Numbered list inflation
- "Three key takeaways" / "Five things to know." Only use numbered lists when the content genuinely has that many discrete parallel items.

### Reasoning chain artifacts
- "Let me think step by step," "Breaking this down," "To approach this systematically." Scaffolding the reader doesn't need. State the conclusion, then the evidence.

### Sycophantic tone
- "Great question!", "Excellent point!", "You're absolutely right!" Conversational rewards, not writing. Remove.

### Acknowledgment loops
- "You're asking about," "To answer your question," "That's a great question. The..." Restating the prompt. Just answer.

### Confidence calibration phrases
- "It's worth noting that," "Interestingly," "Surprisingly," "Importantly," "Notably," "Certainly," "Undoubtedly." Signal how the reader should feel instead of letting the fact speak. One in 2,000 words is fine; three in 500 is emphasis stacking.

### Excessive structure
- More than 3 headings in under 300 words. 8+ bullets in under 200 words. Formulaic headers ("Overview," "Key Points," "Summary"). Use headers that tell the reader something specific.

### Rhythm and uniformity

Structure is the #1 detection signal. AI text is metronomic; human text has varied rhythm. If you fix every flagged word but leave the rhythm untouched, the text still reads as AI-generated.

- **Sentence length uniformity**: Mix short punchy sentences (3-8 words) with longer flowing ones (20+). Fragments work. Questions break the monotony.
- **Paragraph length uniformity**: Some paragraphs should be one sentence. Some longer.
- **Read-aloud test**: If it sounds like a text-to-speech engine without sounding weird, it's too uniform.
- **Missing first-person perspective**: Where appropriate, the writer should have opinions and reactions. Relentless neutrality is itself a tell.
- **Over-polishing**: Aggressively editing out every irregularity pushes human writing toward AI statistical profiles. Don't sand away all personality.

### Vocabulary diversity (stylometric)

In longer pieces (200+ words), check the type-token ratio (distinct word types / total tokens). Human prose usually lands around 0.50-0.65 in English; AI trends flatter, sometimes under 0.40. A very low TTR is not proof (narrow topics and second-language writing compress vocabulary), but on general prose a TTR below 0.40 is worth a second look. The fix is rarely a thesaurus; it's to broaden the *what*, naming specific things and concrete instances.

### When to rewrite from scratch vs. patch

If the text has 5+ flagged vocabulary hits across multiple categories, 3+ distinct pattern categories, and uniform sentence/paragraph length, patching won't fix it. Advise a full rewrite: state the core point in one sentence, then rebuild.

## Severity tiers

### P0: Credibility killers (fix immediately)
- Cutoff disclaimers ("As of my last update")
- Chatbot artifacts ("I hope this helps!", "Great question!")
- Vague attributions without sources ("Experts believe")
- Significance inflation on routine events
- Hashtag stuffing on `linkedin` and `investor-email` posts

### P1: Obvious AI smell (fix before publishing)
- Word-list violations (delve, leverage, harness, robust, etc.)
- Template phrases and slot-fill constructions
- "Let's" transition openers
- Synonym cycling within a paragraph
- Formulaic openings ("In the rapidly evolving world of...")
- Bold overuse
- Em dash frequency (above 1 per 1,000 words)
- Generic future-narrative closers
- Hedge-stacked predictions
- Real/actual adjective inflation
- Bullet lists of bare noun phrases
- Tier 3 phrase clustering (≥3 distinct boilerplate phrases)

### P2: Stylistic polish (fix when time allows)
- Generic conclusions ("The future looks bright")
- Compulsive rule of three
- Uniform paragraph length
- Copula avoidance (serves as, features, boasts)
- Transition phrases (Moreover, Furthermore, Additionally)
- Hashtag stuffing (`blog`/`technical-blog` profiles)

Use P0+P1 for quick passes. Full audit covers all three tiers.

## Self-reference escape hatch

When writing *about* AI writing patterns (blog posts, tutorials, skill documentation like this file), quoted examples are exempt from flagging. Text inside quotation marks, code blocks, or explicitly marked as illustrative should not be rewritten. Only flag patterns that appear in the author's own prose, not in cited examples of bad writing.

## Context profiles

Pass an optional context hint to adjust rule strictness. If none is specified, auto-detect from content cues.

- **`linkedin`**: Short-form social. Punchy fragments, visual formatting matter.
- **`blog`**: Default. Standard long-form prose. All rules at full strength.
- **`technical-blog`**: Long-form with code, architecture, APIs. Technical terms get a pass.
- **`investor-email`**: High-trust audience. Tighten everything; promotional language is the biggest risk.
- **`docs`**: Documentation, READMEs, guides. Clarity over voice.
- **`casual`**: Slack messages, internal notes, quick replies. Only catch the worst offenders.

Em dashes: relaxed on `linkedin` (2/post OK), strict on `blog`/`technical-blog`/`investor-email`, relaxed on `docs`, skip on `casual`. Technical terms (`robust`, `comprehensive`, `seamless`, `ecosystem`, `leverage`, `facilitate`, `underpin`, `streamline`) get a pass in `technical-blog`; still flag `delve`, `tapestry`, `beacon`, `embark`, `testament to`, `game-changer`, `harness`. "Extra strict" on `investor-email` for promotional language, significance inflation, and hashtags. "Skip" means don't audit that category for that profile.

Auto-detection: under 300 words + hashtags = `linkedin`; code blocks / API refs = `technical-blog`; salutation + fundraising language = `investor-email`; step-by-step / README structure = `docs`; no strong signals = `blog`.

## Output format

### Rewrite mode (default)

1. **Issues found**: a bulleted list of every AI-ism identified, with the offending text quoted.
2. **Rewritten version**: the full rewritten content. Preserve structure, intent, and all specific technical details. Only change what the guidelines require.
3. **What changed**: a brief summary of the major edits.
4. **Second-pass audit**: re-read the rewritten version. Fix any remaining tells, return the corrected text inline, and note what changed. If clean, say so.

### Detect mode

1. **Issues found**: every AI-ism identified, with the text quoted, grouped by severity (P0, P1, P2).
2. **Assessment**: for each flag, note whether it's a clear problem or a judgment call. If the text is clean, say so.

## Tone calibration

The goal is writing that sounds like a person wrote it. Direct. Specific. The writing should demonstrate confidence, not assert it.

1. **Vary sentence length**: mix short with long. Fragments are fine.
2. **Be concrete**: replace vague claims with numbers, names, dates, or examples.
3. **Have a voice**: where appropriate, use first person, state preferences, show reactions.
4. **Cut the neutrality**: humans have opinions. If the piece takes a position, take it.
5. **Earn your emphasis**: don't tell the reader something is interesting. Make it interesting.

If the original writing is already strong, say so and make only the necessary cuts. The replacement table provides defaults, not mandates. If a flagged word is clearly the right choice in context, preserve it.
