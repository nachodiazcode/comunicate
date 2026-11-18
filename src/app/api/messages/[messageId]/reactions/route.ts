import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { toggleMessageReaction } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const { messageId } = await context.params;
    const body = (await req.json()) as { emoji?: string };

    if (!body.emoji?.trim()) {
      return NextResponse.json(
        { error: "Emoji requerido." },
        { status: 400 }
      );
    }

    const result = await toggleMessageReaction({
      messageId,
      userId: user.id,
      emoji: body.emoji.trim(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en reacción" },
      { status: 400 }
    );
  }
}
