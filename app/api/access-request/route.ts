import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, agencias } from "@/lib/db/schema";
import { notificarSolicitacaoAcesso } from "@/lib/teams-webhook";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(3),
  agencia: z.string().min(1),
  justificativa: z.string().min(10),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { nome, agencia, justificativa } = parsed.data;

  const agenciaRecord = await db.query.agencias.findFirst({
    where: eq(agencias.nome, agencia),
  });

  const existing = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, session.user.email),
  });

  let usuarioId: string;

  if (existing) {
    if (existing.status === "aprovado") {
      return NextResponse.json(
        { error: "Usuário já tem acesso aprovado." },
        { status: 400 }
      );
    }
    await db
      .update(usuarios)
      .set({
        nome,
        agenciaId: agenciaRecord?.id ?? null,
        justificativa,
        status: "pendente",
      })
      .where(eq(usuarios.id, existing.id));
    usuarioId = existing.id;
  } else {
    usuarioId = nanoid();
    await db.insert(usuarios).values({
      id: usuarioId,
      email: session.user.email,
      nome,
      agenciaId: agenciaRecord?.id ?? null,
      justificativa,
      status: "pendente",
      perfil: "viewer",
    });
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await notificarSolicitacaoAcesso({
    nome,
    email: session.user.email,
    agencia,
    justificativa,
    usuarioId,
    appUrl,
  });

  return NextResponse.json({ ok: true });
}
