/**
 * Tests for admin user-management routes:
 *   POST /api/admin/aprovar/[id]
 *   POST /api/admin/rejeitar/[id]
 *   POST /api/admin/reativar/[id]
 *   PATCH /api/admin/usuarios/[id]
 *   DELETE /api/admin/usuarios/[id]
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
      usuarios: { findFirst: jest.fn() },
    },
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/db/schema", () => ({
  usuarios: { id: "u.id", status: "u.status" },
  usuarioAgencias: { usuarioId: "ua.usuarioId" },
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

jest.mock("@/lib/teams-webhook", () => ({
  notificarAcessoAprovado: jest.fn().mockResolvedValue(undefined),
  notificarAcessoRejeitado: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { POST as aprovar } from "@/app/api/admin/aprovar/[id]/route";
import { POST as rejeitar } from "@/app/api/admin/rejeitar/[id]/route";
import { POST as reativar } from "@/app/api/admin/reativar/[id]/route";
import { PATCH as editarUsuario, DELETE as excluirUsuario } from "@/app/api/admin/usuarios/[id]/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { notificarAcessoAprovado, notificarAcessoRejeitado } from "@/lib/teams-webhook";

const mockGetSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockDb = db as jest.Mocked<typeof db>;
const mockNotificarAprovado = notificarAcessoAprovado as jest.MockedFunction<typeof notificarAcessoAprovado>;
const mockNotificarRejeitado = notificarAcessoRejeitado as jest.MockedFunction<typeof notificarAcessoRejeitado>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const PARAMS = { params: { id: "user-1" } };

const USUARIO = {
  id: "user-1",
  nome: "Maria Silva",
  email: "maria@hemo.mg.gov.br",
  perfil: "viewer",
  status: "pendente",
};

function makeAdminSession() {
  return { user: { email: "admin@hemo.mg.gov.br", perfil: "admin" }, expires: "9999" } as never;
}

function makeSession(perfil = "lideranca") {
  return { user: { email: "user@hemo.mg.gov.br", perfil }, expires: "9999" } as never;
}

function makeUpdateChain() {
  const setFn = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
  return { set: setFn };
}

function makeDeleteChain() {
  return { where: jest.fn().mockResolvedValue(undefined) };
}

function jsonRequest(body: unknown, url = "http://localhost/api/admin") {
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
  (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(USUARIO);
  (mockDb.update as jest.Mock).mockReturnValue(makeUpdateChain());
  (mockDb.delete as jest.Mock).mockReturnValue(makeDeleteChain());
});

// ── POST /api/admin/aprovar/[id] ──────────────────────────────────────────────

describe("POST /api/admin/aprovar/[id]", () => {
  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await aprovar(jsonRequest({ perfil: "viewer" }) as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para não-admin", async () => {
    mockGetSession.mockResolvedValue(makeSession("lideranca"));
    const res = await aprovar(jsonRequest({ perfil: "viewer" }) as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 400 para perfil inválido", async () => {
    const res = await aprovar(jsonRequest({ perfil: "superusuario" }) as never, PARAMS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Perfil");
  });

  it("retorna 404 quando usuário não existe", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await aprovar(jsonRequest({ perfil: "viewer" }) as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 200 e atualiza status para aprovado", async () => {
    const res = await aprovar(jsonRequest({ perfil: "lideranca" }) as never, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("envia notificação de aprovação", async () => {
    await aprovar(jsonRequest({ perfil: "viewer" }) as never, PARAMS);
    expect(mockNotificarAprovado).toHaveBeenCalledWith(
      expect.objectContaining({ email: USUARIO.email, nome: USUARIO.nome })
    );
  });

  it("passa o perfil correto para a notificação", async () => {
    await aprovar(jsonRequest({ perfil: "admin" }) as never, PARAMS);
    expect(mockNotificarAprovado).toHaveBeenCalledWith(
      expect.objectContaining({ perfil: "admin" })
    );
  });
});

// ── POST /api/admin/rejeitar/[id] ─────────────────────────────────────────────

describe("POST /api/admin/rejeitar/[id]", () => {
  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await rejeitar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para não-admin", async () => {
    mockGetSession.mockResolvedValue(makeSession("viewer"));
    const res = await rejeitar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando usuário não existe", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await rejeitar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 200 e atualiza status para rejeitado", async () => {
    const res = await rejeitar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("envia notificação de rejeição", async () => {
    await rejeitar(new Request("http://localhost") as never, PARAMS);
    expect(mockNotificarRejeitado).toHaveBeenCalledWith(
      expect.objectContaining({ email: USUARIO.email, nome: USUARIO.nome })
    );
  });
});

// ── POST /api/admin/reativar/[id] ─────────────────────────────────────────────

describe("POST /api/admin/reativar/[id]", () => {
  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await reativar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para não-admin", async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const res = await reativar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando usuário não existe", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await reativar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 200 e reativa o usuário", async () => {
    const res = await reativar(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });
});

// ── PATCH /api/admin/usuarios/[id] ────────────────────────────────────────────

describe("PATCH /api/admin/usuarios/[id]", () => {
  const VALID_BODY = { nome: "Maria Nova", email: "maria@hemo.mg.gov.br", perfil: "lideranca" };

  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await editarUsuario(jsonRequest(VALID_BODY) as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 400 para dados inválidos (email malformado)", async () => {
    const res = await editarUsuario(jsonRequest({ ...VALID_BODY, email: "nao-email" }) as never, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retorna 400 para nome muito curto", async () => {
    const res = await editarUsuario(jsonRequest({ ...VALID_BODY, nome: "A" }) as never, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retorna 400 para perfil inválido", async () => {
    const res = await editarUsuario(jsonRequest({ ...VALID_BODY, perfil: "gerente" }) as never, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando usuário não existe", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await editarUsuario(jsonRequest(VALID_BODY) as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 200 e atualiza os campos", async () => {
    const res = await editarUsuario(jsonRequest(VALID_BODY) as never, PARAMS);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("aceita telefone nulo", async () => {
    const res = await editarUsuario(jsonRequest({ ...VALID_BODY, telefone: null }) as never, PARAMS);
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/admin/usuarios/[id] ───────────────────────────────────────────

describe("DELETE /api/admin/usuarios/[id]", () => {
  it("retorna 403 sem sessão", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await excluirUsuario(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 403 para não-admin", async () => {
    mockGetSession.mockResolvedValue(makeSession("lideranca"));
    const res = await excluirUsuario(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando usuário não existe", async () => {
    (mockDb.query.usuarios.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await excluirUsuario(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(404);
  });

  it("retorna 200 e remove usuário e suas relações", async () => {
    const res = await excluirUsuario(new Request("http://localhost") as never, PARAMS);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });
});
