import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { bolsas, agencias, registrosDiarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agenciaId = searchParams.get("agenciaId");
  const data = searchParams.get("data");

  if (!agenciaId || !data) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: agenciaId e data" },
      { status: 400 }
    );
  }

  const registro = await db.query.registrosDiarios.findFirst({
    where: and(
      eq(registrosDiarios.agenciaId, agenciaId),
      eq(registrosDiarios.dataProcessamento, data)
    ),
  });

  if (!registro || registro.status !== "processado") {
    return NextResponse.json({ bolsas: [] });
  }

  const agencia = await db.query.agencias.findFirst({
    where: eq(agencias.id, agenciaId),
  });

  const todasBolsas = await db.query.bolsas.findMany({
    where: eq(bolsas.registroId, registro.id),
  });

  const bolsasComAgencia = todasBolsas.map((b) => ({
    ...b,
    agenciaNome: agencia?.nome ?? "",
    agenciaCodigo: agencia?.codigo ?? "",
  }));

  return NextResponse.json({ bolsas: bolsasComAgencia });
}
