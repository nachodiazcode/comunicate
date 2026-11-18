import { NextRequest, NextResponse } from "next/server";
import { registerOrClaimUser } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      bio?: string;
      avatarColor?: string;
      avatarEmoji?: string;
      avatarUrl?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Ingresa tu nombre para crear la cuenta." },
        { status: 400 }
      );
    }

    const result = await registerOrClaimUser({
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
      bio: body.bio,
      avatarColor: body.avatarColor,
      avatarEmoji: body.avatarEmoji,
      avatarUrl: body.avatarUrl,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error al registrar cuenta",
      },
      { status: 400 }
    );
  }
}
