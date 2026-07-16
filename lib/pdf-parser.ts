import * as pdfParseModule from "pdf-parse";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer, options?: unknown) => Promise<{ text: string }> =
  (pdfParseModule as any).default ?? pdfParseModule;
import { classificarUrgencia, normalizarFatorRh, type BolsaParsed, type ParseResult } from "./sheets-parser";

// ── Extração posicional ───────────────────────────────────────────────────────
//
// O render padrão do pdf-parse concatena os fragmentos de uma mesma coordenada Y
// SEM separador, e agrupa por igualdade exata de Y. Nos relatórios do HEMOTE isso
// funde células vizinhas ("15/07/2026 23:59AT - HLC", "HSCUABP", "VITAP") e, quando
// o Y varia por fração de ponto, quebra uma linha visual em várias. Reconstruir a
// tabela a partir desse texto é impossível: as células de uma linha podem sair
// fora de ordem, e um relatório com bolsas vencidas (vermelhas) e a vencer (pretas)
// é desenhado em dois grupos separados.
//
// O pdf.js expõe a posição de cada fragmento em `transform` ([a,b,c,d,x,y]).
// Reagrupando por Y (com tolerância) e ordenando por X recuperamos as linhas reais
// da tabela, com as células separadas — que é o que o parser abaixo consome.

interface ItemPosicional {
  s: string;
  x: number;
  y: number;
}

// Fragmentos da mesma linha visual raramente têm Y idêntico; 2pt cobre a variação
// observada sem juntar linhas vizinhas (o espaçamento entre linhas é ~15pt).
const TOLERANCIA_Y = 2;

// pdf-parse engole qualquer exceção do pagerender e devolve "" para a página
// (lib/pdf-parse.js: `.catch(() => "")`). Sem um marcador explícito, uma falha
// aqui seria indistinguível de uma página sem texto — e um relatório íntegro
// seria reportado à agência como "PDF escaneado". Por isso este render nunca
// lança: ou devolve os itens, ou devolve o erro como dado.
interface FalhaRender {
  __falha: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderItensPosicionais(pageData: any): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((textContent: any) => {
      const itens: ItemPosicional[] = [];
      // Itens sem `transform` (p.ex. marcadores de conteúdo) não são texto
      // posicionável: descartar é correto, derrubar a página inteira não.
      for (const item of textContent?.items ?? []) {
        if (typeof item?.str !== "string") continue;
        const t = item.transform;
        if (!Array.isArray(t) || typeof t[4] !== "number" || typeof t[5] !== "number") continue;
        itens.push({ s: item.str, x: t[4], y: t[5] });
      }
      return JSON.stringify(itens);
    })
    .catch((err: unknown) =>
      JSON.stringify({ __falha: err instanceof Error ? err.message : String(err) } as FalhaRender)
    );
}

