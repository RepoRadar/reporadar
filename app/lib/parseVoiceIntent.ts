// Parse a natural-language voice transcript into a {topic, query} that the
// GitHub fetch can actually use.
//
// The user says something like "Hey, tell me some Cloudflare repos with
// writing OpenClaw". Passing that whole sentence to the GitHub search API
// returns nothing — GitHub search is keyword-driven, not NL-driven. So we:
//   1. Look for known trending-tag slugs (the same 16 in TagsPanel) and
//      extract the first match as `topic` so we hit the topic search path.
//   2. Strip filler words + the matched topic from the rest, leaving any
//      remaining keywords as `query` for the secondary GitHub keyword fallback.
//
// This lives client-side on purpose: zero round trips, deterministic, easy
// to debug when the demo doesn't behave. A Gemini-backed intent classifier
// is the v1.0 path (see PRD §11).

type Intent = { topic?: string; query?: string };

// Order matters: longer / more specific patterns first, so "claude code"
// wins before "claude" (currently not in our topic set, but defensive).
// Patterns include the obvious spellings PLUS the common voice-transcription
// variants. Web Speech API often returns things like "n eight n" for "n8n",
// "a two u i" for "a2ui", and "cloud code" (homophone) for "claude code".
// More specific patterns come first so partial matches don't win.
const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  // claude-code + "cloud code" homophone the Web Speech API loves to produce.
  [/\b(?:claude|cloud)[\s-]?code\b/, "claude-code"],
  // ag-ui — "ag ui", "a g u i", "agee yoo eye"
  [/\b(?:a[\s-]?g|agee|ag)[\s-]?(?:u[\s-]?i|you[\s-]?eye|yoo[\s-]?eye)\b/, "ag-ui"],
  [/\bag[\s-]?ui\b/, "ag-ui"],
  // a2ui — "a 2 u i", "a two ui", "a two you eye"
  [/\ba\s*(?:2|two)\s*(?:u[\s-]?i|you[\s-]?eye|ui)\b/, "a2ui"],
  [/\ba2[\s-]?ui\b/, "a2ui"],
  [/\bgenerative[\s-]?ui\b/, "generative-ui"],
  [/\bgenerative\s+you[\s-]?eye\b/, "generative-ui"],
  [/\bmodel\s+context\s+protocol\b/, "mcp"],
  [/\bvoice[\s-]?ai\b/, "voice-ai"],
  [/\bopen[\s-]?claw\b/, "openclaw"],
  [/\bhermes\b/, "hermes"],
  [/\bcloudflare\b/, "cloudflare"],
  [/\blang[\s-]?chain\b/, "langchain"],
  [/\bgemini\b/, "gemini"],
  [/\banthropic\b/, "anthropic"],
  [/\bopen[\s-]?ai\b/, "openai"],
  // n8n — the trickiest. STT renders it as "n8n", "n 8 n", "n eight n",
  // "n-8-n", or even "and 8 and"/"and eight and".
  [/\b(?:n|and)\s*(?:8|eight)\s*(?:n|and)\b/, "n8n"],
  [/\bn8n\b/, "n8n"],
  [/\bmcp\b/, "mcp"],
  [/\bagent(?:s)?\b/, "agents"],
  [/\brag\b/, "rag"],
];

// Words that carry no search signal and would dilute a GitHub keyword query.
// Kept conservative — when in doubt, leave a word in.
const FILLER_PATTERNS: RegExp[] = [
  /\b(hey|hello|hi|yo|ok|okay)\b/g,
  /\b(please|just|right|now|here|then|also|too|very|really)\b/g,
  /\b(tell|show|give|find|search|look)\s+(?:me|us)?\b/g,
  /\b(can|could|would|will|should)\s+you\b/g,
  /\b(i(?:'m| am)?|i(?:'d| would)?|we(?:'re| are)?|us|my|our)\b/g,
  /\b(want|wanted|looking|looking\s+for|need|trying\s+to)\b/g,
  /\b(do|does|did)\s+you\s+(?:know|have)\b/g,
  /\b(are|is|was|were|be|been|being|am)\b/g,
  /\b(about|with|for|of|that|this|those|these|than|then)\b/g,
  /\b(on|in|at|to|from|into|onto|off|out|up|down|over|under|via|against)\b/g,
  /\b(by|using|like|similar\s+to|written\s+in|written|writing)\b/g,
  /\b(repo|repos|repository|repositories|project|projects)\b/g,
  /\b(some|the|a|an|any|all|every|each|many|much|few|several)\b/g,
  /\b(stuff|thing|things|something|anything|everything)\b/g,
  /\b(what(?:'s|s|\s+is)?|where|when|why|how|which|who)\b/g,
  /\b(best|good|great|cool|nice|popular|trending|top|new)\b/g,
];

// Find the first topic the user mentions IN THE TEXT (not the first in our
// pattern list). For "Cloudflare repos with OpenClaw", the user led with
// Cloudflare so that's the topic; OpenClaw is a refinement and becomes
// part of the keyword query.
function firstTopicInOrder(text: string): { topic?: string; hit?: RegExp } {
  let earliest: { topic: string; hit: RegExp; idx: number } | undefined;
  for (const [pat, slug] of TOPIC_PATTERNS) {
    const m = text.match(pat);
    if (!m || m.index === undefined) continue;
    if (!earliest || m.index < earliest.idx) {
      earliest = { topic: slug, hit: pat, idx: m.index };
    }
  }
  return earliest ? { topic: earliest.topic, hit: earliest.hit } : {};
}

export function parseVoiceIntent(transcript: string): Intent {
  const raw = (transcript || "").toLowerCase().trim();
  if (!raw) return {};

  const { topic, hit: topicHit } = firstTopicInOrder(raw);

  // Strip the matched topic + filler. Whatever remains is the keyword query.
  let rest = raw.replace(/[.,!?;:"']/g, " ");
  if (topicHit) rest = rest.replace(topicHit, " ");
  for (const f of FILLER_PATTERNS) rest = rest.replace(f, " ");
  rest = rest.replace(/\s+/g, " ").trim();

  // Drop any leftover stop-words shorter than 2 chars.
  const cleaned = rest
    .split(" ")
    .filter((w) => w.length >= 2)
    .join(" ")
    .trim();

  return {
    topic,
    query: cleaned || undefined,
  };
}
