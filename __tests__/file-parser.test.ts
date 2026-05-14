import * as XLSX from "xlsx";
import { parsearArquivo } from "../lib/file-parser";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@sentry/nextjs", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock("pdf-parse", () => jest.fn());

const mockSentry = jest.requireMock("@sentry/nextjs") as {
  addBreadcrumb: jest.Mock;
  captureException: jest.Mock;
  captureMessage: jest.Mock;
};
const mockPdfParse = jest.requireMock("pdf-parse") as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function bufferXLS(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Reproduz o layout exato do arquivo 08052026HMT.XLS: células mescladas fazem
 * o cabeçalho "Validade" ficar na coluna 6, mas os dados de data ficam na
 * coluna 5. Sem a calibração, o parser leria coluna 6 (vazia) e descartaria
 * todas as linhas silenciosamente.
 */
function bufferXLSFormatoReal(dataRows: unknown[][]): Buffer {
  const rows: unknown[][] = [
    ["", "PULSA BH", "", "", "", "", "", "", "", "Emissão: 08/05/2026 09:15", "", "", ""],
    ["", "RUA JUIZ DE FORA, 941 - BARRO PRETO - BH", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "TEL.: (31)3335-6600", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "Bolsas vencidas e próximas ao vencimento", "", "", "", "", "", "", "", "", "", ""],
    ["Legenda :", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Bolsas Vencidas", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Bolsas próximas ao vencimento", "", "", "", "", "", "", "", "", "", "", "", ""],
    // Cabeçalho: "Validade" em col 6, col 5 vazia (simulando merged cells)
    ["Instituição", "Doação", "", "Comp.", "Seq.", "", "Validade", "", "Loc. Arm.", "", "", "ABO", "Fator Rh"],
    // Dados: data em col 5 (não col 6), igual ao arquivo real
    ...dataRows,
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet");
  return XLSX.write(wb, { type: "buffer", bookType: "xls" });
}

// Formato real do PDF conforme o arquivo 08052026HMT.PDF
const PDF_VALIDO = `
Emissão: 08/05/2026 09:15
Bolsas vencidas e próximas ao vencimento
PULSA BH

Legenda :
Bolsas Vencidas
Bolsas próximas ao vencimento

Instituição Doação Comp. Seq. Validade Loc. Arm. ABO Fator Rh
B3087 26010111 CH 1 12/05/2026 23:59 AT - HMT B P
B3087 26014090 CP 1 09/05/2026 23:59 AT - HMT O P
B3087 26015279 CP 1 10/05/2026 23:59 AT - HMT O N
B3087 26015323 CP 1 09/05/2026 23:59 AT - HMT A P
VITA 26010119 CH 1 11/05/2026 23:59 AT - HMT B P
Total => 5
`;

const PDF_SEM_DADOS = `
Emissão: 08/05/2026 09:15
Bolsas vencidas e próximas ao vencimento
PULSA BH
Sem bolsas no período.
Total => 0
`;

// ── Testes: Excel (.xlsx) ────────────────────────────────────────────────────

describe("parsearArquivo — Excel (.xlsx)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("extrai bolsas com dados completos", async () => {
    const rows = [
      ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "Loc.", "ABO", "Fator Rh"],
      ["B3087", "26010111", "CH", 1, "12/05/2026", "AT-HMT", "B", "P"],
      ["B3087", "26014090", "CP", 1, "09/05/2026", "AT-HMT", "O", "P"],
      ["VITA",  "26010119", "CH", 1, "11/05/2026", "AT-HMT", "B", "P"],
    ];
    const { bolsas } = await parsearArquivo(bufferXLS(rows), "teste.xlsx");

    expect(bolsas).toHaveLength(3);
    expect(bolsas[0]).toMatchObject({
      instituicao: "B3087",
      doacao: "26010111",
      componente: "CH",
      abo: "B",
      fatorRh: "P",
    });
    expect(bolsas[0].validade).toBe("2026-05-12");
  });

  test("normaliza Fator Rh: '+' → 'P' e '-' → 'N'", async () => {
    const rows = [
      ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "ABO", "Fator Rh"],
      ["B3087", "100", "CH", 1, "15/06/2026", "A", "+"],
      ["B3087", "101", "CP", 1, "15/06/2026", "O", "-"],
    ];
    const { bolsas } = await parsearArquivo(bufferXLS(rows), "teste.xlsx");
    expect(bolsas[0].fatorRh).toBe("P");
    expect(bolsas[1].fatorRh).toBe("N");
  });

  test("classifica urgência corretamente", async () => {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    const em4Dias = new Date(hoje);
    em4Dias.setDate(hoje.getDate() + 4);
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    const rows = [
      ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "ABO", "Fator Rh"],
      ["X", "1", "CH", 1, fmt(ontem),  "A", "P"],
      ["X", "2", "CP", 1, fmt(hoje),   "B", "P"],
      ["X", "3", "CH", 1, fmt(amanha), "O", "P"],
      ["X", "4", "CP", 1, fmt(em4Dias),"A", "P"],
    ];
    const { bolsas } = await parsearArquivo(bufferXLS(rows), "urgencia.xlsx");

    expect(bolsas[0].urgencia).toBe("vencido");
    expect(bolsas[1].urgencia).toBe("hoje");
    expect(bolsas[2].urgencia).toBe("amanha");
    expect(bolsas[3].urgencia).toBe("ok");
  });

  test("arquivo sem cabeçalho retorna array vazio", async () => {
    const rows = [["sem", "cabecalho", "valido"]];
    const { bolsas } = await parsearArquivo(bufferXLS(rows), "vazio.xlsx");
    expect(bolsas).toHaveLength(0);
  });

  test("linhas sem data de validade são ignoradas", async () => {
    const rows = [
      ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "ABO", "Fator Rh"],
      ["B3087", "100", "CH", 1, "", "B", "P"],          // sem validade
      ["B3087", "101", "CP", 1, "20/06/2026", "O", "N"], // válida
    ];
    const { bolsas } = await parsearArquivo(bufferXLS(rows), "parcial.xlsx");
    expect(bolsas).toHaveLength(1);
  });

  test("adiciona breadcrumbs no Sentry", async () => {
    const rows = [
      ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "ABO", "Fator Rh"],
      ["B3087", "100", "CH", 1, "20/06/2026", "B", "P"],
    ];
    await parsearArquivo(bufferXLS(rows), "sentry.xlsx");
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: "file-parser", level: "info" })
    );
  });
});