export function agruparEmLinhas(itens: ItemPosicional[]): string[][] {
  // Texto colorido é desenhado duas vezes na mesma coordenada (overprint): nas
  // linhas de bolsa vencida a instituição aparece duplicada. Sem deduplicar, a
  // linha ganha uma célula a mais que o cabeçalho.
  const vistos = new Set<string>();
  const unicos = itens.filter((item) => {
    if (!item.s || item.s.trim() === "") return false;
    const chave = `${item.s}@${Math.round(item.x)},${Math.round(item.y)}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const linhas: { y: number; itens: ItemPosicional[] }[] = [];
  for (const item of unicos) {
    const alvo = linhas.find((l) => Math.abs(l.y - item.y) <= TOLERANCIA_Y);
    if (alvo) alvo.itens.push(item);
    else linhas.push({ y: item.y, itens: [item] });
  }

  linhas.sort((a, b) => b.y - a.y); // topo → base
  return linhas.map((l) =>
    l.itens
      .sort((a, b) => a.x - b.x)
      .map((i) => i.s.trim())
      .filter(Boolean)
  );
}

// ── Parser de linha da tabela ─────────────────────────────────────────────────
//
// Os dois layouts em uso compartilham a mesma espinha dorsal, então localizar as
// células por conteúdo (e não por índice fixo) atende aos dois:
//   Compacto:  Instituição | Doação | Comp. | Seq. | Validade | Loc. Arm. | ABO | Fator Rh
//   Analítico: Inst. Colet. | Doação | Comp. | Seq. | Validade | Lavado | Refrac. |
//              Deleuc. | Irrad. | Loc. Armazenamento | Gr. ABO | Fator RH | CDE

const CELULA_DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}$/;
const CELULA_AT_RE = /^AT\s*-\s*([A-Z0-9]+)$/i;
const CELULA_DOACAO_RE = /^\d{7,9}$/;
const CELULA_ABO_RE = /^(AB|[ABO])$/;
const CELULA_FATOR_RE = /^[PN]$/;

function parsearLinhaTabela(
  celulas: string[]
): { bolsa: BolsaParsed; locArm: string } | null {
  const iData = celulas.findIndex((c) => CELULA_DATA_RE.test(c));
  const iAt = celulas.findIndex((c) => CELULA_AT_RE.test(c));
  const iDoacao = celulas.findIndex((c) => CELULA_DOACAO_RE.test(c));
  if (iData < 0 || iAt < 0 || iDoacao < 0) return null;

  // ABO e Fator Rh ficam depois da coluna de localização nos dois layouts.
  // Restringir a busca evita capturar um "N" de Lavado/Irrad. ("NÃO" não casa,
  // mas a âncora protege contra variações futuras do relatório).
  const depoisDoAt = celulas.slice(iAt + 1);
  const abo = depoisDoAt.find((c) => CELULA_ABO_RE.test(c));
  const fator = depoisDoAt.find((c) => CELULA_FATOR_RE.test(c));
  if (!abo || !fator) return null;

  const [, dia, mes, ano] = celulas[iData].match(CELULA_DATA_RE)!;
  const validade = `${ano}-${mes}-${dia}`;

  return {
    bolsa: {
      instituicao: iDoacao > 0 ? celulas[0] : "?",
      doacao: celulas[iDoacao],
      componente: celulas[iDoacao + 1] ?? "?",
      validade,
      abo,
      fatorRh: normalizarFatorRh(fator),
      urgencia: classificarUrgencia(validade),
    },
    locArm: celulas[iAt].match(CELULA_AT_RE)![1].toUpperCase(),
  };
}

const EMISSAO_RE = /emiss[aã]o[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
// "Total => 4" (compacto) e "Total : 3" (analítico)
const TOTAL_RE = /Total\s*(?:=>|:)\s*(\d+)/i;

// ── Ponto de entrada ──────────────────────────────────────────────────────────

export async function parsearPDF(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer, { pagerender: renderItensPosicionais });

  const bolsas: BolsaParsed[] = [];
  const contagemCodigos = new Map<string, number>();
  let dataEmissao: string | null = null;
  let totalDeclarado: number | null = null;
  let totalFragmentos = 0;

  // pdf-parse concatena o retorno de cada página com "\n\n"
  for (const pagina of data.text.split("\n\n")) {
    if (!pagina.trim()) continue;

    let conteudo: ItemPosicional[] | FalhaRender;
    try {
      conteudo = JSON.parse(pagina);
    } catch {
      // Não é o JSON que nosso render produz: o pagerender não chegou a rodar e
      // o pdf-parse caiu no render padrão. Tratar como falha, não como "sem texto".
      throw new Error(
        `[PDF] Extração posicional não foi aplicada (recebido texto corrido). Trecho: ${pagina.slice(0, 80)}`
      );
    }
    if (!Array.isArray(conteudo)) {
      throw new Error(`[PDF] Falha ao extrair texto da página: ${conteudo.__falha}`);
    }

    const itens = conteudo;
    totalFragmentos += itens.length;

    for (const celulas of agruparEmLinhas(itens)) {
      const linha = celulas.join(" ");

      if (!dataEmissao) {
        const m = linha.match(EMISSAO_RE);
        if (m) dataEmissao = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      }
      if (totalDeclarado === null) {
        const m = linha.match(TOTAL_RE);
        if (m) totalDeclarado = parseInt(m[1], 10);
      }

      const resultado = parsearLinhaTabela(celulas);
      if (resultado) {
        bolsas.push(resultado.bolsa);
        contagemCodigos.set(resultado.locArm, (contagemCodigos.get(resultado.locArm) ?? 0) + 1);
      }
    }
  }

  let codigoAgencia: string | null = null;
  let maxContagem = 0;
  contagemCodigos.forEach((contagem, codigo) => {
    if (contagem > maxContagem) {
      maxContagem = contagem;
      codigoAgencia = codigo;
    }
  });

  return {
    bolsas,
    dataEmissao,
    codigoAgencia,
    totalDeclarado,
    // Zero fragmentos = o PDF não tem texto, só imagem. Um relatório legítimo
    // sem bolsas ainda traz cabeçalho, emissão e "Total => 0".
    semCamadaTexto: totalFragmentos === 0,
  };
}
