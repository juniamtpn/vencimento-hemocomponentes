import * as Sentry from "@sentry/nextjs";
import { parsearPlanilha, type BolsaParsed, type ParseResult } from "./sheets-parser";
import { parsearPDF } from "./pdf-parser";

export type { BolsaParsed, ParseResult };

export async function parsearArquivo(
  buffer: Buffer,
  nomeArquivo: string
): Promise<ParseResult> {
  const ext = nomeArquivo.split(".").pop()?.toLowerCase() ?? "";

  Sentry.addBreadcrumb({
    category: "file-parser",
    message: `Iniciando parse: ${nomeArquivo}`,
    level: "info",
    data: { ext, tamanhoBytes: buffer.length },
  });

  try {
    let result: ParseResult;

    if (ext === "pdf") {
      result = await parsearPDF(buffer);
    } else if (ext === "xlsx" || ext === "xls") {
      result = parsearPlanilha(buffer);
    } else {
      throw new Error(`Formato não suportado: .${ext || "desconhecido"}`);
    }

    if (result.bolsas.length === 0) {
      Sentry.addBreadcrumb({
        category: "file-parser",
        message: `Nenhuma bolsa extraída de ${nomeArquivo}`,
        level: "warning",
        data: { ext },
      });
      Sentry.captureMessage(`Arquivo sem bolsas extraídas: ${nomeArquivo}`, {
        level: "warning",
        tags: { "arquivo.nome": nomeArquivo, "arquivo.ext": ext },
        extra: { tamanhoBytes: buffer.length },
      });
    }

    Sentry.addBreadcrumb({
      category: "file-parser",
      message: `Parse concluído: ${result.bolsas.length} bolsa(s) extraída(s)`,
      level: "info",
    });

    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { "arquivo.nome": nomeArquivo, "arquivo.ext": ext },
      extra: { tamanhoBytes: buffer.length },
    });
    throw error;
  }
}
