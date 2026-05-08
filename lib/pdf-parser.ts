import * as pdfParseModule from "pdf-parse";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> =
  (pdfParseModule as any).default ?? pdfParseModule;
import { classificarUrgencia, normalizarFatorRh, type BolsaParsed } from "./sheets-parser";

// Matches "DD/MM/YYYY HH:MM" — anchor used to split each data line
const DATE_TIME_RE = /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;

const ABO_VALIDOS = new Set(["A", "B", "O", "AB"]);

function parsearLinhaPDF(linha: string): BolsaParsed | null {
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

  return {
    instituicao,
    doacao,
    componente,
    validade,
    abo,
    fatorRh: normalizarFatorRh(fatorRhRaw),
    urgencia: classificarUrgencia(validade),
  };
}

export async function parsearPDF(buffer: Buffer): Promise<BolsaParsed[]> {
  const data = await pdfParse(buffer);
  const linhas = data.text.split("\n").map((l) => l.trim()).filter(Boolean);

  const bolsas: BolsaParsed[] = [];
  for (const linha of linhas) {
    const bolsa = parsearLinhaPDF(linha);
    if (bolsa) bolsas.push(bolsa);
  }
  return bolsas;
}
