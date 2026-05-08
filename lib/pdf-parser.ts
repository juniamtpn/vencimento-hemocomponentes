import * as pdfParseModule from "pdf-parse";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> =
  (pdfParseModule as any).default ?? pdfParseModule;
import { classificarUrgencia, normalizarFatorRh, type BolsaParsed, type ParseResult } from "./sheets-parser";

// Matches "DD/MM/YYYY HH:MM" — anchor used to split each data line
const DATE_TIME_RE = /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;

const ABO_VALIDOS = new Set(["A", "B", "O", "AB"]);

function parsearLinhaPDF(linha: string): { bolsa: BolsaParsed; locArm: string | null } | null {
  const match = linha.match(DATE_TIME_RE);
  if (!match) return null;

  const inicioData = linha.indexOf(match[0]);

  // Tokens before date: [instituicao, doacao, componente, seq?]
  const antesData = linha.substring(0, inicioData).trim().split(/\s+/).filter(Boolean);
  if (antesData.length < 3) return null;

  // Tokens after "DD/MM/YYYY HH:MM": "AT - HMT B P" → last two are ABO e FatorRh
  const depoisData = linha.substring(inicioData + match[0].length).trim();
  const tokensDepois = depoisData.split(/\s+/).filter(Boolean);
  if (tokensDepois.length < 2) return null;

  const [instituicao, doacao, componente] = antesData;
  const fatorRhRaw = tokensDepois[tokensDepois.length - 1];
  const abo = tokensDepois[tokensDepois.length - 2].toUpperCase();

  if (!ABO_VALIDOS.has(abo)) return null;

  const [d, m, y] = match[1].split("/");
  const validade = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

  // Extract agency code from "AT - CODE" pattern in Loc.Arm. position
  let locArm: string | null = null;
  if (tokensDepois[0] === "AT" && tokensDepois[1] === "-" && tokensDepois[2]) {
    locArm = tokensDepois[2].toUpperCase();
  }

  return {
    bolsa: {
      instituicao,
      doacao,
      componente,
      validade,
      abo,
      fatorRh: normalizarFatorRh(fatorRhRaw),
      urgencia: classificarUrgencia(validade),
    },
    locArm,
  };
}

export async function parsearPDF(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  const linhas = data.text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Extract emission date from "Emissão: DD/MM/YYYY" in the report header
  const emissaoMatch = data.text.match(/emiss[aã]o[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  let dataEmissao: string | null = null;
  if (emissaoMatch) {
    const [, d, m, y] = emissaoMatch;
    dataEmissao = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const bolsas: BolsaParsed[] = [];
  const codigoContagem = new Map<string, number>();

  for (const linha of linhas) {
    const result = parsearLinhaPDF(linha);
    if (result) {
      bolsas.push(result.bolsa);
      if (result.locArm) {
        codigoContagem.set(result.locArm, (codigoContagem.get(result.locArm) ?? 0) + 1);
      }
    }
  }

  let codigoAgencia: string | null = null;
  let maxCount = 0;
  codigoContagem.forEach((count, code) => {
    if (count > maxCount) { maxCount = count; codigoAgencia = code; }
  });

  return { bolsas, dataEmissao, codigoAgencia };
}
