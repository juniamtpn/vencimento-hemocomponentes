import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notificarAcessoAprovado } from "@/lib/teams-webhook";
import { z } from "zod";

const schema = z.object({
  perfil: z.enum(["admin", "viewer", "lideranca"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.perfil !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
  }

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, params.id),
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await db
    .update(usuarios)
    .set({
      status: "aprovado",
      perfil: parsed.data.perfil,
      aprovadoPor: session.user.email ?? "",
    })
    .where(eq(usuarios.id, params.id));

  await notificarAcessoAprovado({
    nome: usuario.nome,
    email: usuario.email,
    perfil: parsed.data.perfil,
  });

  return NextResponse.json({ ok: true });
}
