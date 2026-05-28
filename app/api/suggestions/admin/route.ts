/**
 * PATCH /api/suggestions/admin — admin-only operations on suggestions
 *
 * Token gate: x-admin-token header must equal process.env.ADMIN_TOKEN.
 * If ADMIN_TOKEN is unset → 503 (admin not configured; never allow access).
 *
 * Body:
 *   { id: string, status?: "awaiting"|"accepted"|"declined", eta?: string, hidden?: 0|1 }
 *
 * Operations:
 *   - Set status + ETA (mark accepted with ETA, or decline)
 *   - Hide/unhide suggestion (spam moderation)
 *   - Both can be applied together in one PATCH
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { setSuggestionStatus, hideSuggestion, getSuggestion } from "@/app/lib/suggestions";

export const runtime = "nodejs";

type AdminBody = {
  id?: unknown;
  status?: unknown;
  eta?: unknown;
  hidden?: unknown;
};

export async function PATCH(req: NextRequest) {
  // 1. Token gate — ADMIN_TOKEN must be set, never allow if missing
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { ok: false, error: "Admin not configured." },
      { status: 503 }
    );
  }

  const providedToken = req.headers.get("x-admin-token");
  if (providedToken !== adminToken) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  // 2. Parse body
  let body: AdminBody;
  try {
    body = (await req.json()) as AdminBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body." },
      { status: 400 }
    );
  }

  // 3. Validate id
  const id = typeof body.id === "string" ? body.id.trim() : null;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "id is required." },
      { status: 400 }
    );
  }

  const db = getCloudflareContext().env.DB;

  // 4. Apply status + ETA if provided
  const statusValues = ["awaiting", "accepted", "declined", "delivered"] as const;
  type StatusVal = (typeof statusValues)[number];
  const status =
    typeof body.status === "string" &&
    (statusValues as readonly string[]).includes(body.status)
      ? (body.status as StatusVal)
      : null;

  const eta =
    typeof body.eta === "string" ? body.eta.slice(0, 120) : null;

  if (status !== null) {
    await setSuggestionStatus(db, {
      id,
      status,
      eta,
    });
  }

  // 5. Apply hidden if provided
  if (body.hidden === 0 || body.hidden === 1) {
    await hideSuggestion(db, id, body.hidden);
  }

  // 6. Return updated suggestion
  const updated = await getSuggestion(db, id);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Suggestion not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, suggestion: updated });
}
