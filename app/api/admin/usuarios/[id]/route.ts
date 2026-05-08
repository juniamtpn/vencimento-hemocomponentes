import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios, usuarioAgencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const editSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  perfil: z.enum(["admin", "viewer", "lideranca"]),
  agenciaIds: z.array(z.string()).default([]),
});

async function guardAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.perfil !== "admin") return false;
  return true;
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

  const { nome, email, perfil, agenciaIds } = parsed.data;

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, params.id),
  });
  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // For single-agency profiles (viewer/admin) keep agenciaId in sync
  const agenciaId = agenciaIds.length === 1 ? agenciaIds[0] : null;

  await db
    .update(usuarios)
    .set({
      nome,
      email,
      perfil,
      agenciaId,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(usuarios.id, params.id));

  // Sync junction table: delete existing, insert new
  await db.delete(usuarioAgencias).where(eq(usuarioAgencias.usuarioId, params.id));
  for (const aid of agenciaIds) {
    await db.insert(usuarioAgencias).values({
      id: nanoid(),
      usuarioId: params.id,
      agenciaId: aid,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, params.id),
  });
  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // Delete junction rows first (no cascade configured)
  await db.delete(usuarioAgencias).where(eq(usuarioAgencias.usuarioId, params.id));
  await db.delete(usuarios).where(eq(usuarios.id, params.id));

  return NextResponse.json({ ok: true });
}
