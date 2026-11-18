import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { addContactAndEnsureDm, getContactsForUser } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await resolveRequestSession(req);
  if (!session) return sessionDenied();
  const { user } = session;
  const contacts = await getContactsForUser(user.id);
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const body = (await req.json()) as {
      alias?: string;
      phone?: string;
      email?: string;
      avatarUrl?: string;
      targetUserId?: string;
      initialMessage?: string;
    };

    const result = await addContactAndEnsureDm({
      ownerId: user.id,
      alias: body.alias,
      phone: body.phone,
      email: body.email,
      avatarUrl: body.avatarUrl,
      targetUserId: body.targetUserId,
      initialMessage: body.initialMessage,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al agregar contacto",
      },
      { status: 400 }
    );
  }
}
