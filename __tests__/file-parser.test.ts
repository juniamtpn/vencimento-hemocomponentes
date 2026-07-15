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

/**
 * O parser de PDF lê posições, não texto corrido: instala um `pagerender` que
 * devolve os fragmentos com X/Y, e reagrupa em linhas por Y. Este helper monta
 * esse retorno a partir de linhas de células, atribuindo X crescente por coluna
 * e Y decrescente por linha — como o pdf.js entrega numa página real.
 *
 * pdf-parse concatena o retorno de cada página com "\n\n" (inclusive no início).
 */
function pdfPosicional(linhas: string[][]): string {
  const itens = linhas.flatMap((celulas, iLinha) =>
    celulas.map((s, iCol) => ({ s, x: 50 + iCol * 70, y: 700 - iLinha * 15 }))
  );
  return "\n\n" + JSON.stringify(itens);
}

// Layout compacto real (15072026HMT.PDF e similares).
const PDF_VALIDO = pdfPosicional([
  ["PULSA BH", "Emissão: 08/05/2026 09:15"],
  ["Bolsas vencidas e próximas ao vencimento"],
  ["Legenda :"],
  ["Bolsas Vencidas"],
  ["Bolsas próximas ao vencimento"],
  ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "Loc. Arm.", "ABO", "Fator Rh"],
  ["B3087", "26010111", "CH", "1", "12/05/2026 23:59", "AT - HMT", "B", "P"],
  ["B3087", "26014090", "CP", "1", "09/05/2026 23:59", "AT - HMT", "O", "P"],
  ["B3087", "26015279", "CP", "1", "10/05/2026 23:59", "AT - HMT", "O", "N"],
  ["B3087", "26015323", "CP", "1", "09/05/2026 23:59", "AT - HMT", "A", "P"],
  ["VITA", "26010119", "CH", "1", "11/05/2026 23:59", "AT - HMT", "B", "P"],
  ["Total =>", "5"],
]);

