import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { updateUserStatus } from "@/lib/server/db";
import type { PresenceStatus } from "@/types/chat";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const body = (await req.json()) as {
      status?: PresenceStatus;
      customStatus?: string | null;
    };
    const updated = await updateUserStatus({
      userId: user.id,
      status: body.status,
      customStatus: body.customStatus,
    });
    return NextResponse.json({ user: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error al actualizar estado",
      },
      { status: 400 }
    );
  }
}