// ── Testes: PDF (.pdf) ───────────────────────────────────────────────────────

describe("parsearArquivo — PDF (.pdf)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("extrai bolsas do PDF no formato real", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_VALIDO });

    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "08052026HMT.PDF");

    expect(bolsas).toHaveLength(5);
    expect(bolsas[0]).toMatchObject({
      instituicao: "B3087",
      doacao: "26010111",
      componente: "CH",
      abo: "B",
      fatorRh: "P",
      validade: "2026-05-12",
    });
    expect(bolsas[2].fatorRh).toBe("N"); // O N → negativo
    expect(bolsas[3].abo).toBe("A");
    expect(bolsas[4].instituicao).toBe("VITA");
  });

  test("linhas sem data-hora são ignoradas", async () => {
    mockPdfParse.mockResolvedValue({
      text: `
Bolsas próximas ao vencimento
Isso é um cabeçalho
B3087 26010111 CH 1 12/05/2026 23:59 AT - HMT B P
Total => 1
      `,
    });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "teste.pdf");
    expect(bolsas).toHaveLength(1);
  });

  test("PDF sem bolsas retorna array vazio", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_SEM_DADOS });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "vazio.pdf");
    expect(bolsas).toHaveLength(0);
  });

  test("PDF com ABO inválido na linha é ignorado", async () => {
    mockPdfParse.mockResolvedValue({
      text: `
B3087 26010111 CH 1 12/05/2026 23:59 AT - HMT X P
B3087 26014090 CP 1 09/05/2026 23:59 AT - HMT O N
      `,
    });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "abo.pdf");
    expect(bolsas).toHaveLength(1);
    expect(bolsas[0].abo).toBe("O");
  });
});

