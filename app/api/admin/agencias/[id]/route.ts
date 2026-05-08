import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { agencias, registrosDiarios, usuarioAgencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const editSchema = z.object({
  codigo: z.string().min(1).max(30),
  nome: z.string().max(120).optional(),
});

async function guardAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.perfil === "admin";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const agencia = await db.query.agencias.findFirst({ where: eq(agencias.id, params.id) });
  if (!agencia) {
    return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  }

  const codigo = parsed.data.codigo.toUpperCase();
  const nome = parsed.data.nome?.trim() || codigo;

  // Check unique codigo (excluding self)
  const conflito = await db.query.agencias.findFirst({ where: eq(agencias.codigo, codigo) });
  if (conflito && conflito.id !== params.id) {
    return NextResponse.json({ error: `Já existe uma agência com a sigla "${codigo}".` }, { status: 409 });
  }

  await db.update(agencias).set({ codigo, nome }).where(eq(agencias.id, params.id));

  return NextResponse.json({ agencia: { id: params.id, codigo, nome, liderancaNome: agencia.liderancaNome } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const agencia = await db.query.agencias.findFirst({ where: eq(agencias.id, params.id) });
  if (!agencia) {
    return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  }

  const registro = await db.query.registrosDiarios.findFirst({
    where: eq(registrosDiarios.agenciaId, params.id),
  });
  if (registro) {
    return NextResponse.json(
      { error: "Esta agência possui registros de envio e não pode ser excluída." },
      { status: 409 }
    );
  }

  await db.delete(usuarioAgencias).where(eq(usuarioAgencias.agenciaId, params.id));
  await db.delete(agencias).where(eq(agencias.id, params.id));

  return NextResponse.json({ ok: true });
}
