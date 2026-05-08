import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.perfil !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, params.id) });
  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await db
    .update(usuarios)
    .set({ status: "aprovado", updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(usuarios.id, params.id));

  return NextResponse.json({ ok: true });
}
