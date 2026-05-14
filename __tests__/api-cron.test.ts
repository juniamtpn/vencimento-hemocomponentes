/**
 * Tests for GET /api/cron/processar-vencimentos
 *
 * Covers: auth guard (401), success (200), internal error (500).
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

jest.mock("@/lib/processar-vencimentos", () => ({
  processarVencimentos: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
  },
}));

jest.mock("@/lib/db/schema", () => ({
  execucoesCron: {},
}));

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

import { GET } from "@/app/api/cron/processar-vencimentos/route";
import { processarVencimentos } from "@/lib/processar-vencimentos";

const mockProcessar = processarVencimentos as jest.MockedFunction<typeof processarVencimentos>;

const SECRET = "cron-test-secret-xyz";

beforeAll(() => {
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  jest.clearAllMocks();
});

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new Request("http://localhost/api/cron/processar-vencimentos", { headers });
}

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("autenticação", () => {
  it("retorna 401 quando Authorization está ausente", async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("retorna 401 quando token é inválido", async () => {
    const res = await GET(makeRequest("Bearer wrong-token") as never);
    expect(res.status).toBe(401);
  });

  it("retorna 401 quando Authorization não começa com 'Bearer '", async () => {
    const res = await GET(makeRequest(SECRET) as never);
    expect(res.status).toBe(401);
  });

  it("aceita requisição com token correto", async () => {
    mockProcessar.mockResolvedValueOnce({ date: "2026-05-14", resultados: [] });
    const res = await GET(makeRequest(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(200);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("sucesso", () => {
  it("retorna ok:true com dados do processamento", async () => {
    mockProcessar.mockResolvedValueOnce({
      date: "2026-05-14",
      resultados: [
        { agencia: "Hemo BH", codigo: "HEMOBH", status: "processado", bolsas: 12 },
        { agencia: "Hemo Uberaba", codigo: "HEMOUB", status: "sem_arquivo" },
      ],
    });

    const res = await GET(makeRequest(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.date).toBe("2026-05-14");
    expect(body.resultados).toHaveLength(2);
  });

  it("chama processarVencimentos com trigger 'cron'", async () => {
    mockProcessar.mockResolvedValueOnce({ date: "2026-05-14", resultados: [] });
    await GET(makeRequest(`Bearer ${SECRET}`) as never);
    expect(mockProcessar).toHaveBeenCalledWith("cron");
  });
});

// ── Error path ────────────────────────────────────────────────────────────────

describe("erro no processamento", () => {
  it("retorna 500 com mensagem de erro quando processarVencimentos lança", async () => {
    mockProcessar.mockRejectedValueOnce(new Error("Google Drive unreachable"));

    const res = await GET(makeRequest(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe("Erro no processamento");
    expect(body.detail).toContain("Google Drive unreachable");
  });

  it("registra execução com status erro_fatal quando lança", async () => {
    const { db } = jest.requireMock("@/lib/db") as { db: { insert: jest.Mock } };
    mockProcessar.mockRejectedValueOnce(new Error("fatal"));

    await GET(makeRequest(`Bearer ${SECRET}`) as never);

    expect(db.insert).toHaveBeenCalled();
  });
});