const PDF_SEM_DADOS = pdfPosicional([
  ["PULSA BH", "Emissão: 08/05/2026 09:15"],
  ["Bolsas vencidas e próximas ao vencimento"],
  ["Sem bolsas no período."],
  ["Total =>", "0"],
]);

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
      text: pdfPosicional([
        ["Bolsas próximas ao vencimento"],
        ["Isso é um cabeçalho"],
        ["B3087", "26010111", "CH", "1", "12/05/2026 23:59", "AT - HMT", "B", "P"],
        ["Total =>", "1"],
      ]),
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
      text: pdfPosicional([
        ["B3087", "26010111", "CH", "1", "12/05/2026 23:59", "AT - HMT", "X", "P"],
        ["B3087", "26014090", "CP", "1", "09/05/2026 23:59", "AT - HMT", "O", "N"],
      ]),
    });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "abo.pdf");
    expect(bolsas).toHaveLength(1);
    expect(bolsas[0].abo).toBe("O");
  });

  test("expõe o total declarado pelo relatório", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_VALIDO });
    const { bolsas, totalDeclarado } = await parsearArquivo(Buffer.from("dummy"), "08052026HMT.PDF");
    expect(totalDeclarado).toBe(5);
    expect(bolsas).toHaveLength(5);
  });

  test("PDF sem camada de texto (escaneado) é sinalizado, não confundido com vazio", async () => {
    // 15072026HDMU.PDF: o relatório foi digitalizado como imagem — o pdf.js não
    // devolve nenhum fragmento de texto. Precisa ser distinguível de um relatório
    // legítimo sem bolsas: as ações são diferentes (reexportar vs. nada a fazer).
    mockPdfParse.mockResolvedValue({ text: "\n\n" });
    const { bolsas, dataEmissao, totalDeclarado, semCamadaTexto } =
      await parsearArquivo(Buffer.from("dummy"), "15072026HDMU.PDF");

    expect(semCamadaTexto).toBe(true);
    expect(bolsas).toHaveLength(0);
    expect(dataEmissao).toBeNull();
    expect(totalDeclarado).toBeNull();
  });

  test("relatório legítimo sem bolsas NÃO é marcado como sem camada de texto", async () => {
    mockPdfParse.mockResolvedValue({ text: PDF_SEM_DADOS });
    const { bolsas, semCamadaTexto, totalDeclarado } =
      await parsearArquivo(Buffer.from("dummy"), "vazio.pdf");

    expect(semCamadaTexto).toBe(false);
    expect(bolsas).toHaveLength(0);
    expect(totalDeclarado).toBe(0);
  });

  test("total declarado divergente é exposto para a rotina barrar a publicação", async () => {
    // O relatório afirma 3 bolsas mas só 2 linhas são legíveis: a rotina precisa
    // enxergar a divergência em vez de publicar um estoque incompleto.
    mockPdfParse.mockResolvedValue({
      text: pdfPosicional([
        ["PULSA BH", "Emissão: 15/07/2026 08:59"],
        ["B3087", "26010111", "CH", "1", "12/05/2026 23:59", "AT - HMT", "B", "P"],
        ["B3087", "26014090", "CP", "1", "09/05/2026 23:59", "AT - HMT", "O", "P"],
        ["Total =>", "3"],
      ]),
    });
    const { bolsas, totalDeclarado } = await parsearArquivo(Buffer.from("dummy"), "x.pdf");

    expect(bolsas).toHaveLength(2);
    expect(totalDeclarado).toBe(3);
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

// ── Testes: layouts reais dos relatórios do HEMOTE ───────────────────────────
// Reproduzem, célula a célula, as tabelas conferidas contra a imagem renderizada
// dos PDFs de 15/07/2026. Os dois layouts em uso diferem no conjunto de colunas,
// mas o parser localiza cada campo pelo conteúdo da célula, não por índice fixo.

describe("parsearArquivo — PDF layout compacto", () => {
  beforeEach(() => jest.clearAllMocks());

  // 15072026HLC.PDF — conferido contra a imagem: as duas primeiras bolsas vencem
  // no dia da emissão e pertencem a instituições distintas (B3087 / B3097).
  test("HLC: 4 bolsas, cada doação com sua data e instituição", async () => {
    mockPdfParse.mockResolvedValue({
      text: pdfPosicional([
        ["PULSA BH", "Emissão: 15/07/2026 08:59"],
        ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "Loc. Arm.", "ABO", "Fator Rh"],
        ["B3087", "26022799", "CP", "1", "15/07/2026 23:59", "AT - HLC", "B", "P"],
        ["B3097", "26018853", "CP", "1", "15/07/2026 23:59", "AT - HLC", "O", "P"],
        ["VITA", "26020334", "CP", "1", "16/07/2026 23:59", "AT - HLC", "B", "P"],
        ["VITA", "26020430", "CP", "1", "16/07/2026 23:59", "AT - HLC", "O", "P"],
        ["Total =>", "4"],
      ]),
    });
    const { bolsas, codigoAgencia, dataEmissao, totalDeclarado } =
      await parsearArquivo(Buffer.from("dummy"), "15072026HLC.PDF");

    expect(codigoAgencia).toBe("HLC");
    expect(dataEmissao).toBe("2026-07-15");
    expect(totalDeclarado).toBe(4);
    expect(bolsas).toHaveLength(4);
    expect(bolsas[0]).toMatchObject({
      instituicao: "B3087", doacao: "26022799", componente: "CP", validade: "2026-07-15", abo: "B", fatorRh: "P",
    });
    expect(bolsas[1]).toMatchObject({ instituicao: "B3097", doacao: "26018853", abo: "O" });
    expect(bolsas[3]).toMatchObject({ instituicao: "VITA", doacao: "26020430", validade: "2026-07-16" });
  });

  // 15072026HSL.PDF — bolsas vencidas (vermelhas) e a vencer no mesmo relatório.
  test("HSL: mantém as bolsas vencidas e a instituição de cada linha", async () => {
    mockPdfParse.mockResolvedValue({
      text: pdfPosicional([
        ["PULSA BH", "Emissão: 15/07/2026 08:37"],
        ["Instituição", "Doação", "Comp.", "Seq.", "Validade", "Loc. Arm.", "ABO", "Fator Rh"],
        ["B3087", "26019098", "CH", "1", "22/07/2026 23:59", "AT - HSL", "AB", "P"],
        ["VITA", "26002411", "CH", "1", "05/03/2026 23:59", "AT - HSL", "O", "N"],
        ["VITA", "26002420", "CH", "1", "05/03/2026 23:59", "AT - HSL", "O", "N"],
        ["VITA", "26016874", "CH", "1", "22/07/2026 23:59", "AT - HSL", "A", "P"],
        ["Total =>", "4"],
      ]),
    });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "15072026HSL.PDF");

    expect(bolsas).toHaveLength(4);
    expect(bolsas[0]).toMatchObject({ abo: "AB", fatorRh: "P", instituicao: "B3087" });
    expect(bolsas.filter((b) => b.urgencia === "vencido")).toHaveLength(2);
    expect(bolsas[1]).toMatchObject({ doacao: "26002411", validade: "2026-03-05", abo: "O", fatorRh: "N" });
  });

  // Texto colorido é desenhado duas vezes na mesma coordenada; sem deduplicar, a
  // instituição das linhas vermelhas viraria uma célula extra e deslocaria a linha.
  test("célula duplicada no mesmo ponto (overprint) não desloca a linha", async () => {
    const itens = [
      { s: "Emissão: 15/07/2026 08:37", x: 460, y: 800 },
      { s: "VITA", x: 51.7, y: 669.8 },
      { s: "VITA", x: 51.7, y: 669.8 }, // overprint exato
      { s: "26002411", x: 112.6, y: 669.8 },
      { s: "CH", x: 189.4, y: 669.8 },
      { s: "1", x: 223.8, y: 669.8 },
      { s: "05/03/2026 23:59", x: 261.6, y: 669.8 },
      { s: "AT - HSL", x: 349.4, y: 669.8 },
      { s: "O", x: 518.7, y: 669.8 },
      { s: "N", x: 559.5, y: 669.8 },
    ];
    mockPdfParse.mockResolvedValue({ text: "\n\n" + JSON.stringify(itens) });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "15072026HSL.PDF");

    expect(bolsas).toHaveLength(1);
    expect(bolsas[0]).toMatchObject({ instituicao: "VITA", doacao: "26002411", componente: "CH", abo: "O", fatorRh: "N" });
  });

  // Fragmentos da mesma linha visual não têm Y idêntico; agrupar por igualdade
  // exata quebraria a linha em pedaços e nenhuma bolsa seria extraída.
  test("agrupa por Y com tolerância (fragmentos da mesma linha visual)", async () => {
    const itens = [
      { s: "VITA", x: 50, y: 669.8 },
      { s: "26016874", x: 112, y: 670.4 }, // 0.6pt de diferença
      { s: "CH", x: 189, y: 669.2 },
      { s: "1", x: 223, y: 669.9 },
      { s: "22/07/2026 23:59", x: 261, y: 670.1 },
      { s: "AT - HSL", x: 349, y: 669.8 },
      { s: "A", x: 519, y: 669.5 },
      { s: "P", x: 559, y: 670.0 },
    ];
    mockPdfParse.mockResolvedValue({ text: "\n\n" + JSON.stringify(itens) });
    const { bolsas } = await parsearArquivo(Buffer.from("dummy"), "x.pdf");

    expect(bolsas).toHaveLength(1);
    expect(bolsas[0]).toMatchObject({ doacao: "26016874", abo: "A", fatorRh: "P" });
  });
});

