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
    const parts = cleaned.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (c.length === 4) {
        return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      }
      if (a.length === 4) {
        return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
      }
    }
    const parsed = parseISO(cleaned);
    if (isValid(parsed)) return cleaned;
  }
  return null;
}

function classificarUrgencia(validadeISO: string): Urgencia {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = parseISO(validadeISO);
  validade.setHours(0, 0, 0, 0);

  const diffMs = validade.getTime() - hoje.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return "vencido";
  if (diffDias === 0) return "hoje";
  if (diffDias === 1) return "amanha";
  if (diffDias <= 3) return "3dias";
  return "ok";
}

export function parsearPlanilha(buffer: Buffer): BolsaParsed[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const col0 = String(row[0] ?? "").trim();
    if (col0.toLowerCase().includes("institui")) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) return [];

  const bolsas: BolsaParsed[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const instituicao = String(row[0] ?? "").trim();
    if (!instituicao) continue;

    const doacao = String(row[1] ?? "").trim();
    const componente = String(row[3] ?? "").trim();
    const validadeRaw = row[5];
    const abo = String(row[11] ?? "").trim();
    const fatorRh = String(row[12] ?? "").trim();

    const validade = excelDateToISO(validadeRaw);
    if (!validade) continue;

    bolsas.push({
      instituicao,
      doacao,
      componente,
      validade,
      abo,
      fatorRh,
      urgencia: classificarUrgencia(validade),
    });
  }

  return bolsas;
}
