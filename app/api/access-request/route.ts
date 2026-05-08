import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, agencias, usuarioAgencias } from "@/lib/db/schema";
import { notificarSolicitacaoAcesso } from "@/lib/teams-webhook";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

async function vincularAgencia(usuarioId: string, agenciaId: string | null) {
  await db.delete(usuarioAgencias).where(eq(usuarioAgencias.usuarioId, usuarioId));
  if (agenciaId) {
    await db.insert(usuarioAgencias).values({ id: nanoid(), usuarioId, agenciaId });
  }
}
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
    const agora = Math.floor(Date.now() / 1000);
    const COOLDOWN = 5 * 60;
    if (agora - existing.updatedAt < COOLDOWN) {
      const restante = Math.ceil((COOLDOWN - (agora - existing.updatedAt)) / 60);
      return NextResponse.json(
        { error: `Aguarde ${restante} minuto(s) antes de enviar uma nova solicitação.` },
        { status: 429 }
      );
    }
    await db
      .update(usuarios)
      .set({ nome, justificativa, status: "pendente" })
      .where(eq(usuarios.id, existing.id));
    usuarioId = existing.id;
    await vincularAgencia(usuarioId, agenciaRecord?.id ?? null);
  } else {
    usuarioId = nanoid();
    await db.insert(usuarios).values({
      id: usuarioId,
      email: session.user.email,
      nome,
      justificativa,
      status: "pendente",
      perfil: "viewer",
    });
    await vincularAgencia(usuarioId, agenciaRecord?.id ?? null);
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