// ── Testes: Excel formato real (células mescladas / offset de coluna) ─────────

describe("parsearArquivo — Excel formato real (offset de coluna)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("extrai bolsas quando data está na coluna 5 e cabeçalho 'Validade' na coluna 6", async () => {
    const dataRows = [
      ["B3087", 26010111, "", "CH", 1, "12/05/2026 23:59", "", "AT - HMT", "", "", "", "B", "P"],
      ["B3087", 26014090, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "O", "P"],
      ["VITA",  26010119, "", "CH", 1, "11/05/2026 23:59", "", "AT - HMT", "", "", "", "B", "P"],
    ];
    const { bolsas } = await parsearArquivo(bufferXLSFormatoReal(dataRows), "08052026HMT.XLS");

    expect(bolsas).toHaveLength(3);
    expect(bolsas[0]).toMatchObject({
      instituicao: "B3087",
      doacao: "26010111",
      componente: "CH",
      abo: "B",
      fatorRh: "P",
      validade: "2026-05-12",
    });
    expect(bolsas[2].instituicao).toBe("VITA");
  });

  test("normaliza Fator Rh no formato real: N permanece N", async () => {
    const dataRows = [
      ["B3087", 26015279, "", "CP", 1, "10/05/2026 23:59", "", "AT - HMT", "", "", "", "O", "N"],
    ];
    const { bolsas } = await parsearArquivo(bufferXLSFormatoReal(dataRows), "08052026HMT.XLS");
    expect(bolsas[0].fatorRh).toBe("N");
  });

  test("linha 'Total =>' no final é ignorada (não vira bolsa)", async () => {
    const dataRows = [
      ["B3087", 26010111, "", "CH", 1, "12/05/2026 23:59", "", "AT - HMT", "", "", "", "B", "P"],
      ["", "", "", "", "", "", "", "", "", "", "Total =>", 1, ""],
    ];
    const { bolsas } = await parsearArquivo(bufferXLSFormatoReal(dataRows), "08052026HMT.XLS");
    expect(bolsas).toHaveLength(1);
  });

  test("replica exatamente as 12 bolsas do arquivo 08052026HMT.XLS", async () => {
    const dataRows = [
      ["B3087", 26010111, "", "CH", 1, "12/05/2026 23:59", "", "AT - HMT", "", "", "", "B",  "P"],
      ["B3087", 26014090, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "O",  "P"],
      ["B3087", 26014331, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "O",  "P"],
      ["B3087", 26015125, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "O",  "P"],
      ["B3087", 26015261, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "B",  "P"],
      ["B3087", 26015279, "", "CP", 1, "10/05/2026 23:59", "", "AT - HMT", "", "", "", "O",  "N"],
      ["B3087", 26015323, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "A",  "P"],
      ["B3087", 26015329, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "B",  "P"],
      ["B3087", 26015330, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "O",  "P"],
      ["B3087", 26015332, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "O",  "P"],
      ["B3087", 26015335, "", "CP", 1, "09/05/2026 23:59", "", "AT - HMT", "", "", "", "B",  "P"],
      ["VITA",  26010119, "", "CH", 1, "11/05/2026 23:59", "", "AT - HMT", "", "", "", "B",  "P"],
      ["", "", "", "", "", "", "", "", "", "", "Total =>", 12, ""],
    ];
    const { bolsas } = await parsearArquivo(bufferXLSFormatoReal(dataRows), "08052026HMT.XLS");
    expect(bolsas).toHaveLength(12);

    const aboValores = bolsas.map((b) => b.abo);
    expect(aboValores).toEqual(["B", "O", "O", "O", "B", "O", "A", "B", "O", "O", "B", "B"]);

    const negativos = bolsas.filter((b) => b.fatorRh === "N");
    expect(negativos).toHaveLength(1);
    expect(negativos[0].doacao).toBe("26015279");
  });
});

