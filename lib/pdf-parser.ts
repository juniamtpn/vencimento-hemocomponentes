import * as pdfParseModule from "pdf-parse";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> =
  (pdfParseModule as any).default ?? pdfParseModule;
import { classificarUrgencia, normalizarFatorRh, type BolsaParsed, type ParseResult } from "./sheets-parser";

const DATE_TIME_RE = /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;
const ABO_VALIDOS = new Set(["A", "B", "O", "AB"]);
// Doação (7-9 dígitos) colada ao componente (letras maiúsculas), sem espaço.
// Ex: "26013876CP", "26704764IPPA", "25012884CRI"
const MERGED_DOACAO_COMP_RE = /^(\d{7,9})([A-Z][A-Z0-9]{1,4})$/;

// Separa o código AT de ABO + Fator Rh (e opcionalmente instituição) mesclados.
// Ex: "HSRAPVITA" → { code:"HSR", abo:"A", fator:"P", inst:"VITA" }
//     "HSCUABP"  → { code:"HSCU", abo:"AB", fator:"P", inst:null }
//     "HLOP"     → { code:"HL",   abo:"O",  fator:"P", inst:null }
function parsearAtMerge(s: string): { code: string; abo: string; fator: string; inst: string | null } | null {
  const m = s.match(/^([A-Z0-9]+?)(AB|[ABO])([PN])([A-Z][A-Z0-9]*)?$/);
  if (!m) return null;
  return { code: m[1], abo: m[2], fator: m[3], inst: m[4] ?? null };
}

// ── Parser modo linha (um registro completo por linha) ────────────────────────

