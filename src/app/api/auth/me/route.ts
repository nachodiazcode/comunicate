import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { getAvailableUsers } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await resolveRequestSession(req);
  if (!session) return sessionDenied();
  const { user, token } = session;
  const availableUsers = await getAvailableUsers();
  return NextResponse.json({
    user,
    token,
    availableUsers,
  });
}
