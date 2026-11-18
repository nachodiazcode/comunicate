import { NextRequest, NextResponse } from "next/server";
import { resolveRequestSession, sessionDenied } from "@/lib/server/auth";
import { deleteMessage, editMessage } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const { messageId } = await context.params;
    const body = (await req.json()) as { content?: string };

    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: "El mensaje no puede quedar vacío." },
        { status: 400 }
      );
    }

    const message = await editMessage({
      messageId,
      userId: user.id,
      content: body.content,
    });
    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al editar mensaje" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await resolveRequestSession(req);
    if (!session) return sessionDenied();
    const { user } = session;
    const { messageId } = await context.params;
    await deleteMessage({ messageId, userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error al eliminar mensaje",
      },
      { status: 400 }
    );
  }
}