function parsearLinhaPDF(linha: string): { bolsa: BolsaParsed; locArm: string | null } | null {
  const match = linha.match(DATE_TIME_RE);
  if (!match) return null;

  const inicioData = linha.indexOf(match[0]);
  const antesData = linha.substring(0, inicioData).trim().split(/\s+/).filter(Boolean);
  const depoisData = linha.substring(inicioData + match[0].length).trim();

  const [d, m, y] = match[1].split("/");
  const validade = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

  // ── Formato compacto (Padrão A e B): doação+comp mesclados antes da data ────
  // Padrão A: ["26013876CP", "1"]  (len 2) – sem instituição antes
  // Padrão B: ["B3013B3013", "26704764IPPA", "1"]  (len 3) – inst antes do merged
  //
  // Sinal: antesData[last-1] é doação+comp mesclados OU antesData[0] é mesclado.
  // Após a data: "AT - HMDBCOPVITA" – AT code, ABO e Fator Rh mesclados.
  const lastBeforeSeq = antesData.length >= 2 ? antesData[antesData.length - 2] : (antesData[0] ?? "");
  const isMergedCompact = MERGED_DOACAO_COMP_RE.test(lastBeforeSeq);

  if (isMergedCompact || antesData.length < 3) {
    // lastBeforeSeq é "26013876CP" ou similar
    const dcMatch = lastBeforeSeq.match(MERGED_DOACAO_COMP_RE);
    if (!dcMatch) return null;
    const [, doacao, componente] = dcMatch;

    // Instituição: token antes do merged (Padrão B), se existir e não for doação
    const instituicao = antesData.length >= 3 ? antesData[antesData.length - 3] : "?";

    const atm = depoisData.match(/^AT\s*-\s*([A-Z0-9]+)/i);
    if (!atm) return null;
    const parsed = parsearAtMerge(atm[1].toUpperCase());
    if (!parsed || !ABO_VALIDOS.has(parsed.abo)) return null;

    return {
      bolsa: {
        instituicao: parsed.inst ?? instituicao,
        doacao,
        componente,
        validade,
        abo: parsed.abo,
        fatorRh: normalizarFatorRh(parsed.fator),
        urgencia: classificarUrgencia(validade),
      },
      locArm: parsed.code,
    };
  }

  // ── Formato padrão: [INST] [DOAÇÃO] [COMP] DATA [AT - COD] [ABO] [FATOR] ───
  const tokensDepois = depoisData.split(/\s+/).filter(Boolean);
  if (tokensDepois.length < 2) return null;

  const [instituicao, doacao, componente] = antesData;
  const fatorRhRaw = tokensDepois[tokensDepois.length - 1];
  const abo = tokensDepois[tokensDepois.length - 2].toUpperCase();

  if (!ABO_VALIDOS.has(abo)) return null;

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

// ── Parser modo colunar (pdf-parse extrai coluna a coluna) ────────────────────
// Ocorre quando o PDF é gerado com colunas independentes.
// Cada grupo de N linhas consecutivas representa os N valores de uma coluna.

function parsearPDFColunar(linhas: string[], N: number, dataEmissao: string | null): ParseResult {
  if (N <= 0) return { bolsas: [], dataEmissao, codigoAgencia: null };

  const firstDateIdx = linhas.findIndex(l => /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(l));
  let lastAtIdx = -1;
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (/^AT\s*-\s*[A-Z0-9]+$/i.test(linhas[i])) { lastAtIdx = i; break; }
  }

  const datas: string[] = [];
  const doacoes: string[] = [];
  const standAloneAbos: string[] = [];
  const fatores: string[] = [];
  const atEntries: { code: string; mergedAbo: string | null }[] = [];
  const componentes: string[] = [];
  const instituicoes: string[] = [];

  for (let idx = 0; idx < linhas.length; idx++) {
    const l = linhas[idx];

    // Data DD/MM/YYYY HH:MM exata
    const dm = l.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}$/);
    if (dm) {
      datas.push(`${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`);
      continue;
    }

    // Seq colado na data: "106/06/2026 23:59" → seq "1" + data "06/06/2026 23:59"
    // Ocorre quando o nº de sequência (1-2 dígitos) é extraído na mesma linha que a data.
    const mergedSeqDate = l.match(/^\d{1,2}(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}$/);
    if (mergedSeqDate) {
      const [, d, m, y] = mergedSeqDate;
      datas.push(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      continue;
    }

    // Número de doação (7-9 dígitos)
    if (/^\d{7,9}$/.test(l)) { doacoes.push(l); continue; }

    // Números curtos (seq) — ignorar
    if (/^\d{1,2}$/.test(l)) continue;

    // Linha "AT - CÓDIGO" (pode ter ABO colado no final, ex: "AT - HSEO")
    const atm = l.match(/^AT\s*-\s*([A-Z0-9]+)$/i);
    if (atm) {
      let code = atm[1].toUpperCase();
      let mergedAbo: string | null = null;
      if (code.length > 2 && code.endsWith("AB")) {
        mergedAbo = "AB"; code = code.slice(0, -2);
      } else if (code.length > 1 && /^[ABO]$/.test(code.slice(-1))) {
        mergedAbo = code.slice(-1); code = code.slice(0, -1);
      }
      if (code.length >= 2) atEntries.push({ code, mergedAbo });
      continue;
    }

    // Fator Rh isolado
    if (/^[PN]$/.test(l)) { fatores.push(l); continue; }

    // ABO colado no fator Rh: "OP" → ABO "O" + fator "P"; "ABN" → ABO "AB" + fator "N"
    // Ocorre quando as duas colunas são extraídas juntas pelo pdf-parse.
    const mergedAboFator = l.match(/^(AB|[ABO])([PN])$/);
    if (mergedAboFator) {
      standAloneAbos.push(mergedAboFator[1].toUpperCase());
      fatores.push(mergedAboFator[2]);
      continue;
    }

    // ABO isolado
    if (ABO_VALIDOS.has(l.toUpperCase())) { standAloneAbos.push(l.toUpperCase()); continue; }

    // Componente colado no seq: "CHBV  1" → componente "CHBV" + seq ignorado
    // Ocorre antes da primeira data quando o código de componente e o nº seq mesclam.
    const mergedCompSeq = l.match(/^([A-Z][A-Z0-9]{1,})\s+\d{1,3}$/);
    if (mergedCompSeq && firstDateIdx >= 0 && idx < firstDateIdx) {
      componentes.push(mergedCompSeq[1]);
      continue;
    }

    // Tokens somente maiúsculas — diferenciar por posição
    if (/^[A-Z][A-Z0-9]*$/.test(l) && l.length >= 2) {
      if (firstDateIdx >= 0 && idx < firstDateIdx) {
        // Antes das datas → código de componente (CH, CP, PFC…)
        componentes.push(l);
      } else if (lastAtIdx >= 0 && idx > lastAtIdx) {
        // Após o último AT → candidato a instituição (VITA, B3087…)
        const up = l.toUpperCase();
        if (!/^(LEGENDA|BOLSAS|TOTAL|PULSA|RUA|TEL|BARRO|COMP|LOC|SEQ|FAT|INST)/.test(up)) {
          instituicoes.push(l);
        }
      }
    }
  }

  // Precisa de exatamente N entradas AT, N datas e N fatores
  if (atEntries.length !== N || datas.length !== N || fatores.length !== N) {
    return { bolsas: [], dataEmissao, codigoAgencia: null };
  }

  // Resolve ABO: usa o merged do AT quando disponível, senão consome o próximo standalone
  let saIdx = 0;
  const resolvedAbos = atEntries.map(at => at.mergedAbo ?? standAloneAbos[saIdx++] ?? null);

  // codigoAgencia = código AT mais frequente
  const codeCount = new Map<string, number>();
  for (const at of atEntries) codeCount.set(at.code, (codeCount.get(at.code) ?? 0) + 1);
  let codigoAgencia: string | null = null, maxC = 0;
  codeCount.forEach((c, k) => { if (c > maxC) { maxC = c; codigoAgencia = k; } });

  // Instituição mais frequente entre os candidatos
  const instCount = new Map<string, number>();
  for (const i of instituicoes) instCount.set(i, (instCount.get(i) ?? 0) + 1);
  let bestInst = "?", maxI = 0;
  instCount.forEach((c, k) => { if (c > maxI) { maxI = c; bestInst = k; } });

  const bolsas: BolsaParsed[] = [];
  for (let i = 0; i < N; i++) {
    const abo = resolvedAbos[i];
    if (!abo || !ABO_VALIDOS.has(abo)) continue;
    bolsas.push({
      instituicao: bestInst,
      doacao: doacoes[i] ?? "?",
      componente: componentes[i] ?? "?",
      validade: datas[i],
      abo,
      fatorRh: normalizarFatorRh(fatores[i]),
      urgencia: classificarUrgencia(datas[i]),
    });
  }

  return { bolsas, dataEmissao, codigoAgencia };
}

