import { NextRequest, NextResponse } from "next/server";
import {
  buildDummyTrendEmail,
  normalizeDigest,
  normalizeEmail,
  normalizeSources,
  type DummyTrendEmail,
} from "@/app/lib/notifications";

export const runtime = "nodejs";

type QueuedNotification = {
  email: string;
  sources: string[];
  dummyEmail: DummyTrendEmail;
  queuedAt: string;
};

const queuedNotifications: QueuedNotification[] = [];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body with a valid email." },
      { status: 400 },
    );
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = normalizeEmail(record.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const sources = normalizeSources(record.sources);
  const digest = normalizeDigest(record.digest);
  const dummyEmail = buildDummyTrendEmail({ email, sources, digest });
  const queuedAt = new Date().toISOString();

  queuedNotifications.unshift({ email, sources, dummyEmail, queuedAt });
  queuedNotifications.splice(25);

  return NextResponse.json({
    ok: true,
    status: "queued",
    email,
    sources,
    dummyEmail,
    queuedAt,
    stored: "memory",
    queueDepth: queuedNotifications.length,
  });
}
