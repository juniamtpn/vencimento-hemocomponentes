/**
 * Unit tests for lib/google-drive.ts
 *
 * Strategy: each test uses jest.isolateModulesAsync to get a fresh module
 * with an empty token/root cache and controlled fetch mock.
 */

const MOCK_EMAIL = "sa@project.iam.gserviceaccount.com";
const MOCK_KEY = "mock-private-key";
const MOCK_FOLDER_ID = "root-folder-id";
const MOCK_TOKEN = "ya29.mock-access-token";

function makeFetchOk(body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
    arrayBuffer: async () => Buffer.from("file-content").buffer,
  });
}

function makeFetchFail(status: number, message: string) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => message,
    json: async () => ({ error: message }),
  });
}

// Suppress console noise from Google Drive error logging
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("getShareRootInfo", () => {
  it("retorna o folder ID configurado em GOOGLE_DRIVE_FOLDER_ID", async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = MOCK_EMAIL;
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = MOCK_KEY;
      process.env.GOOGLE_DRIVE_FOLDER_ID = MOCK_FOLDER_ID;

      global.fetch = makeFetchOk({ access_token: MOCK_TOKEN, expires_in: 3600 });

      const { getShareRootInfo } = await import("@/lib/google-drive");
      const info = await getShareRootInfo();

      expect(info.driveId).toBe("google");
      expect(info.itemId).toBe(MOCK_FOLDER_ID);
    });
  });

  it("lança erro quando GOOGLE_DRIVE_FOLDER_ID não está definido", async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = MOCK_EMAIL;
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = MOCK_KEY;
      delete process.env.GOOGLE_DRIVE_FOLDER_ID;

      jest.mock("crypto", () => {
        const actual = jest.requireActual<typeof import("crypto")>("crypto");
        return { ...actual, createSign: jest.fn(() => ({ update: jest.fn(), sign: jest.fn().mockReturnValue("sig") })) };
      });

      const { getShareRootInfo } = await import("@/lib/google-drive");
      await expect(getShareRootInfo()).rejects.toThrow("GOOGLE_DRIVE_FOLDER_ID");
    });
  });
});

