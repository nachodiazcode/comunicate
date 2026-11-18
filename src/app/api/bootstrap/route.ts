import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { getBootstrapPayload } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await resolveRequestSession(req);
  if (!session) return sessionDenied();
  const payload = await getBootstrapPayload(session.user.id);
  return NextResponse.json({ ...payload, token: session.token });
}
