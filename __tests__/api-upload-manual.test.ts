/**
 * Tests for POST /api/envios/upload-manual
 *
 * Covers:
 * - 401: sem sessão
 * - 400: falta arquivo ou agenciaId
 * - 404: agência não cadastrada
 * - 422: formato inválido, data desatualizada, agência incorreta, sem bolsas
 * - 200: envio bem-sucedido
 * - Regressão: fusão de ABO em AT entries (AT - HSEO → ABO=O, código=HSE)
 */

jest.mock("next/server", () => ({
  NextRequest: Request,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/file-parser", () => ({
  parsearArquivo: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      agencias: { findFirst: jest.fn() },
      registrosDiarios: { findMany: jest.fn() },
    },
    insert: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/db/schema", () => ({
  registrosDiarios: { agenciaId: "rd.agenciaId", id: "rd.id" },
  bolsas: { registroId: "b.registroId" },
  agencias: { id: "a.id" },
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

jest.mock("nanoid", () => ({ nanoid: () => "test-upload-id" }));

// ── Imports ───────────────────────────────────────────────────────────────────

import { POST } from "@/app/api/envios/upload-manual/route";
import { getServerSession } from "next-auth";
import { parsearArquivo } from "@/lib/file-parser";
import { db } from "@/lib/db";

const mockGetSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockParsear = parsearArquivo as jest.MockedFunction<typeof parsearArquivo>;
const mockDb = db as jest.Mocked<typeof db>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = "2026-05-14";

const AGENCY = { id: "ag-1", nome: "Hemo BH", codigo: "HEMOBH" };

const VALID_BOLSA = {
  instituicao: "HSE",
  doacao: "D001",
  componente: "CH",
  validade: "2026-05-14",
  abo: "O",
  fatorRh: "+",
  urgencia: "hoje" as const,
};

function makeSession(email = "user@hemo.mg.gov.br") {
  return { user: { email }, expires: "9999-01-01" } as never;
}

function makeFormData(options: { hasFile?: boolean; hasAgenciaId?: boolean; filename?: string } = {}) {
  const {
    hasFile = true,
    hasAgenciaId = true,
    filename = "14052026HEMOBH.xlsx",
  } = options;

  const fd = new FormData();
  if (hasFile) {
    const file = new File([Buffer.from("binary-content")], filename, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fd.append("arquivo", file);
  }
  if (hasAgenciaId) {
    fd.append("agenciaId", "ag-1");
  }
  return fd;
}

function makeRequest(formData: FormData) {
  return new Request("http://localhost/api/envios/upload-manual", {
    method: "POST",
    body: formData,
  });
}

function setupDbDefaults() {
  (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCY);
  (mockDb.query.registrosDiarios.findMany as jest.Mock).mockResolvedValue([]);
  (mockDb.insert as jest.Mock).mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
  (mockDb.delete as jest.Mock).mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-05-14T13:00:00Z")); // 10:00 BRT = 2026-05-14
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  setupDbDefaults();
  mockGetSession.mockResolvedValue(makeSession());
  mockParsear.mockResolvedValue({
    bolsas: [VALID_BOLSA],
    dataEmissao: TODAY,
    codigoAgencia: "HEMOBH",
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("401 - não autorizado", () => {
  it("retorna 401 quando não há sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("autorizado");
  });
});

// ── Campos obrigatórios ───────────────────────────────────────────────────────

describe("400 - campos obrigatórios", () => {
  it("retorna 400 quando arquivo está ausente", async () => {
    const res = await POST(makeRequest(makeFormData({ hasFile: false })) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("obrigatórios");
  });

  it("retorna 400 quando agenciaId está ausente", async () => {
    const res = await POST(makeRequest(makeFormData({ hasAgenciaId: false })) as never);
    expect(res.status).toBe(400);
  });
});

// ── Agência não encontrada ────────────────────────────────────────────────────

describe("404 - agência não cadastrada", () => {
  it("retorna 404 quando agenciaId não existe no banco", async () => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Agência");
  });
});

// ── Validações de arquivo ─────────────────────────────────────────────────────

describe("422 - formato inválido", () => {
  it("retorna 422 quando parsearArquivo lança erro de formato", async () => {
    mockParsear.mockRejectedValueOnce(new Error("Formato não suportado: .docx"));
    const res = await POST(makeRequest(makeFormData({ filename: "relatorio.docx" })) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.hint).toContain(".xlsx");
  });

  it("retorna 422 quando parsearArquivo lança erro genérico", async () => {
    mockParsear.mockRejectedValueOnce(new Error("Corrupted file"));
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.hint).toContain("corrompido");
  });
});

describe("422 - data desatualizada", () => {
  it("retorna 422 quando dataEmissao é diferente de hoje", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [VALID_BOLSA],
      dataEmissao: "2026-05-13", // yesterday
      codigoAgencia: "HEMOBH",
    });
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("dia atual");
    expect(body.hint).toContain("13/05/2026");
  });

  it("aceita arquivo quando dataEmissao é null (parser não extraiu data)", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [VALID_BOLSA],
      dataEmissao: null,
      codigoAgencia: "HEMOBH",
    });
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);
  });
});

