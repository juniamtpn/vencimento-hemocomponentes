import { createSign } from "crypto";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ArquivoDrive {
  id: string;
  nome: string;
  downloadUrl: string;
}

let _tokenCache: { value: string; expiresAt: number } | null = null;
let _rootCache: { folderId: string; expiresAt: number } | null = null;

function getMesAtual(): string {
  const mes = format(new Date(), "MMMM", { locale: ptBR });
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

function createJWT(email: string, rawKey: string): string {
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");
  const unsigned = `${header}.${body}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  return `${unsigned}.${sign.sign(privateKey, "base64url")}`;
}

async function getGoogleToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) return _tokenCache.value;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJWT(email, privateKey),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Google Drive] Token error: ${err}`);
  }

  const data = await res.json();
  _tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _tokenCache.value;
}

async function driveFetch(path: string): Promise<Response> {
  const token = await getGoogleToken();
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function listarPasta(folderId: string): Promise<{ id: string; name: string; mimeType: string; createdTime?: string }[]> {
  const res = await driveFetch(
    `/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,createdTime)&pageSize=1000`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Google Drive] Erro ao listar pasta: ${err}`);
  }
  const data = await res.json();
  return data.files ?? [];
}

export async function getShareRootInfo(): Promise<{ driveId: string; itemId: string }> {
  if (_rootCache && Date.now() < _rootCache.expiresAt) {
    return { driveId: "google", itemId: _rootCache.folderId };
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("[Google Drive] Configure GOOGLE_DRIVE_FOLDER_ID com o ID da pasta raiz.");

  _rootCache = { folderId, expiresAt: Date.now() + 10 * 60 * 1000 };
  return { driveId: "google", itemId: folderId };
}

export async function buscarArquivoAgencia(
  codigoAgencia: string,
  data: Date = new Date(),
  rootInfo?: { driveId: string; itemId: string }
): Promise<ArquivoDrive | null> {
  try {
    const mesAtual = getMesAtual();
    const { itemId: rootFolderId } = rootInfo ?? await getShareRootInfo();

    const itens = await listarPasta(rootFolderId);
    const pastaDoMes = itens.find(
      (item) =>
        item.mimeType === "application/vnd.google-apps.folder" &&
        item.name.toLowerCase() === mesAtual.toLowerCase()
    );

    if (!pastaDoMes) {
      console.warn(`[Google Drive] Pasta "${mesAtual}" não encontrada`);
      return null;
    }

    const arquivos = await listarPasta(pastaDoMes.id);

    const dd = String(data.getDate()).padStart(2, "0");
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const yyyy = String(data.getFullYear());
    const prefixo = `${dd}${mm}${yyyy}${codigoAgencia}`.toUpperCase();

    const arquivo = arquivos.find((f) => {
      if (f.mimeType === "application/vnd.google-apps.folder") return false;
      const nome = f.name.toUpperCase().replace(/[-_\s]/g, "");
      const nomeSemExt = nome.replace(/\.(XLSX|XLS|PDF)$/, "");
      return nomeSemExt === prefixo;
    });

    if (!arquivo) return null;

    return {
      id: arquivo.id,
      nome: arquivo.name,
      downloadUrl: `https://www.googleapis.com/drive/v3/files/${arquivo.id}?alt=media`,
    };
  } catch (err) {
    console.error(`[Google Drive] Erro ao buscar arquivo para ${codigoAgencia}:`, err);
    return null;
  }
}

export async function baixarArquivo(downloadUrl: string): Promise<Buffer> {
  const token = await getGoogleToken();
  const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`[Google Drive] Erro ao baixar arquivo: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function excluirArquivo(fileId: string): Promise<void> {
  const token = await getGoogleToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`[Google Drive] Erro ao excluir arquivo ${fileId}: ${err}`);
  }
}

export async function limparArquivosAntigos(rootItemId: string): Promise<{ excluidos: number; erros: number }> {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(0, 0, 0, 0);

  let excluidos = 0;
  let erros = 0;

  const rootItems = await listarPasta(rootItemId);
  const pastasMes = rootItems.filter((f) => f.mimeType === "application/vnd.google-apps.folder");

  for (const pasta of pastasMes) {
    const arquivos = await listarPasta(pasta.id);
    for (const arquivo of arquivos) {
      if (arquivo.mimeType === "application/vnd.google-apps.folder") continue;
      if (!arquivo.createdTime) continue;
      const uploadDate = new Date(arquivo.createdTime);
      uploadDate.setHours(0, 0, 0, 0);
      if (uploadDate < ontem) {
        try {
          await excluirArquivo(arquivo.id);
          excluidos++;
          console.log(`[Google Drive] Excluído: ${arquivo.name} (upload: ${arquivo.createdTime})`);
        } catch (err) {
          erros++;
          console.error(`[Google Drive] Falha ao excluir ${arquivo.name}:`, err);
        }
      }
    }
  }

  return { excluidos, erros };
}