// ── Testes: Sentry — captureMessage para arquivo sem bolsas ──────────────────

describe("parsearArquivo — Sentry captureMessage para arquivo vazio", () => {
  beforeEach(() => jest.clearAllMocks());

  test("dispara captureMessage quando XLS não retorna bolsas", async () => {
    const rows = [["sem", "cabecalho", "valido"]];
    await parsearArquivo(bufferXLS(rows), "vazio.xlsx");
    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("vazio.xlsx"),
      expect.objectContaining({ level: "warning" })
    );
  });

  test("dispara captureMessage quando PDF não retorna bolsas", async () => {
    mockPdfParse.mockResolvedValue({ text: "sem dados válidos" });
    await parsearArquivo(Buffer.from("dummy"), "vazio.pdf");
    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("vazio.pdf"),
      expect.objectContaining({ level: "warning" })
    );
  });

  test("NÃO dispara captureMessage quando bolsas são extraídas com sucesso", async () => {
    const rows = [
      ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "ABO", "Fator Rh"],
      ["B3087", "100", "CH", 1, "20/06/2026", "B", "P"],
    ];
    await parsearArquivo(bufferXLS(rows), "normal.xlsx");
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
  });
});

// ── Testes: PDF formato compacto (doação+comp mesclados, ABO+fator mesclados) ─
// Reproduz o padrão dos arquivos HSR, HUB, HSCU, HSG, HS, HVC, HMDBC, HL.
// Características:
//   - Antes da data: "[DOACAO+COMP]  [SEQ]" (sem separação entre doação e comp)
//   - Após a data: "AT - [CODIGO+ABO+FATOR+INST?]" (tudo mesclado)

const PDF_COMPACTO_PADRAO_A = `
Emissão: 14/05/2026 09:38
Bolsas vencidas e próximas ao vencimento
PULSA BH
RUA JUIZ DE FORA, 941 - BARRO PRETO - BH
TEL.: (31)3335-6600
Loc. Arm.ABOFator RhDoaçãoComp.Seq.ValidadeInstituição
Bolsas Vencidas
Bolsas próximas ao vencimento
Legenda :
26013876CP  116/05/2026 23:59AT - HSRAPVITA
26013881CP  116/05/2026 23:59AT - HSRAPVITA
26013883CP  116/05/2026 23:59AT - HSRAPVITA
26013890CP  116/05/2026 23:59AT - HSRAPVITA
26013892CP  116/05/2026 23:59AT - HSRAPVITA
26013895CP  116/05/2026 23:59AT - HSRAPVITA
26013897CP  116/05/2026 23:59AT - HSRANVITA
Total =>
7
001
`;

// Padrão B: instituição duplicada antes da doação (HL), mesclagem "HLOP" sem inst.
const PDF_COMPACTO_PADRAO_B = `
Emissão: 14/05/2026 08:35
Bolsas vencidas e próximas ao vencimento
PULSA BH
Loc. Arm.ABOFator RhDoaçãoComp.Seq.ValidadeInstituição
Bolsas Vencidas
Bolsas próximas ao vencimento
Legenda :
B3013B3013   26704764IPPA  113/05/2026 23:59AT - HLOP
26704846IPPA  114/05/2026 23:59AT - HLOPB3013
26704875IPPA  115/05/2026 23:59AT - HLOPB3013
Total =>
3
001
`;

