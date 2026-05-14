/**
 * Tests for admin agency-management routes and access-request:
 *   POST   /api/admin/agencias
 *   PATCH  /api/admin/agencias/[id]
 *   DELETE /api/admin/agencias/[id]
 *   POST   /api/access-request
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

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      agencias: { findFirst: jest.fn() },
      usuarios: { findFirst: jest.fn() },
      registrosDiarios: { findFirst: jest.fn() },
      usuarioAgencias: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/db/schema", () => ({
  agencias: { id: "a.id", codigo: "a.codigo" },
  usuarios: { id: "u.id", email: "u.email", status: "u.status" },
  usuarioAgencias: { agenciaId: "ua.agenciaId", usuarioId: "ua.usuarioId" },
  registrosDiarios: { agenciaId: "rd.agenciaId" },
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

jest.mock("nanoid", () => ({ nanoid: () => "generated-id" }));

jest.mock("@/lib/teams-webhook", () => ({
  notificarSolicitacaoAcesso: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { POST as criarAgencia } from "@/app/api/admin/agencias/route";
import {
  PATCH as editarAgencia,
  DELETE as excluirAgencia,
} from "@/app/api/admin/agencias/[id]/route";
import { POST as solicitarAcesso } from "@/app/api/access-request/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { notificarSolicitacaoAcesso } from "@/lib/teams-webhook";

const mockGetSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockDb = db as jest.Mocked<typeof db>;
const mockNotificarSolicitacao = notificarSolicitacaoAcesso as jest.MockedFunction<typeof notificarSolicitacaoAcesso>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGENCIA = { id: "ag-1", nome: "Hemo BH", codigo: "HEMOBH" };
const PARAMS = { params: { id: "ag-1" } };

function makeAdminSession() {
  return { user: { email: "admin@hemo.mg.gov.br", perfil: "admin" }, expires: "9999" } as never;
}

function makeSession(perfil = "lideranca") {
  return { user: { email: "lider@hemo.mg.gov.br", perfil }, expires: "9999" } as never;
}

function makeUpdateChain() {
  const setFn = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
  return { set: setFn };
}

function makeDeleteChain() {
  return { where: jest.fn().mockResolvedValue(undefined) };
}

function makeInsertChain() {
  return { values: jest.fn().mockResolvedValue(undefined) };
}

function jsonRequest(body: unknown, url = "http://localhost/api/admin/agencias") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(makeAdminSession());
  (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(null);
  (mockDb.query.registrosDiarios.findFirst as jest.Mock).mockResolvedValue(null);
  (mockDb.insert as jest.Mock).mockReturnValue(makeInsertChain());
  (mockDb.update as jest.Mock).mockReturnValue(makeUpdateChain());
  (mockDb.delete as jest.Mock).mockReturnValue(makeDeleteChain());
});

// ── POST /api/admin/agencias ──────────────────────────────────────────────────

describe("POST /api/admin/agencias", () => {
  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await criarAgencia(jsonRequest({ codigo: "HEMO01" }) as never);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para não-admin", async () => {
    mockGetSession.mockResolvedValue(makeSession("lideranca"));
    const res = await criarAgencia(jsonRequest({ codigo: "HEMO01" }) as never);
    expect(res.status).toBe(403);
  });

  it("retorna 400 para código ausente", async () => {
    const res = await criarAgencia(jsonRequest({ nome: "Hemo BH" }) as never);
    expect(res.status).toBe(400);
  });

  it("retorna 409 quando código já existe", async () => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
    const res = await criarAgencia(jsonRequest({ codigo: "HEMOBH" }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("HEMOBH");
  });

  it("retorna 201 e cria agência", async () => {
    const res = await criarAgencia(jsonRequest({ codigo: "HEMO01", nome: "Hemo 01" }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.agencia.codigo).toBe("HEMO01");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("normaliza código para maiúsculas", async () => {
    const res = await criarAgencia(jsonRequest({ codigo: "hemo01" }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.agencia.codigo).toBe("HEMO01");
  });

  it("usa código como nome quando nome não fornecido", async () => {
    const res = await criarAgencia(jsonRequest({ codigo: "VITA" }) as never);
    const body = await res.json();
    expect(body.agencia.nome).toBe("VITA");
  });
});

// ── PATCH /api/admin/agencias/[id] ────────────────────────────────────────────

describe("PATCH /api/admin/agencias/[id]", () => {
  beforeEach(() => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
  });

  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await editarAgencia(jsonRequest({ codigo: "HEMOBH" }, "http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 400 para dados inválidos", async () => {
    const res = await editarAgencia(jsonRequest({ codigo: "" }, "http://localhost") as never, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando agência não existe", async () => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await editarAgencia(jsonRequest({ codigo: "HEMOBH" }, "http://localhost") as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 409 quando código conflita com outra agência", async () => {
    // First call: find agencia by id → returns AGENCIA
    // Second call: find by codigo → returns a DIFFERENT agencia (conflito)
    (mockDb.query.agencias.findFirst as jest.Mock)
      .mockResolvedValueOnce(AGENCIA)
      .mockResolvedValueOnce({ id: "ag-2", codigo: "VITA", nome: "Vita" });

    const res = await editarAgencia(jsonRequest({ codigo: "VITA" }, "http://localhost") as never, PARAMS);
    expect(res.status).toBe(409);
  });

  it("retorna 200 e atualiza agência", async () => {
    // Same agencia returned for both queries (no conflict — same id)
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
    const res = await editarAgencia(
      jsonRequest({ codigo: "HEMOBH", nome: "Hemo BH Novo" }, "http://localhost") as never,
      PARAMS
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agencia.codigo).toBe("HEMOBH");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("redefine a relação de responsável quando responsavelId fornecido", async () => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
    const res = await editarAgencia(
      jsonRequest({ codigo: "HEMOBH", responsavelId: "user-1" }, "http://localhost") as never,
      PARAMS
    );
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("remove responsável quando responsavelId é null", async () => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
    await editarAgencia(
      jsonRequest({ codigo: "HEMOBH", responsavelId: null }, "http://localhost") as never,
      PARAMS
    );
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/admin/agencias/[id] ───────────────────────────────────────────

describe("DELETE /api/admin/agencias/[id]", () => {
  beforeEach(() => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
  });

  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await excluirAgencia(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando agência não existe", async () => {
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await excluirAgencia(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 409 quando agência possui registros de envio", async () => {
    (mockDb.query.registrosDiarios.findFirst as jest.Mock).mockResolvedValue({ id: "rd-1" });
    const res = await excluirAgencia(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("registros");
  });

  it("retorna 200 e remove agência e suas relações", async () => {
    const res = await excluirAgencia(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });
});

// ── POST /api/access-request ──────────────────────────────────────────────────

describe("POST /api/access-request", () => {
  const VALID_BODY = {
    nome: "João Souza",
    agencia: "Hemo BH",
    justificativa: "Preciso acompanhar os vencimentos da minha unidade.",
  };

  beforeEach(() => {
    mockGetSession.mockResolvedValue(makeSession("viewer"));
    (mockDb.query.agencias.findFirst as jest.Mock).mockResolvedValue(AGENCIA);
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it("retorna 401 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await solicitarAcesso(jsonRequest(VALID_BODY) as never);
    expect(res.status).toBe(401);
  });

  it("retorna 400 para nome muito curto", async () => {
    const res = await solicitarAcesso(jsonRequest({ ...VALID_BODY, nome: "Jo" }) as never);
    expect(res.status).toBe(400);
  });

  it("retorna 400 para justificativa muito curta", async () => {
    const res = await solicitarAcesso(jsonRequest({ ...VALID_BODY, justificativa: "curta" }) as never);
    expect(res.status).toBe(400);
  });

  it("retorna 400 para agência ausente", async () => {
    const res = await solicitarAcesso(jsonRequest({ nome: "João", justificativa: "motivo longo aqui" }) as never);
    expect(res.status).toBe(400);
  });

  it("retorna 200 e cria novo usuário para solicitante novo", async () => {
    const res = await solicitarAcesso(jsonRequest(VALID_BODY) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockNotificarSolicitacao).toHaveBeenCalledWith(
      expect.objectContaining({ nome: VALID_BODY.nome })
    );
  });

  it("retorna 400 quando usuário já está aprovado", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue({
      id: "u-1",
      status: "aprovado",
      updatedAt: Math.floor(Date.now() / 1000) - 999,
    });
    const res = await solicitarAcesso(jsonRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("aprovado");
  });

  it("retorna 429 quando usuário reenviou dentro do cooldown de 5 min", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue({
      id: "u-1",
      status: "pendente",
      updatedAt: Math.floor(Date.now() / 1000) - 60, // 1 min atrás
    });
    const res = await solicitarAcesso(jsonRequest(VALID_BODY) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("minuto");
  });

  it("retorna 200 e atualiza usuário rejeitado após cooldown expirar", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue({
      id: "u-1",
      status: "rejeitado",
      updatedAt: Math.floor(Date.now() / 1000) - 600, // 10 min atrás
    });
    const res = await solicitarAcesso(jsonRequest(VALID_BODY) as never);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockNotificarSolicitacao).toHaveBeenCalled();
  });
});
