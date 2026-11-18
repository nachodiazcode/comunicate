import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      identifier?: string;
      password?: string;
    };
    const result = await loginUser({
      identifier: body.identifier,
      password: body.password,
    });

    if (!result) {
      return NextResponse.json(
        {
          error:
            "No encontramos una cuenta con ese teléfono o correo. Puedes crearla.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al iniciar sesión" },
      { status: 401 }
    );
  }
}
