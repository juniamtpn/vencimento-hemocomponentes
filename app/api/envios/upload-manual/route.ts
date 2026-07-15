import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrosDiarios, bolsas, agencias } from "@/lib/db/schema";
import { parsearArquivo } from "@/lib/file-parser";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

function fmtDataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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

  const agencia = await db.query.agencias.findFirst({ where: eq(agencias.id, agenciaId) });
  if (!agencia) {
    return NextResponse.json({ error: "Agência não encontrada." }, { status: 404 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  let parseResult;
  try {
    parseResult = await parsearArquivo(buffer, arquivo.name, agencia.codigo);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const hint = detail.includes("Formato não suportado")
      ? "Envie um arquivo .xlsx, .xls ou .pdf."
      : "O arquivo pode estar corrompido ou em formato inesperado. Confira se o arquivo abre normalmente no Excel ou leitor de PDF.";
    return NextResponse.json({ error: "Não foi possível ler o arquivo.", hint, debug: detail }, { status: 422 });
  }

  const bolsasParsed = parseResult.bolsas;

  // Validate emission date — only today's reports are accepted
  if (parseResult.dataEmissao && parseResult.dataEmissao !== hoje) {
    return NextResponse.json({
      error: "O relatório não é do dia atual.",
      hint: `O arquivo contém dados emitidos em ${fmtDataBR(parseResult.dataEmissao)}, mas hoje é ${fmtDataBR(hoje)}. Por favor, exporte um relatório atualizado e tente novamente.`,
    }, { status: 422 });
  }

  // Validate agency code correlation — file must belong to the selected agency
  if (parseResult.codigoAgencia && parseResult.codigoAgencia.toUpperCase() !== agencia.codigo.toUpperCase()) {
    return NextResponse.json({
      error: "O arquivo não corresponde à agência selecionada.",
      hint: `O relatório identifica a agência "${parseResult.codigoAgencia}", mas você selecionou "${agencia.codigo}". Verifique se está enviando o arquivo correto para esta agência.`,
    }, { status: 422 });
  }

  if (bolsasParsed.length === 0) {
    return NextResponse.json({
      error: "Nenhuma bolsa identificada no arquivo.",
      hint: "O arquivo foi lido, mas nenhum dado válido foi encontrado. Verifique se a planilha contém o cabeçalho \"Instituição\" e datas de validade preenchidas, ou se o PDF segue o padrão de relatório esperado.",
    }, { status: 422 });
  }

  try {
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
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[upload-manual] Erro ao salvar no banco:", detail);
    return NextResponse.json({
      error: "Erro ao salvar os dados.",
      hint: "Tente novamente. Se o problema persistir, informe o suporte com o nome do arquivo e a agência selecionada.",
      debug: detail,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, totalBolsas: bolsasParsed.length });
}
