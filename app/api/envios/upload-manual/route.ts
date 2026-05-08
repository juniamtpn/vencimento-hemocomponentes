import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrosDiarios, bolsas } from "@/lib/db/schema";
import { parsearArquivo } from "@/lib/file-parser";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo") as File | null;
  const agenciaId = formData.get("agenciaId") as string | null;

  if (!arquivo || !agenciaId) {
    return NextResponse.json({ error: "Arquivo e agência são obrigatórios" }, { status: 400 });
  }

  const hoje = format(toZonedTime(new Date(), "America/Sao_Paulo"), "yyyy-MM-dd");

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  let bolsasParsed;
  try {
    bolsasParsed = await parsearArquivo(buffer, arquivo.name);
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo. Verifique o formato (.xlsx, .xls ou .pdf)." }, { status: 422 });
  }

  // Replace any existing records for this agency
  const existentes = await db.query.registrosDiarios.findMany({
    where: eq(registrosDiarios.agenciaId, agenciaId),
  });
  for (const reg of existentes) {
    await db.delete(bolsas).where(eq(bolsas.registroId, reg.id));
    await db.delete(registrosDiarios).where(eq(registrosDiarios.id, reg.id));
  }

  const registroId = nanoid();
  await db.insert(registrosDiarios).values({
    id: registroId,
    agenciaId,
    dataProcessamento: hoje,
    totalBolsas: bolsasParsed.length,
    arquivoNome: arquivo.name,
    status: "processado",
    tipoEnvio: "manual",
    enviadoPor: session.user.email ?? undefined,
  });

  for (const bolsa of bolsasParsed) {
    await db.insert(bolsas).values({
      id: nanoid(),
      registroId,
      agenciaId,
      instituicao: bolsa.instituicao,
      doacao: bolsa.doacao,
      componente: bolsa.componente,
      validade: bolsa.validade,
      abo: bolsa.abo,
      fatorRh: bolsa.fatorRh,
      urgencia: bolsa.urgencia,
    });
  }

  return NextResponse.json({ ok: true, totalBolsas: bolsasParsed.length });
}