// Padrão com ABO "AB" mesclado: "HSCUABP" = código HSCU + ABO AB + Fator P
const PDF_COMPACTO_ABO_AB = `
Emissão: 14/05/2026 09:38
PULSA BH
Loc. Arm.ABOFator RhDoaçãoComp.Seq.ValidadeInstituição
26010525CH  118/05/2026 23:59AT - HSCUABP
Total =>
1
001
`;

describe("parsearArquivo — PDF formato compacto (doação+comp+ABO+fator mesclados)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("Padrão A: extrai 7 bolsas com doação+comp mesclados e ABO+fator mesclados no AT", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_COMPACTO_PADRAO_A });
    const { bolsas, dataEmissao, codigoAgencia } = await parsearArquivo(Buffer.from("dummy"), "14052026HSR.PDF");

    expect(bolsas).toHaveLength(7);
    expect(bolsas[0]).toMatchObject({
      doacao: "26013876",
      componente: "CP",
      abo: "A",
      fatorRh: "P",
      validade: "2026-05-16",
    });
    // Última linha tem fator N (negativo)
    expect(bolsas[6].fatorRh).toBe("N");
    expect(bolsas[6].abo).toBe("A");
    // Código da agência extraído do locArm
    expect(codigoAgencia).toBe("HSR");
    expect(dataEmissao).toBe("2026-05-14");
  });

  test("Padrão B: extrai 3 bolsas com instituição prefixada e inst no sufixo AT", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_COMPACTO_PADRAO_B });
    const { bolsas, codigoAgencia } = await parsearArquivo(Buffer.from("dummy"), "14052026HL.PDF");

    expect(bolsas).toHaveLength(3);
    expect(bolsas[0]).toMatchObject({ doacao: "26704764", componente: "IPPA", abo: "O", fatorRh: "P" });
    expect(bolsas[1]).toMatchObject({ doacao: "26704846", componente: "IPPA", abo: "O", fatorRh: "P" });
    expect(codigoAgencia).toBe("HL");
  });

  test("Padrão ABO=AB: extrai corretamente quando código AT termina em AB+fator", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_COMPACTO_ABO_AB });
    const { bolsas, codigoAgencia } = await parsearArquivo(Buffer.from("dummy"), "14052026HSCU.PDF");

    expect(bolsas).toHaveLength(1);
    expect(bolsas[0]).toMatchObject({
      doacao: "26010525",
      componente: "CH",
      abo: "AB",
      fatorRh: "P",
    });
    expect(codigoAgencia).toBe("HSCU");
  });

  test("não interfere com formato padrão de linha (INST DOACAO COMP DATA AT ABO FATOR)", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_VALIDO });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "08052026HMT.PDF");
    expect(bolsas).toHaveLength(5);
    expect(bolsas[0].instituicao).toBe("B3087");
    expect(bolsas[0].doacao).toBe("26010111");
  });
});

// ── Testes: formato inválido ──────────────────────────────────────────────────

describe("parsearArquivo — formato inválido", () => {
  beforeEach(() => jest.clearAllMocks());

  test("extensão .txt lança erro e chama Sentry.captureException", async () => {
    await expect(
      parsearArquivo(Buffer.from("conteudo"), "arquivo.txt")
    ).rejects.toThrow("Formato não suportado");

    expect(mockSentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ "arquivo.ext": "txt" }) })
    );
  });

  test("sem extensão lança erro", async () => {
    await expect(
      parsearArquivo(Buffer.from("x"), "semextensao")
    ).rejects.toThrow("Formato não suportado");
  });

  test("erro interno no PDF é capturado pelo Sentry e relançado", async () => {
    mockPdfParse.mockRejectedValue(new Error("PDF corrompido"));

    await expect(
      parsearArquivo(Buffer.from("bad"), "corrompido.pdf")
    ).rejects.toThrow("PDF corrompido");

    expect(mockSentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "PDF corrompido" }),
      expect.objectContaining({ tags: expect.objectContaining({ "arquivo.nome": "corrompido.pdf" }) })
    );
  });
});