// ── Parser modo Analítico ("Estoque de Componentes - Analítico") ─────────────
// Cada registro ocupa 3 linhas:
//   N:   {ABO}{INST}{FATOR}{COMP}   {SEQ}{DD/MM/YYYY HH:MM}NÃO...
//   N+1: AT - {CODIGO}
//   N+2: {7-9 dígitos de doação}
// Exceção (HBH): ABO aparece em linha isolada antes do primeiro AT.

function parseAnalyticPrefix(prefix: string): { abo: string; inst: string; fatorRh: string; componente: string } | null {
  let abo = "";
  let rest = prefix;
  if (rest.startsWith("AB")) { abo = "AB"; rest = rest.slice(2); }
  else if (/^[ABO]/.test(rest)) { abo = rest[0]; rest = rest.slice(1); }
  else return null;

  // Scan direita→esquerda: primeiro [PN] seguido de 2-5 letras maiúsculas é FATOR+COMP
  for (let j = rest.length - 1; j >= 1; j--) {
    if (!/[PN]/.test(rest[j])) continue;
    const comp = rest.slice(j + 1);
    const inst = rest.slice(0, j);
    if (comp.length >= 2 && comp.length <= 5 && /^[A-Z]+$/.test(comp) && inst.length >= 2) {
      return { abo, inst, fatorRh: rest[j], componente: comp };
    }
  }
  return null;
}

function parsearAnalitico(linhas: string[], dataEmissao: string | null): ParseResult {
  // ABO isolado antes do primeiro AT (edge case HBH)
  let globalAbo: string | null = null;
  for (const linha of linhas) {
    if (/^AT\s*-\s/i.test(linha)) break;
    const up = linha.trim().toUpperCase();
    if (ABO_VALIDOS.has(up)) { globalAbo = up; break; }
  }

  let codigoAgencia: string | null = null;
  const bolsas: BolsaParsed[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const atMatch = linhas[i].match(/^AT\s*-\s*([A-Z0-9]+)$/i);
    if (!atMatch) continue;

    const atCode = atMatch[1].toUpperCase();
    if (!codigoAgencia) codigoAgencia = atCode;

    if (i === 0) continue;
    const dataLine = linhas[i - 1];
    const dateMatch = dataLine.match(DATE_TIME_RE);
    if (!dateMatch) continue;

    const [d, m, y] = dateMatch[1].split("/");
    const validade = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

    const prefixRaw = dataLine.slice(0, dataLine.indexOf(dateMatch[0])).replace(/\s*\d+$/, "").trim();

    let parsed = parseAnalyticPrefix(prefixRaw);
    if (!parsed && globalAbo) parsed = parseAnalyticPrefix(globalAbo + prefixRaw);
    if (!parsed) continue;

    let doacao = "?";
    for (let j = i + 1; j <= Math.min(i + 4, linhas.length - 1); j++) {
      if (/^\d{7,9}$/.test(linhas[j])) { doacao = linhas[j]; break; }
    }

    bolsas.push({
      instituicao: parsed.inst,
      doacao,
      componente: parsed.componente,
      validade,
      abo: parsed.abo,
      fatorRh: normalizarFatorRh(parsed.fatorRh),
      urgencia: classificarUrgencia(validade),
    });
  }

  return { bolsas, dataEmissao, codigoAgencia };
}

// ── Ponto de entrada ──────────────────────────────────────────────────────────

export async function parsearPDF(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  const linhas = data.text.split("\n").map((l) => l.trim()).filter(Boolean);

  const emissaoMatch = data.text.match(/emiss[aã]o[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  let dataEmissao: string | null = null;
  if (emissaoMatch) {
    const [, d, m, y] = emissaoMatch;
    dataEmissao = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Formato Analítico: 3 linhas por registro, detectado pelo cabeçalho
  if (data.text.includes("Estoque de Componentes - Anal")) {
    return parsearAnalitico(linhas, dataEmissao);
  }

  // Tenta modo linha primeiro
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

  if (bolsas.length > 0) {
    let codigoAgencia: string | null = null;
    let maxCount = 0;
    codigoContagem.forEach((count, code) => {
      if (count > maxCount) { maxCount = count; codigoAgencia = code; }
    });
    return { bolsas, dataEmissao, codigoAgencia };
  }

  // Fallback: modo colunar (pdf-parse extrai por coluna)
  const totalMatch = data.text.match(/Total\s*=>\s*(\d+)/i);
  const N = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  return parsearPDFColunar(linhas, N, dataEmissao);
}
