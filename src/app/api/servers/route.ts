import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { createServer } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const body = (await req.json()) as {
      name?: string;
      icon?: string;
      gradient?: string;
      description?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Ingresa un nombre para el servidor." },
        { status: 400 }
      );
    }

    const server = await createServer({
      ownerId: user.id,
      name: body.name,
      icon: body.icon,
      gradient: body.gradient,
      description: body.description,
    });
    return NextResponse.json({ server });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear servidor" },
      { status: 400 }
    );
  }
}