describe("422 - agência incorreta", () => {
  it("retorna 422 quando codigoAgencia no arquivo não bate com a agência selecionada", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [VALID_BOLSA],
      dataEmissao: TODAY,
      codigoAgencia: "OUTRA01",
    });
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("não corresponde");
    expect(body.hint).toContain("OUTRA01");
    expect(body.hint).toContain("HEMOBH");
  });

  it("aceita arquivo quando codigoAgencia é null (parser não extraiu código)", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [VALID_BOLSA],
      dataEmissao: TODAY,
      codigoAgencia: null,
    });
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);
  });

  it("validação de código é case-insensitive", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [VALID_BOLSA],
      dataEmissao: TODAY,
      codigoAgencia: "hemobh", // lowercase
    });
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);
  });
});

describe("422 - sem bolsas", () => {
  it("retorna 422 quando parser não encontra bolsas válidas", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [],
      dataEmissao: TODAY,
      codigoAgencia: "HEMOBH",
    });
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("Nenhuma bolsa");
  });
});

// ── Sucesso ───────────────────────────────────────────────────────────────────

describe("200 - upload bem-sucedido", () => {
  it("retorna ok:true com totalBolsas", async () => {
    mockParsear.mockResolvedValueOnce({
      bolsas: [VALID_BOLSA, { ...VALID_BOLSA, doacao: "D002", urgencia: "normal" as const }],
      dataEmissao: TODAY,
      codigoAgencia: "HEMOBH",
    });

    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalBolsas).toBe(2);
  });

  it("substitui registros existentes no banco antes de inserir os novos", async () => {
    (mockDb.query.registrosDiarios.findMany as jest.Mock).mockResolvedValue([
      { id: "old-reg-1" },
      { id: "old-reg-2" },
    ]);

    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);

    // delete should have been called for old records
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("insere registroDiario com tipoEnvio=manual e enviadoPor do usuário da sessão", async () => {
    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);

    const insertMock = mockDb.insert as jest.Mock;
    expect(insertMock).toHaveBeenCalled();
  });
});

// ── Regressão: merge de ABO em AT entries ────────────────────────────────────

describe("regressão: parser PDF com AT-HSEO → ABO=O, código=HSE", () => {
  it("aceita bolsa com ABO extraído de AT entry fundido", async () => {
    const bolsaComAtMerge = {
      instituicao: "HSE",
      doacao: "D999",
      componente: "CH",
      validade: "2026-05-14",
      abo: "O", // merged from "AT - HSEO"
      fatorRh: "+",
      urgencia: "hoje" as const,
    };

    mockParsear.mockResolvedValueOnce({
      bolsas: [bolsaComAtMerge],
      dataEmissao: TODAY,
      codigoAgencia: "HEMOBH",
    });

    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalBolsas).toBe(1);
  });
});

// ── Erro de banco ─────────────────────────────────────────────────────────────

describe("500 - erro de banco de dados", () => {
  it("retorna 500 quando insert lança erro", async () => {
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockRejectedValue(new Error("DB write failed")),
    });

    const res = await POST(makeRequest(makeFormData()) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("salvar");
  });
});
