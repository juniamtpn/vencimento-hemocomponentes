import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agencias, registrosDiarios, bolsas } from "@/lib/db/schema";
import { listarExcelsDaPasta, baixarArquivo } from "@/lib/google-drive";
import { parsearPlanilha } from "@/lib/sheets-parser";
import {
  notificarAgenciasSemArquivo,
  notificarVencimentosCriticos,
} from "@/lib/teams-webhook";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoje = format(
    toZonedTime(new Date(), "America/Sao_Paulo"),
    "yyyy-MM-dd"
  );

  const todasAgencias = await db.query.agencias.findMany();
  const semArquivo: string[] = [];
  const resultados: { agencia: string; status: string; bolsas?: number }[] = [];

  for (const agencia of todasAgencias) {
    if (!agencia.onedriveFolderId) {
      semArquivo.push(agencia.nome);
      await db.insert(registrosDiarios).values({
        id: nanoid(),
        agenciaId: agencia.id,
        dataProcessamento: hoje,
        totalBolsas: 0,
        status: "sem_arquivo",
      });
      resultados.push({ agencia: agencia.nome, status: "sem_folder" });
      continue;
    }

    try {
      const arquivos = await listarExcelsDaPasta(agencia.onedriveFolderId);

      if (arquivos.length === 0) {
        semArquivo.push(agencia.nome);
        await db.insert(registrosDiarios).values({
          id: nanoid(),
          agenciaId: agencia.id,
          dataProcessamento: hoje,
          totalBolsas: 0,
          status: "sem_arquivo",
        });
        resultados.push({ agencia: agencia.nome, status: "sem_arquivo" });
        continue;
      }

      const arquivo = arquivos[0];
      const buffer = await baixarArquivo(arquivo.id);
      const bolsasParsed = parsearPlanilha(buffer);

      // Idempotency: delete existing records for today
      const registrosHoje = await db.query.registrosDiarios.findMany({
        where: and(
          eq(registrosDiarios.agenciaId, agencia.id),
          eq(registrosDiarios.dataProcessamento, hoje)
        ),
      });
      for (const reg of registrosHoje) {
        await db.delete(bolsas).where(eq(bolsas.registroId, reg.id));
        await db
          .delete(registrosDiarios)
          .where(eq(registrosDiarios.id, reg.id));
      }

      const registroId = nanoid();
      await db.insert(registrosDiarios).values({
        id: registroId,
        agenciaId: agencia.id,
        dataProcessamento: hoje,
        totalBolsas: bolsasParsed.length,
        arquivoNome: arquivo.nome,
        status: "processado",
      });

      for (const bolsa of bolsasParsed) {
        await db.insert(bolsas).values({
          id: nanoid(),
          registroId,
          agenciaId: agencia.id,
          instituicao: bolsa.instituicao,
          doacao: bolsa.doacao,
          componente: bolsa.componente,
          validade: bolsa.validade,
          abo: bolsa.abo,
          fatorRh: bolsa.fatorRh,
          urgencia: bolsa.urgencia,
        });
      }

      const vencidos = bolsasParsed.filter((b) => b.urgencia === "vencido").length;
      const venHoje = bolsasParsed.filter((b) => b.urgencia === "hoje").length;
      const venAmanha = bolsasParsed.filter((b) => b.urgencia === "amanha").length;

      if (vencidos + venHoje + venAmanha > 0) {
        await notificarVencimentosCriticos({
          agencia: agencia.nome,
          vencidos,
          hoje: venHoje,
          amanha: venAmanha,
        });
      }

      resultados.push({
        agencia: agencia.nome,
        status: "processado",
        bolsas: bolsasParsed.length,
      });
    } catch (error) {
      console.error(`[Cron] Erro em ${agencia.nome}:`, error);
      await db.insert(registrosDiarios).values({
        id: nanoid(),
        agenciaId: agencia.id,
        dataProcessamento: hoje,
        totalBolsas: 0,
        status: "erro",
      });
      resultados.push({ agencia: agencia.nome, status: "erro" });
    }
  }

  await notificarAgenciasSemArquivo(semArquivo);

  return NextResponse.json({ ok: true, date: hoje, resultados });
}
