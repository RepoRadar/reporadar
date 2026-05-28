/**
 * POST /api/suggestions — submit a new suggestion (Gemini screen + D1 + GitHub issue)
 * GET  /api/suggestions — public board data (all visible suggestions with vote counts)
 *
 * Design decisions:
 *   - Auto-publish (hidden=0) immediately; admin can hide spam later
 *   - Gemini screen for quality/spam; degrades gracefully when GOOGLE_API_KEY missing
 *   - GitHub issue filed via Octokit (GITHUB_TOKEN + FEEDBACK_ISSUE_REPO); degrades gracefully
 *   - In-memory per-IP submit rate-limit (mirror contact route pattern)
 *   - Cache-Control: no-store on GET (live vote counts must not be cached)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { NextRequest, NextResponse } from "next/server";
import {
  createSuggestion,
  listSuggestions,
  updateGithubIssueUrl,
} from "@/app/lib/suggestions";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Submit rate limiter — in-memory per-IP fixed window (mirror contact route)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const submitRateLimitMap = new Map<string, RateLimitEntry>();
const SUBMIT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SUBMIT_RATE_MAX = 3; // max submissions per window per IP

function checkSubmitRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = submitRateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > SUBMIT_RATE_WINDOW_MS) {
    submitRateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= SUBMIT_RATE_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const MAX_NAME_CHARS = 120;
const MAX_DESCRIPTION_CHARS = 4000;

function normalizeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

// ---------------------------------------------------------------------------
// Gemini screen — checks suggestion for spam/abuse; degrades if no API key
// ---------------------------------------------------------------------------

type ScreenResult = {
  ok: boolean;
  reason?: string;
};

async function screenSuggestion(
  name: string,
  description: string
): Promise<ScreenResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // Graceful degradation — accept when GOOGLE_API_KEY is missing
    return { ok: true };
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction:
        "You are a content moderation assistant for a public product suggestions board. Your job is to detect spam, abuse, gibberish, or off-topic submissions. Output only JSON.",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const result = await model.generateContent(`Evaluate this product suggestion:

Name: ${name}
Description: ${description}

Return JSON:
{
  "ok": true/false,
  "reason": "short reason if not ok"
}

Set ok=true if this is a genuine product suggestion (even if rough or opinionated).
Set ok=false only for clear spam, abuse, gibberish, or completely off-topic content.`);

    const text = result.response.text();
    const parsed = JSON.parse(extractJson(text)) as {
      ok?: unknown;
      reason?: unknown;
    };
    if (parsed.ok === false) {
      const reason =
        typeof parsed.reason === "string" ? parsed.reason : "Content flagged.";
      return { ok: false, reason };
    }
    return { ok: true };
  } catch (err) {
    // Degrade gracefully — never block a submission because Gemini failed
    console.warn(
      "[suggestions] Gemini screen error (degrading to accept):",
      err instanceof Error ? err.message : err
    );
    return { ok: true };
  }
}

// ---------------------------------------------------------------------------
// GitHub issue — mirror feedback route createGitHubIssue pattern
// ---------------------------------------------------------------------------

async function createGitHubIssueSuggestion(
  name: string,
  description: string,
  submittedAt: string
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const token = process.env.GITHUB_TOKEN;
  const targetRepo =
    process.env.FEEDBACK_ISSUE_REPO ||
    process.env.GITHUB_REPOSITORY ||
    "RepoRadar/reporadar";

  if (!token) return { ok: false, reason: "GITHUB_TOKEN is not configured." };

  const [owner, repo] = targetRepo.split("/");
  if (!owner || !repo)
    return { ok: false, reason: "FEEDBACK_ISSUE_REPO must be owner/repo." };

  const title = `Suggestion: ${name.slice(0, 100)}`;
  const body = `## User Suggestion

**Name:** ${name}

**Description:**
${description}

## Submission metadata
- Submitted at: ${submittedAt}

_Submitted via RepoRadar public suggestions board._`;

  try {
    const octokit = new Octokit({
      auth: token,
      userAgent: "reporadar-suggestions/0.1",
    });
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels: ["suggestion", "user-feedback", "triage"],
    });
    return { ok: true, url: data.html_url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[suggestions] GitHub issue create failed:", message);
    return { ok: false, reason: message };
  }
}

// ---------------------------------------------------------------------------
// POST handler — submit a new suggestion
// ---------------------------------------------------------------------------

type SuggestionBody = {
  name?: unknown;
  description?: unknown;
};

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: SuggestionBody;
  try {
    body = (await req.json()) as SuggestionBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body with name and description." },
      { status: 400 }
    );
  }

  // 2. Validate fields
  const name = normalizeText(body.name, MAX_NAME_CHARS);
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Name is required (max 120 characters)." },
      { status: 400 }
    );
  }

  const description = normalizeText(body.description, MAX_DESCRIPTION_CHARS);
  if (!description) {
    return NextResponse.json(
      { ok: false, error: "Description is required (max 4000 characters)." },
      { status: 400 }
    );
  }

  // 3. Rate-limit per IP (submit rate, not vote rate)
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (!checkSubmitRateLimit(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: "You've submitted too many suggestions. Try again in an hour.",
      },
      { status: 429 }
    );
  }

  // 4. Gemini screen (degrade gracefully on failure)
  const screen = await screenSuggestion(name, description);
  if (!screen.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          screen.reason ||
          "This suggestion was flagged as spam or off-topic. Please revise and try again.",
      },
      { status: 422 }
    );
  }

  // 5. Insert to D1
  const db = getCloudflareContext().env.DB;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await createSuggestion(db, { id, name, description, created_at: createdAt });

  // 6. File GitHub issue (best-effort — never fatal)
  const ghResult = await createGitHubIssueSuggestion(name, description, createdAt);
  if (ghResult.ok) {
    try {
      await updateGithubIssueUrl(db, id, ghResult.url);
    } catch (err) {
      console.warn("[suggestions] Failed to store github_issue_url:", err);
    }
  }

  // 7. Return created suggestion
  const suggestion = {
    id,
    name,
    description,
    created_at: createdAt,
    status: "awaiting" as const,
    eta: null,
    github_issue_url: ghResult.ok ? ghResult.url : null,
    votes_up: 0,
    votes_down: 0,
    hidden: 0,
  };

  return NextResponse.json({ ok: true, suggestion }, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET handler — public board data
// ---------------------------------------------------------------------------

export async function GET() {
  const db = getCloudflareContext().env.DB;
  const suggestions = await listSuggestions(db);

  return NextResponse.json(
    { ok: true, suggestions },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}
