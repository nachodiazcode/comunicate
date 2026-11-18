import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { emitRealtimeEvent } from "@/lib/server/events";
import type { TargetType } from "@/types/chat";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const body = (await req.json()) as {
      targetType?: TargetType;
      targetId?: string;
      isTyping?: boolean;
    };

    if (!body.targetType || !body.targetId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    emitRealtimeEvent({
      type: "typing:update",
      targetType: body.targetType,
      targetId: body.targetId,
      user: {
        id: user.id,
        name: user.name,
        avatarColor: user.avatarColor,
      },
      isTyping: Boolean(body.isTyping),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
