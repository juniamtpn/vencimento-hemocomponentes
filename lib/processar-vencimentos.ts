import { db } from "@/lib/db";
import { registrosDiarios, bolsas, usuarios, execucoesCron } from "@/lib/db/schema";
import { buscarArquivoAgencia, baixarArquivo, getShareRootInfo, limparArquivosAntigos } from "@/lib/google-drive";
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

export async function processarVencimentos(triggeredBy: "cron" | "manual" = "cron"): Promise<{
  date: string;
  resultados: ResultadoAgencia[];
}> {
  const iniciadoEm = Math.floor(Date.now() / 1000);
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
  const nomePorAgencia = new Map<string, string>();
  for (const rel of relacoesFiltradas) {
    if (!emailPorAgencia.has(rel.agenciaId)) {
      const user = usuariosRespMap.get(rel.usuarioId);
      if (user) {
        emailPorAgencia.set(rel.agenciaId, user.email);
        nomePorAgencia.set(rel.agenciaId, user.nome);
      }
    }
  }

  // Resolve pasta raiz uma única vez para todas as agências
  let rootInfo: { driveId: string; itemId: string } | undefined;
  try {
    rootInfo = await getShareRootInfo();
  } catch (err) {
    console.error("[Cron] Não foi possível obter pasta raiz do Google Drive:", err);
  }

  async function processarAgencia(agencia: typeof todasAgencias[0]) {
    try {
      const arquivo = await buscarArquivoAgencia(agencia.codigo, agora, rootInfo);

      if (!arquivo) {
        semArquivo.push(agencia.nome);

        const liderancaEmail = emailPorAgencia.get(agencia.id);
        if (liderancaEmail) {
          if (!semArquivoPorResponsavel.has(liderancaEmail)) {
            semArquivoPorResponsavel.set(liderancaEmail, {
              email: liderancaEmail,
              nome: nomePorAgencia.get(agencia.id) ?? agencia.nome,
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

      // Limpa os registros anteriores da agência. Precisa acontecer antes das
      // rejeições: um arquivo recusado não pode deixar as bolsas da execução
      // anterior no painel como se ainda valessem.
      const limparRegistrosDaAgencia = async () => {
        const registrosExistentes = await db.query.registrosDiarios.findMany({
          where: eq(registrosDiarios.agenciaId, agencia.id),
        });
        for (const reg of registrosExistentes) {
          await db.delete(bolsas).where(eq(bolsas.registroId, reg.id));
          await db.delete(registrosDiarios).where(eq(registrosDiarios.id, reg.id));
        }
      };

      // Registra a recusa como "erro" e avisa o responsável. Sem isso a agência
      // aparece como "sem arquivo" no painel — indistinguível de quem não enviou.
      const rejeitar = async (
        status: string,
        motivo: Parameters<typeof notificarArquivoRejeitado>[0]["motivo"],
        extra: Partial<Parameters<typeof notificarArquivoRejeitado>[0]> = {}
      ) => {
        await limparRegistrosDaAgencia();
        await db.insert(registrosDiarios).values({
          id: nanoid(),
          agenciaId: agencia.id,
          dataProcessamento: hoje,
          totalBolsas: 0,
          arquivoNome: arquivo!.nome,
          status: "erro",
          motivoErro: motivo,
        });

        const email = emailPorAgencia.get(agencia.id);
        if (email) {
          await notificarArquivoRejeitado({
            agencia: agencia.nome,
            email,
            nome: nomePorAgencia.get(agencia.id) ?? agencia.nome,
            arquivoNome: arquivo!.nome,
            motivo,
            ...extra,
          }).catch((e) =>
            console.error(`[Processamento] Falha ao notificar rejeição de ${agencia.nome}:`, e)
          );
        }
        resultados.push({ agencia: agencia.nome, codigo: agencia.codigo, status });
      };

      // PDF digitalizado como imagem: não há texto para ler, em nenhum formato.
      // Nenhum ajuste de parser resolve — só a agência reexportando o relatório.
      if (parseResult.semCamadaTexto) {
        console.warn(`[Processamento] ${agencia.nome}: PDF sem camada de texto (digitalizado) — impossível ler.`);
        await rejeitar("sem_camada_texto", "sem_texto");
        return;
      }

      // Skip stale files — only process today's reports
      if (parseResult.dataEmissao && parseResult.dataEmissao !== hoje) {
        console.warn(`[Processamento] ${agencia.nome}: emissão ${parseResult.dataEmissao} ≠ hoje ${hoje} — arquivo desatualizado, ignorando.`);
        await rejeitar("arquivo_desatualizado", "data_invalida", { dataArquivo: parseResult.dataEmissao });
        return;
      }

      // Skip files whose agency code doesn't match the expected agency
      if (parseResult.codigoAgencia && parseResult.codigoAgencia.toUpperCase() !== agencia.codigo.toUpperCase()) {
        console.warn(`[Processamento] ${agencia.nome}: código no arquivo "${parseResult.codigoAgencia}" ≠ agência esperada "${agencia.codigo}" — ignorando.`);
        await rejeitar("agencia_incorreta", "agencia_incorreta", {
          codigoArquivo: parseResult.codigoAgencia,
          codigoEsperado: agencia.codigo,
        });
        return;
      }

      // Confere a leitura contra o total que o próprio relatório declara. É a
      // única verificação independente do parser que temos: se divergir, alguma
      // linha foi perdida ou lida a mais, e publicar o resultado significaria
      // exibir um estoque incompleto sem ninguém perceber.
      const totalDeclarado = parseResult.totalDeclarado;
      if (totalDeclarado != null && bolsasParsed.length !== totalDeclarado) {
        console.warn(`[Processamento] ${agencia.nome}: extraídas ${bolsasParsed.length} bolsa(s) mas o relatório declara ${totalDeclarado} — leitura não confiável.`);
        await rejeitar("total_divergente", "total_divergente", {
          totalExtraido: bolsasParsed.length,
          totalDeclarado,
        });
        return;
      }

      await limparRegistrosDaAgencia();

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

  // Send notifications — errors are logged but never abort the processing result
  await Promise.allSettled([
    notificarAgenciasSemArquivo(semArquivo).catch((e) =>
      console.error("[Cron] Falha ao notificar webhook geral:", e)
    ),
    notificarResponsaveisArquivoFaltando(Array.from(semArquivoPorResponsavel.values())).catch((e) =>
      console.error("[Cron] Falha ao notificar responsáveis:", e)
    ),
  ]);

  const finalizadoEm = Math.floor(Date.now() / 1000);
  const processadas = resultados.filter((r) => r.status === "processado").length;
  const semArquivoCount = resultados.filter((r) => r.status === "sem_arquivo").length;
  const errosCount = resultados.filter((r) => !["processado", "sem_arquivo"].includes(r.status)).length;

  let statusExecucao: "sucesso" | "parcial" | "erro";
  if (errosCount === todasAgencias.length) statusExecucao = "erro";
  else if (processadas === todasAgencias.length) statusExecucao = "sucesso";
  else statusExecucao = "parcial";

  await db.insert(execucoesCron).values({
    id: nanoid(),
    iniciadoEm,
    finalizadoEm,
    triggeredBy,
    status: statusExecucao,
    totalAgencias: todasAgencias.length,
    processadas,
    semArquivo: semArquivoCount,
    erros: errosCount,
    detalhes: JSON.stringify(resultados),
  }).catch((e) => console.error("[Cron] Falha ao salvar execução:", e));

  if (rootInfo) {
    limparArquivosAntigos(rootInfo.itemId)
      .then(({ excluidos, erros: errosLimpeza }) =>
        console.log(`[Google Drive] Limpeza: ${excluidos} excluídos, ${errosLimpeza} erros.`)
      )
      .catch((e) => console.error("[Google Drive] Falha na limpeza de arquivos antigos:", e));
  }

  return { date: hoje, resultados };
}
