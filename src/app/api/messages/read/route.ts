import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { markConversationRead } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const body = (await req.json()) as { conversationId?: string };
    if (!body.conversationId) {
      return NextResponse.json({ updatedIds: [] });
    }
    const updatedIds = await markConversationRead(body.conversationId, user.id);
    return NextResponse.json({ updatedIds });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al marcar leído" },
      { status: 400 }
    );
  }
}
