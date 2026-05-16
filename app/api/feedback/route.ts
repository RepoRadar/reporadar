import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type FeedbackBody = {
  feedback?: unknown;
  contact?: unknown;
  pageUrl?: unknown;
  context?: unknown;
};

type VerifiedIssue = {
  title: string;
  body: string;
  labels: string[];
  confidence: "low" | "medium" | "high";
};

const MAX_FEEDBACK_CHARS = 4000;
const MAX_CONTACT_CHARS = 120;
const MAX_CONTEXT_CHARS = 1200;

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body with feedback." },
      { status: 400 },
    );
  }

  const feedback = normalizeText(body.feedback, MAX_FEEDBACK_CHARS);
  if (!feedback) {
    return NextResponse.json(
      { ok: false, error: "Enter review or feedback before sending." },
      { status: 400 },
    );
  }

  const contact = normalizeText(body.contact, MAX_CONTACT_CHARS);
  const pageUrl = normalizeText(body.pageUrl, 500) || req.headers.get("referer") || undefined;
  const context = normalizeText(body.context, MAX_CONTEXT_CHARS);
  const submittedAt = new Date().toISOString();
  const verified = await verifyFeedback({ feedback, contact, pageUrl, context, submittedAt });
  const created = await createGitHubIssue(verified);

  return NextResponse.json({
    ok: true,
    issue: created.ok
      ? {
          status: "created",
          number: created.number,
          url: created.url,
          verified,
        }
      : {
          status: "queued",
          reason: created.reason,
          verified,
        },
  });
}

async function verifyFeedback({
  feedback,
  contact,
  pageUrl,
  context,
  submittedAt,
}: {
  feedback: string;
  contact?: string;
  pageUrl?: string;
  context?: string;
  submittedAt: string;
}): Promise<VerifiedIssue> {
  const fallback = buildFallbackIssue({ feedback, contact, pageUrl, context, submittedAt });
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return fallback;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction:
        "You turn RepoRadar user reviews into verified GitHub issues. Preserve the user's concrete claims, separate facts from assumptions, never invent steps or environment details, and output only JSON.",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    const result = await model.generateContent(`Feedback:
${feedback}

Contact: ${contact || "(not provided)"}
Page URL: ${pageUrl || "(not provided)"}
Client context: ${context || "(not provided)"}
Submitted at: ${submittedAt}

Return JSON:
{
  "title": "Feedback: <concise issue title>",
  "summary": "<one sentence>",
  "verifiedDetails": ["<fact from feedback or context>", "..."],
  "openQuestions": ["<unknown that needs human follow-up>", "..."],
  "impact": "<user impact>",
  "labels": ["user-feedback", "triage", "<one of bug|enhancement|ux>"],
  "confidence": "low|medium|high"
}`);
    const parsed = JSON.parse(extractJson(result.response.text())) as {
      title?: unknown;
      summary?: unknown;
      verifiedDetails?: unknown;
      openQuestions?: unknown;
      impact?: unknown;
      labels?: unknown;
      confidence?: unknown;
    };
    const title = normalizeTitle(parsed.title) || fallback.title;
    const labels = normalizeLabels(parsed.labels);
    const confidence = normalizeConfidence(parsed.confidence);
    return {
      title,
      labels: labels.length > 0 ? labels : fallback.labels,
      confidence,
      body: issueBody({
        summary: normalizeText(parsed.summary, 800) || "User submitted product feedback.",
        verifiedDetails: normalizeStringList(parsed.verifiedDetails),
        openQuestions: normalizeStringList(parsed.openQuestions),
        impact: normalizeText(parsed.impact, 800) || "Needs triage.",
        feedback,
        contact,
        pageUrl,
        context,
        submittedAt,
      }),
    };
  } catch (err) {
    console.warn("[feedback] LLM verification fallback:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

async function createGitHubIssue(
  verified: VerifiedIssue,
): Promise<{ ok: true; number: number; url: string } | { ok: false; reason: string }> {
  const token = process.env.GITHUB_TOKEN;
  const targetRepo = process.env.FEEDBACK_ISSUE_REPO || process.env.GITHUB_REPOSITORY || "RepoRadar/reporadar";
  if (!token) return { ok: false, reason: "GITHUB_TOKEN is not configured." };

  const [owner, repo] = targetRepo.split("/");
  if (!owner || !repo) return { ok: false, reason: "FEEDBACK_ISSUE_REPO must be owner/repo." };

  try {
    const octokit = new Octokit({ auth: token, userAgent: "reporadar-feedback/0.1" });
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title: verified.title,
      body: verified.body,
      labels: verified.labels,
    });
    return { ok: true, number: data.number, url: data.html_url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[feedback] GitHub issue create failed:", message);
    return { ok: false, reason: message };
  }
}

function buildFallbackIssue({
  feedback,
  contact,
  pageUrl,
  context,
  submittedAt,
}: {
  feedback: string;
  contact?: string;
  pageUrl?: string;
  context?: string;
  submittedAt: string;
}): VerifiedIssue {
  return {
    title: `Feedback: ${makeTitle(feedback)}`,
    labels: ["user-feedback", "triage"],
    confidence: "medium",
    body: issueBody({
      summary: makeTitle(feedback),
      verifiedDetails: [
        "A user submitted this through the RepoRadar feedback control.",
        pageUrl ? `Submitted from ${pageUrl}.` : "No page URL was provided.",
      ],
      openQuestions: ["Human triage should confirm severity, reproduction steps, and ownership."],
      impact: "User feedback needs product/engineering triage.",
      feedback,
      contact,
      pageUrl,
      context,
      submittedAt,
    }),
  };
}

function issueBody({
  summary,
  verifiedDetails,
  openQuestions,
  impact,
  feedback,
  contact,
  pageUrl,
  context,
  submittedAt,
}: {
  summary: string;
  verifiedDetails: string[];
  openQuestions: string[];
  impact: string;
  feedback: string;
  contact?: string;
  pageUrl?: string;
  context?: string;
  submittedAt: string;
}) {
  const bullets = (items: string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None captured.";

  return `## Summary
${summary}

## Verified details
${bullets(verifiedDetails)}

## Impact
${impact}

## Open questions
${bullets(openQuestions)}

## Original feedback
${feedback}

## Submission metadata
- Submitted at: ${submittedAt}
- Page: ${pageUrl || "not provided"}
- Contact: ${contact || "not provided"}
- Client context: ${context || "not provided"}

_Generated by RepoRadar feedback verification._`;
}

function normalizeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function normalizeTitle(value: unknown): string | undefined {
  const title = normalizeText(value, 120);
  if (!title) return undefined;
  return title.startsWith("Feedback:") ? title : `Feedback: ${title}`;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item, 300))
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);
}

function normalizeLabels(value: unknown): string[] {
  const labels = normalizeStringList(value)
    .map((label) => label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .slice(0, 5);
  return Array.from(new Set(["user-feedback", "triage", ...labels]));
}

function normalizeConfidence(value: unknown): VerifiedIssue["confidence"] {
  return value === "low" || value === "high" ? value : "medium";
}

function makeTitle(feedback: string): string {
  const sentence = feedback.split(/[.!?]\s/)[0]?.trim() || feedback;
  const title = sentence.replace(/^the\s+/i, "").slice(0, 80).trim();
  return title || "user feedback";
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}
