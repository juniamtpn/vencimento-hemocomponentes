import * as XLSX from "xlsx";
import { parseISO, isValid } from "date-fns";
import type { Urgencia } from "@/types";

export interface BolsaParsed {
  instituicao: string;
  doacao: string;
  componente: string;
  validade: string;
  abo: string;
  fatorRh: string;
  urgencia: Urgencia;
}

function excelDateToISO(value: unknown): string | null {
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const y = date.y;
    const m = String(date.m).padStart(2, "0");
    const d = String(date.d).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "string") {
    const cleaned = value.trim();
    // DD/MM/YYYY or DD/MM/YYYY HH:MM
    const matchBR = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchBR) {
      const [, d, m, y] = matchBR;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // YYYY-MM-DD
    const matchISO = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchISO) return cleaned.substring(0, 10);
    // DD-MM-YYYY or DD.MM.YYYY
    const matchAlt = cleaned.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})/);
    if (matchAlt) {
      const [, d, m, y] = matchAlt;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const parsed = parseISO(cleaned);
    if (isValid(parsed)) return cleaned.substring(0, 10);
  }
  return null;
}

function classificarUrgencia(validadeISO: string): Urgencia {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = parseISO(validadeISO);
  validade.setHours(0, 0, 0, 0);

  const diffDias = Math.round(
    (validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDias < 0) return "vencido";
  if (diffDias === 0) return "hoje";
  if (diffDias === 1) return "amanha";
  if (diffDias <= 3) return "3dias";
  return "ok";
}

// Fator Rh: normalize P/N/+/- to canonical form
function normalizarFatorRh(valor: string): string {
  const v = String(valor ?? "").trim().toUpperCase();
  if (v === "P" || v === "+" || v === "POS" || v.startsWith("PO")) return "P";
  if (v === "N" || v === "-" || v === "NEG" || v.startsWith("NE")) return "N";
  return v || "-";
}

export function parsearPlanilha(buffer: Buffer): BolsaParsed[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  // Find header row: row where col[0] contains "institui"
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const col0 = String(rows[i]?.[0] ?? "").trim().toLowerCase();
    if (col0.includes("institui")) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) return [];

  // Detect column indices from header
  const header = (rows[headerRow] as string[]).map((h) =>
    String(h ?? "").trim().toLowerCase()
  );

  function findCol(...keywords: string[]): number {
    for (const kw of keywords) {
      const idx = header.findIndex((h) => h.includes(kw));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const colInst = findCol("institui") !== -1 ? findCol("institui") : 0;
  const colDoa = findCol("doa") !== -1 ? findCol("doa") : 1;
  const colComp = findCol("comp") !== -1 ? findCol("comp") : 3;
  const colVal = findCol("valid") !== -1 ? findCol("valid") : 5;
  const colABO = findCol("abo") !== -1 ? findCol("abo") : 11;
  const colRh = findCol("rh", "fator") !== -1 ? findCol("rh", "fator") : 12;

  const bolsas: BolsaParsed[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const instituicao = String(row[colInst] ?? "").trim();
    if (!instituicao) continue;

    const doacao = String(row[colDoa] ?? "").trim();
    const componente = String(row[colComp] ?? "").trim();
    const validadeRaw = row[colVal];
    const abo = String(row[colABO] ?? "").trim();
    const fatorRhRaw = String(row[colRh] ?? "").trim();

    const validade = excelDateToISO(validadeRaw);
    if (!validade) continue;

    bolsas.push({
      instituicao,
      doacao,
      componente,
      validade,
      abo,
      fatorRh: normalizarFatorRh(fatorRhRaw),
      urgencia: classificarUrgencia(validade),
    });
  }

  return bolsas;
}
