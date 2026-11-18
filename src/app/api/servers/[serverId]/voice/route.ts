import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { updateVoiceState } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const { serverId } = await context.params;
    const body = (await req.json()) as {
      channelId?: string | null;
      muted?: boolean;
      speaking?: boolean;
    };

    const voiceParticipants = updateVoiceState({
      user,
      serverId,
      channelId: body.channelId ?? null,
      muted: body.muted,
      speaking: body.speaking,
    });

    return NextResponse.json({ voiceParticipants });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en sala de voz" },
      { status: 400 }
    );
  }
}
