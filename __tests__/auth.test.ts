/**
 * Tests for lib/auth.ts
 *
 * Covers:
 *   - signIn callback: access control (aprovado/pendente/rejeitado/desconhecido)
 *   - session callback: session enrichment with perfil and agenciaId
 *   - azureADMultiTenant: config regression guard (multi-tenant endpoints, oauth type)
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      usuarios: { findFirst: jest.fn() },
      usuarioAgencias: { findFirst: jest.fn() },
    },
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
  },
  usuarios: {},
}));

jest.mock("@/lib/db/schema", () => ({
  usuarioAgencias: {},
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

jest.mock("nanoid", () => ({ nanoid: () => "generated-id" }));

// ── Imports ───────────────────────────────────────────────────────────────────

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const mockUsuarios = db.query.usuarios.findFirst as jest.Mock;
const mockAgencias = db.query.usuarioAgencias.findFirst as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

const signIn = authOptions.callbacks!.signIn!;
const sessionCb = authOptions.callbacks!.session!;

function makeUser(email: string | null = "user@hemo.gov.br") {
  return { id: "u1", name: "User", email } as never;
}

function makeAccount(provider = "azure-ad") {
  return { provider } as never;
}

function makeSession(email = "user@hemo.gov.br") {
  return { user: { email }, expires: "9999" } as never;
}

// ── signIn callback ───────────────────────────────────────────────────────────

describe("signIn callback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("bloqueia usuário sem e-mail", async () => {
    const result = await signIn({ user: makeUser(null), account: makeAccount() });
    expect(result).toBe(false);
    expect(mockUsuarios).not.toHaveBeenCalled();
  });

  it("permite demo-credentials sem consultar o banco", async () => {
    const result = await signIn({ user: makeUser(), account: makeAccount("demo-credentials") });
    expect(result).toBe(true);
    expect(mockUsuarios).not.toHaveBeenCalled();
  });

  it("redireciona usuário desconhecido para solicitar-acesso", async () => {
    mockUsuarios.mockResolvedValueOnce(null);
    const result = await signIn({ user: makeUser(), account: makeAccount() });
    expect(result).toBe("/solicitar-acesso");
  });

  it("redireciona usuário pendente", async () => {
    mockUsuarios.mockResolvedValueOnce({ status: "pendente" });
    const result = await signIn({ user: makeUser(), account: makeAccount() });
    expect(result).toBe("/solicitar-acesso?status=pendente");
  });

  it("redireciona usuário rejeitado", async () => {
    mockUsuarios.mockResolvedValueOnce({ status: "rejeitado" });
    const result = await signIn({ user: makeUser(), account: makeAccount() });
    expect(result).toBe("/solicitar-acesso?status=rejeitado");
  });

  it("permite usuário aprovado", async () => {
    mockUsuarios.mockResolvedValueOnce({ status: "aprovado" });
    const result = await signIn({ user: makeUser(), account: makeAccount() });
    expect(result).toBe(true);
  });
});

// ── session callback ──────────────────────────────────────────────────────────

describe("session callback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("enriquece a sessão com perfil e agência do banco", async () => {
    mockUsuarios.mockResolvedValueOnce({ id: "u1", perfil: "admin" });
    mockAgencias.mockResolvedValueOnce({ agenciaId: "ag1" });

    const result = await sessionCb({ session: makeSession(), token: {} } as never);

    expect(result.user.id).toBe("u1");
    expect(result.user.perfil).toBe("admin");
    expect(result.user.agenciaId).toBe("ag1");
  });

  it("não define agenciaId quando usuário não tem agência vinculada", async () => {
    mockUsuarios.mockResolvedValueOnce({ id: "u1", perfil: "lideranca" });
    mockAgencias.mockResolvedValueOnce(null);

    const result = await sessionCb({ session: makeSession(), token: {} } as never);

    expect(result.user.agenciaId).toBeUndefined();
  });

  it("retorna sessão sem alteração quando usuário não existe no banco", async () => {
    mockUsuarios.mockResolvedValueOnce(null);

    const sess = makeSession();
    const result = await sessionCb({ session: sess, token: {} } as never);

    expect(result.user.id).toBeUndefined();
    expect(result.user.perfil).toBeUndefined();
  });
});

// ── provider config (regression guard) ───────────────────────────────────────

describe("azureAD provider config", () => {
  const provider = authOptions.providers[0] as Record<string, unknown>;

  it("usa AzureAD como primeiro provider (type oauth)", () => {
    expect(provider.type).toBe("oauth");
  });

  it("lê credenciais das variáveis de ambiente", () => {
    expect(provider.clientId).toBe(process.env.AZURE_AD_CLIENT_ID);
    expect(provider.clientSecret).toBe(process.env.AZURE_AD_CLIENT_SECRET);
  });

  it("estratégia de sessão é JWT", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("redireciona /login e /error para a página de login", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
    expect(authOptions.pages?.error).toBe("/login");
  });
});
