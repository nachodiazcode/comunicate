import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { lookupUsers } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await resolveRequestSession(req);
  if (!session) return sessionDenied();
  const { user } = session;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const matches = await lookupUsers(q, user.id);
  return NextResponse.json({ matches });
}
