import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { createChannel } from "@/lib/server/db";
import type { ChannelType } from "@/types/chat";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { serverId } = await context.params;
    const body = (await req.json()) as {
      name?: string;
      topic?: string;
      type?: ChannelType;
    };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Ingresa un nombre para el canal." },
        { status: 400 }
      );
    }

    const channel = await createChannel({
      serverId,
      name: body.name,
      topic: body.topic,
      type: body.type,
    });
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear canal" },
      { status: 400 }
    );
  }
}
