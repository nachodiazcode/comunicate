import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@/types/chat";
import { getUserByToken } from "./db";

export async function resolveRequestSession(req: NextRequest): Promise<{
  user: User;
  token: string;
} | null> {
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    token = req.nextUrl.searchParams.get("token");
  }

  if (!token) {
    token = req.cookies.get("comunicate_token")?.value ?? null;
  }

  if (!token) return null;
  const matched = await getUserByToken(token);
  if (!matched) return null;
  return { user: matched, token };
}

export function sessionDenied() {
  return NextResponse.json(
    { error: "Inicia sesión para continuar." },
    { status: 401 }
  );
}
