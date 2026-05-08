import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { agencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const createSchema = z.object({
  codigo: z.string().min(1).max(30),
  nome: z.string().max(120).optional(),
});

async function guardAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.perfil === "admin";
}

export async function POST(request: NextRequest) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const codigo = parsed.data.codigo.toUpperCase();
  const nome = parsed.data.nome?.trim() || codigo;

  const existente = await db.query.agencias.findFirst({ where: eq(agencias.codigo, codigo) });
  if (existente) {
    return NextResponse.json({ error: `Já existe uma agência com a sigla "${codigo}".` }, { status: 409 });
  }

  const id = nanoid();
  await db.insert(agencias).values({
    id,
    codigo,
    nome,
    liderancaNome: "",
  });

  return NextResponse.json({ agencia: { id, codigo, nome, liderancaNome: "" } }, { status: 201 });
}
