import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { createMessage, getMessages } from "@/lib/server/db";
import type { MessageMetadata, MessageType, TargetType } from "@/types/chat";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await resolveRequestSession(req);
  if (!session) return sessionDenied();
  const targetType = (req.nextUrl.searchParams.get("targetType") ??
    "dm") as TargetType;
  const targetId = req.nextUrl.searchParams.get("targetId") ?? "";

  if (!targetId) {
    return NextResponse.json({ messages: [] });
  }

  const messages = await getMessages(targetType, targetId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const body = (await req.json()) as {
      targetType?: TargetType;
      targetId?: string;
      content?: string;
      type?: MessageType;
      replyToId?: string | null;
      metadata?: MessageMetadata | null;
    };

    if (!body.targetType || !body.targetId || !body.content?.trim()) {
      return NextResponse.json(
        { error: "Faltan datos del mensaje." },
        { status: 400 }
      );
    }

    const message = await createMessage({
      senderId: user.id,
      targetType: body.targetType,
      targetId: body.targetId,
      content: body.content.trim(),
      type: body.type ?? "text",
      replyToId: body.replyToId ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al enviar mensaje" },
      { status: 400 }
    );
  }
}
