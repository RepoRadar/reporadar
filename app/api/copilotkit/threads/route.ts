import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId") ?? "default";

  return Response.json({
    threads: [],
    joinCode: agentId,
    nextCursor: null,
  });
}
