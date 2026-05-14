/**
 * Tests for POST /api/processar (manual trigger)
 *
 * Covers:
 * - Auth: no session → 403, viewer → 403, admin → 200, liderança → 200
 * - Auth: CRON_SECRET bearer → 200 (bypasses session)
 * - Internal error → 500
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

import { POST } from "@/app/api/processar/route";
import { getServerSession } from "next-auth";
import { processarVencimentos } from "@/lib/processar-vencimentos";

const mockGetSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockProcessar = processarVencimentos as jest.MockedFunction<typeof processarVencimentos>;

const SECRET = "cron-test-secret-xyz";

beforeAll(() => {
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  jest.clearAllMocks();
});

function makeRequest(options: { authHeader?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.authHeader) headers["authorization"] = options.authHeader;
  return new Request("http://localhost/api/processar", { method: "POST", headers });
}

function mockSession(perfil: string | null) {
  if (perfil === null) {
    mockGetSession.mockResolvedValue(null);
  } else {
    mockGetSession.mockResolvedValue({
      user: { email: "user@hemo.mg.gov.br", perfil },
      expires: "9999-01-01",
    } as never);
  }
}

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("autenticação por sessão", () => {
  it("retorna 403 quando não há sessão", async () => {
    mockSession(null);
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para perfil 'viewer'", async () => {
    mockSession("viewer");
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para perfil desconhecido", async () => {
    mockSession("guest");
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(403);
  });

  it("aceita perfil 'admin'", async () => {
    mockSession("admin");
    mockProcessar.mockResolvedValueOnce({ date: "2026-05-14", resultados: [] });
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);
  });

  it("aceita perfil 'lideranca'", async () => {
    mockSession("lideranca");
    mockProcessar.mockResolvedValueOnce({ date: "2026-05-14", resultados: [] });
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);
  });
});

describe("autenticação por CRON_SECRET", () => {
  it("aceita Bearer CRON_SECRET sem sessão", async () => {
    // getServerSession should NOT be called when CRON_SECRET is valid
    mockProcessar.mockResolvedValueOnce({ date: "2026-05-14", resultados: [] });
    const res = await POST(makeRequest({ authHeader: `Bearer ${SECRET}` }) as never);
    expect(res.status).toBe(200);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("chama processarVencimentos com trigger 'manual'", async () => {
    mockSession("admin");
    mockProcessar.mockResolvedValueOnce({ date: "2026-05-14", resultados: [] });
    await POST(makeRequest() as never);
    expect(mockProcessar).toHaveBeenCalledWith("manual");
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("sucesso", () => {
  it("retorna ok:true com resultados do processamento", async () => {
    mockSession("admin");
    mockProcessar.mockResolvedValueOnce({
      date: "2026-05-14",
      resultados: [
        { agencia: "Hemo BH", codigo: "HEMOBH", status: "processado", bolsas: 5 },
      ],
    });

    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.resultados[0].status).toBe("processado");
  });
});

// ── Error path ────────────────────────────────────────────────────────────────

describe("erro no processamento", () => {
  it("retorna 500 quando processarVencimentos lança", async () => {
    mockSession("admin");
    mockProcessar.mockRejectedValueOnce(new Error("DB connection refused"));

    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe("Erro no processamento");
    expect(body.detail).toContain("DB connection refused");
  });
});
