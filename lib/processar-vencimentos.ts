import { db } from "@/lib/db";
import { agencias, registrosDiarios, bolsas } from "@/lib/db/schema";
import { buscarArquivoAgencia, baixarArquivo } from "@/lib/onedrive";
import { parsearArquivo } from "@/lib/file-parser";
import {
  notificarAgenciasSemArquivo,
  notificarVencimentosCriticos,
  notificarResponsaveisArquivoFaltando,
} from "@/lib/teams-webhook";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface ResultadoAgencia {
  agencia: string;
  codigo: string;
  status: string;
  bolsas?: number;
}

export async function processarVencimentos(): Promise<{
  date: string;
  resultados: ResultadoAgencia[];
}> {
  const agora = toZonedTime(new Date(), "America/Sao_Paulo");
  const hoje = format(agora, "yyyy-MM-dd");

  const todasAgencias = await db.query.agencias.findMany();
  const semArquivo: string[] = [];
  const resultados: ResultadoAgencia[] = [];
  const semArquivoPorResponsavel: Map<string, { email: string; nome: string; agencias: string[] }> = new Map();

  async function processarAgencia(agencia: typeof todasAgencias[0]) {
    try {
      const arquivo = await buscarArquivoAgencia(agencia.codigo, agora);

      if (!arquivo) {
        semArquivo.push(agencia.nome);

        if (agencia.liderancaEmail) {
          const key = agencia.liderancaEmail;
          if (!semArquivoPorResponsavel.has(key)) {
            semArquivoPorResponsavel.set(key, {
              email: agencia.liderancaEmail,
              nome: agencia.liderancaNome,
              agencias: [],
            });
          }
          semArquivoPorResponsavel.get(key)!.agencias.push(agencia.nome);
        }

        const existente = await db.query.registrosDiarios.findFirst({
          where: and(
            eq(registrosDiarios.agenciaId, agencia.id),
            eq(registrosDiarios.dataProcessamento, hoje)
          ),
        });
        if (!existente) {
          await db.insert(registrosDiarios).values({
            id: nanoid(),
            agenciaId: agencia.id,
            dataProcessamento: hoje,
            totalBolsas: 0,
            status: "sem_arquivo",
          });
        }
        resultados.push({ agencia: agencia.nome, codigo: agencia.codigo, status: "sem_arquivo" });
        return;
      }

      const buffer = await baixarArquivo(arquivo.downloadUrl);
      const bolsasParsed = await parsearArquivo(buffer, arquivo.nome);

      const registrosExistentes = await db.query.registrosDiarios.findMany({
        where: eq(registrosDiarios.agenciaId, agencia.id),
      });
      for (const reg of registrosExistentes) {
        await db.delete(bolsas).where(eq(bolsas.registroId, reg.id));
        await db.delete(registrosDiarios).where(eq(registrosDiarios.id, reg.id));
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
        codigo: agencia.codigo,
        status: "processado",
        bolsas: bolsasParsed.length,
      });
    } catch (error) {
      console.error(`[Processamento] Erro em ${agencia.nome}:`, error);
      resultados.push({ agencia: agencia.nome, codigo: agencia.codigo, status: "erro" });
    }
  }

  // Processa em lotes de 3 para não sobrecarregar Graph API nem o banco
  const LOTE = 3;
  for (let i = 0; i < todasAgencias.length; i += LOTE) {
    await Promise.all(todasAgencias.slice(i, i + LOTE).map(processarAgencia));
  }

  // Send notifications
  await Promise.all([
    notificarAgenciasSemArquivo(semArquivo),
    notificarResponsaveisArquivoFaltando(Array.from(semArquivoPorResponsavel.values())),
  ]);

  return { date: hoje, resultados };
}