describe("buscarArquivoAgencia", () => {
  const setup = () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = MOCK_EMAIL;
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = MOCK_KEY;
    process.env.GOOGLE_DRIVE_FOLDER_ID = MOCK_FOLDER_ID;

    jest.mock("crypto", () => {
      const actual = jest.requireActual<typeof import("crypto")>("crypto");
      return {
        ...actual,
        createSign: jest.fn(() => ({
          update: jest.fn(),
          sign: jest.fn().mockReturnValue("mock-sig"),
        })),
      };
    });
  };

  it("encontra arquivo com padrão DDMMYYYYCOD.xlsx na pasta do mês", async () => {
    await jest.isolateModulesAsync(async () => {
      setup();

      // Fixed date: 14 May 2026 (Maio)
      const testDate = new Date("2026-05-14T13:00:00Z");
      const mesNome = "Maio";
      const prefixo = "14052026HEMO01";

      global.fetch = jest
        .fn()
        // 1st call: OAuth token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }),
          text: async () => "",
        })
        // 2nd call: list root folder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              { id: "mes-folder", name: mesNome, mimeType: "application/vnd.google-apps.folder" },
            ],
          }),
          text: async () => "",
        })
        // 3rd call: list month folder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              { id: "file-001", name: `${prefixo}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
            ],
          }),
          text: async () => "",
        });

      const { buscarArquivoAgencia } = await import("@/lib/google-drive");
      const result = await buscarArquivoAgencia("HEMO01", testDate, { driveId: "google", itemId: MOCK_FOLDER_ID });

      expect(result).not.toBeNull();
      expect(result!.id).toBe("file-001");
      expect(result!.nome).toBe(`${prefixo}.xlsx`);
      expect(result!.downloadUrl).toContain("file-001");
    });
  });

  it("retorna null quando pasta do mês não existe", async () => {
    await jest.isolateModulesAsync(async () => {
      setup();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }), text: async () => "" });

      const { buscarArquivoAgencia } = await import("@/lib/google-drive");
      const result = await buscarArquivoAgencia("HEMO01", new Date("2026-05-14T13:00:00Z"), { driveId: "google", itemId: MOCK_FOLDER_ID });

      expect(result).toBeNull();
    });
  });

  it("retorna null quando arquivo não existe na pasta", async () => {
    await jest.isolateModulesAsync(async () => {
      setup();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "mes-folder", name: "Maio", mimeType: "application/vnd.google-apps.folder" }] }), text: async () => "" })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }), text: async () => "" });

      const { buscarArquivoAgencia } = await import("@/lib/google-drive");
      const result = await buscarArquivoAgencia("HEMO01", new Date("2026-05-14T13:00:00Z"), { driveId: "google", itemId: MOCK_FOLDER_ID });

      expect(result).toBeNull();
    });
  });

  it("ignora pastas ao buscar arquivo", async () => {
    await jest.isolateModulesAsync(async () => {
      setup();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [{ id: "mes-folder", name: "Maio", mimeType: "application/vnd.google-apps.folder" }],
          }),
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              // A folder with the same name prefix should NOT match
              { id: "subfolder", name: "14052026HEMO01", mimeType: "application/vnd.google-apps.folder" },
            ],
          }),
          text: async () => "",
        });

      const { buscarArquivoAgencia } = await import("@/lib/google-drive");
      const result = await buscarArquivoAgencia("HEMO01", new Date("2026-05-14T13:00:00Z"), { driveId: "google", itemId: MOCK_FOLDER_ID });

      expect(result).toBeNull();
    });
  });

  it("é case-insensitive e ignora separadores no nome do arquivo", async () => {
    await jest.isolateModulesAsync(async () => {
      setup();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "mes", name: "Maio", mimeType: "application/vnd.google-apps.folder" }] }), text: async () => "" })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              // Name has underscores and lowercase — should still match
              { id: "file-002", name: "14_05_2026_hemo01.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
            ],
          }),
          text: async () => "",
        });

      const { buscarArquivoAgencia } = await import("@/lib/google-drive");
      const result = await buscarArquivoAgencia("HEMO01", new Date("2026-05-14T13:00:00Z"), { driveId: "google", itemId: MOCK_FOLDER_ID });

      expect(result).not.toBeNull();
      expect(result!.id).toBe("file-002");
    });
  });

  it("retorna null e não lança quando a API do Drive retorna erro", async () => {
    await jest.isolateModulesAsync(async () => {
      setup();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden", json: async () => ({ error: "Forbidden" }) });

      const { buscarArquivoAgencia } = await import("@/lib/google-drive");
      const result = await buscarArquivoAgencia("HEMO01", new Date("2026-05-14T13:00:00Z"), { driveId: "google", itemId: MOCK_FOLDER_ID });

      expect(result).toBeNull();
    });
  });
});

describe("baixarArquivo", () => {
  it("retorna buffer do conteúdo baixado", async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = MOCK_EMAIL;
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = MOCK_KEY;
      process.env.GOOGLE_DRIVE_FOLDER_ID = MOCK_FOLDER_ID;

      jest.mock("crypto", () => {
        const actual = jest.requireActual<typeof import("crypto")>("crypto");
        return { ...actual, createSign: jest.fn(() => ({ update: jest.fn(), sign: jest.fn().mockReturnValue("sig") })) };
      });

      // TextEncoder produces a Uint8Array that owns its ArrayBuffer (not pooled)
      const fileArrayBuffer = new TextEncoder().encode("xlsx-binary-data").buffer;
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => fileArrayBuffer,
          text: async () => "",
        });

      const { baixarArquivo } = await import("@/lib/google-drive");
      const buf = await baixarArquivo("https://www.googleapis.com/drive/v3/files/abc?alt=media");

      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString()).toBe("xlsx-binary-data");
    });
  });

  it("lança erro quando download falha", async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = MOCK_EMAIL;
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = MOCK_KEY;
      process.env.GOOGLE_DRIVE_FOLDER_ID = MOCK_FOLDER_ID;

      jest.mock("crypto", () => {
        const actual = jest.requireActual<typeof import("crypto")>("crypto");
        return { ...actual, createSign: jest.fn(() => ({ update: jest.fn(), sign: jest.fn().mockReturnValue("sig") })) };
      });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: MOCK_TOKEN, expires_in: 3600 }), text: async () => "" })
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" });

      const { baixarArquivo } = await import("@/lib/google-drive");
      await expect(baixarArquivo("https://www.googleapis.com/drive/v3/files/missing?alt=media")).rejects.toThrow(
        "Erro ao baixar arquivo"
      );
    });
  });
});