describe("parsearArquivo — PDF layout Analítico", () => {
  beforeEach(() => jest.clearAllMocks());

  // 15072026HUB.PDF — colunas extras (Lavado/Refrac./Deleuc./Irrad.) entre a
  // validade e a localização, e "Total : N" em vez de "Total => N".
  test("HUB: 3 bolsas, ignorando as colunas SIM/NÃO intermediárias", async () => {
    mockPdfParse.mockResolvedValue({
      text: pdfPosicional([
        ["PULSA BH"],
        ["Estoque de Componentes - Analítico", "Emissão: 15/07/2026 08:47"],
        ["Inst. Colet.", "Doação", "Comp.", "Seq.", "Validade", "Lavado", "Refrac.", "Deleuc.", "Irrad.", "Loc. Armazenamento", "Gr. ABO", "Fator RH", "CDE"],
        ["VITA", "26016557", "CH", "1", "20/07/2026 23:59", "NÃO", "NÃO", "NÃO", "NÃO", "AT - HUB", "B", "N"],
        ["VITA", "26017726", "CH", "3", "17/07/2026 23:59", "NÃO", "SIM", "SIM", "SIM", "AT - HUB", "O", "P"],
        ["VITA", "26002400", "PFC", "1", "16/07/2026 00:22", "NÃO", "SIM", "NÃO", "NÃO", "AT - HUB", "A", "P"],
        ["Total : 3"],
      ]),
    });
    const { bolsas, codigoAgencia, totalDeclarado } =
      await parsearArquivo(Buffer.from("dummy"), "15072026HUB.PDF");

    expect(codigoAgencia).toBe("HUB");
    expect(totalDeclarado).toBe(3);
    expect(bolsas).toHaveLength(3);
    // O "N" de "NÃO" não pode ser confundido com Fator Rh negativo
    expect(bolsas[1]).toMatchObject({ doacao: "26017726", componente: "CH", abo: "O", fatorRh: "P" });
    expect(bolsas[2]).toMatchObject({ doacao: "26002400", componente: "PFC", validade: "2026-07-16", abo: "A" });
  });

  test("ABO 'AB' na coluna Gr. ABO é preservado", async () => {
    mockPdfParse.mockResolvedValue({
      text: pdfPosicional([
        ["Estoque de Componentes - Analítico", "Emissão: 14/05/2026 12:26"],
        ["Inst. Colet.", "Doação", "Comp.", "Seq.", "Validade", "Lavado", "Loc. Armazenamento", "Gr. ABO", "Fator RH"],
        ["VITA", "26010489", "CH", "1", "16/05/2026 23:59", "NÃO", "AT - HIO", "AB", "P"],
        ["Total : 1"],
      ]),
    });
    const { bolsas, codigoAgencia } = await parsearArquivo(Buffer.from("dummy"), "14052026HIO.PDF");

    expect(codigoAgencia).toBe("HIO");
    expect(bolsas[0]).toMatchObject({ abo: "AB", fatorRh: "P", componente: "CH" });
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
