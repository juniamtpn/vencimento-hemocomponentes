import { db } from "@/lib/db";
import { agencias, registrosDiarios, bolsas, usuarioAgencias, usuarios } from "@/lib/db/schema";
import { buscarArquivoAgencia, baixarArquivo } from "@/lib/onedrive";
import { parsearArquivo } from "@/lib/file-parser";
import {
  notificarAgenciasSemArquivo,
  notificarVencimentosCriticos,
  notificarResponsaveisArquivoFaltando,
  notificarArquivoRejeitado,
} from "@/lib/teams-webhook";
import { nanoid } from "nanoid";
import { eq, and, inArray } from "drizzle-orm";
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

  // Build agenciaId → responsible user email from junction table
  const todasRelacoes = await db.query.usuarioAgencias.findMany();
  const agenciaIds = todasAgencias.map((a) => a.id);
  const relacoesFiltradas = todasRelacoes.filter((r) => agenciaIds.includes(r.agenciaId));
  const usuarioIds = Array.from(new Set(relacoesFiltradas.map((r) => r.usuarioId)));
  const todosUsuariosResp = usuarioIds.length > 0
    ? await db.query.usuarios.findMany({ where: inArray(usuarios.id, usuarioIds) })
    : [];
  const usuariosRespMap = new Map(todosUsuariosResp.map((u) => [u.id, u]));
  const emailPorAgencia = new Map<string, string>();
  for (const rel of relacoesFiltradas) {
    if (!emailPorAgencia.has(rel.agenciaId)) {
      const user = usuariosRespMap.get(rel.usuarioId);
      if (user) emailPorAgencia.set(rel.agenciaId, user.email);
    }
  }

  async function processarAgencia(agencia: typeof todasAgencias[0]) {
    try {
      const arquivo = await buscarArquivoAgencia(agencia.codigo, agora);

      if (!arquivo) {
        semArquivo.push(agencia.nome);

        const liderancaEmail = emailPorAgencia.get(agencia.id);
        if (liderancaEmail) {
          if (!semArquivoPorResponsavel.has(liderancaEmail)) {
            semArquivoPorResponsavel.set(liderancaEmail, {
              email: liderancaEmail,
              nome: agencia.liderancaNome,
              agencias: [],
            });
          }
          semArquivoPorResponsavel.get(liderancaEmail)!.agencias.push(agencia.nome);
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
      const parseResult = await parsearArquivo(buffer, arquivo.nome);
      const bolsasParsed = parseResult.bolsas;

      // Skip stale files — only process today's reports
      if (parseResult.dataEmissao && parseResult.dataEmissao !== hoje) {
        console.warn(`[Processamento] ${agencia.nome}: emissão ${parseResult.dataEmissao} ≠ hoje ${hoje} — arquivo desatualizado, ignorando.`);
        const emailDataInvalida = emailPorAgencia.get(agencia.id);
        if (emailDataInvalida) {
          await notificarArquivoRejeitado({
            agencia: agencia.nome,
            email: emailDataInvalida,
            nome: agencia.liderancaNome,
            arquivoNome: arquivo.nome,
            motivo: "data_invalida",
            dataArquivo: parseResult.dataEmissao,
          });
        }
        resultados.push({ agencia: agencia.nome, codigo: agencia.codigo, status: "arquivo_desatualizado" });
        return;
      }

      // Skip files whose agency code doesn't match the expected agency
      if (parseResult.codigoAgencia && parseResult.codigoAgencia.toUpperCase() !== agencia.codigo.toUpperCase()) {
        console.warn(`[Processamento] ${agencia.nome}: código no arquivo "${parseResult.codigoAgencia}" ≠ agência esperada "${agencia.codigo}" — ignorando.`);
        const emailAgenciaIncorreta = emailPorAgencia.get(agencia.id);
        if (emailAgenciaIncorreta) {
          await notificarArquivoRejeitado({
            agencia: agencia.nome,
            email: emailAgenciaIncorreta,
            nome: agencia.liderancaNome,
            arquivoNome: arquivo.nome,
            motivo: "agencia_incorreta",
            codigoArquivo: parseResult.codigoAgencia,
            codigoEsperado: agencia.codigo,
          });
        }
        resultados.push({ agencia: agencia.nome, codigo: agencia.codigo, status: "agencia_incorreta" });
        return;
      }

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
