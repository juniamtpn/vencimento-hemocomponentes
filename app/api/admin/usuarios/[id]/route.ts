import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, usuarioAgencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const editSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  telefone: z.string().nullable().optional(),
  perfil: z.enum(["admin", "viewer", "lideranca"]),
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

  const { nome, email, telefone, perfil } = parsed.data;

  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, params.id) });
  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await db
    .update(usuarios)
    .set({ nome, email, telefone: telefone ?? null, perfil, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(usuarios.id, params.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, params.id) });
  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await db.delete(usuarioAgencias).where(eq(usuarioAgencias.usuarioId, params.id));
  await db.delete(usuarios).where(eq(usuarios.id, params.id));

  return NextResponse.json({ ok: true });
}
