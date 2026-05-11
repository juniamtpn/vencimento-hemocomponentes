import { graphFetch } from "./graph-api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ArquivoOneDrive {
  id: string;
  nome: string;
  downloadUrl: string;
}

function getMesAtual(): string {
  const mes = format(new Date(), "MMMM", { locale: ptBR });
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

// Busca itens dentro de uma pasta pelo ID
async function listarPasta(driveId: string, itemId: string): Promise<{ id: string; name: string; folder?: object; "@microsoft.graph.downloadUrl"?: string }[]> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}/children?$select=id,name,folder,@microsoft.graph.downloadUrl`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[OneDrive] Erro ao listar pasta: ${err}`);
  }
  const data = await res.json();
  return data.value ?? [];
}

// Converte email para o formato de pasta pessoal do SharePoint
// junia.nascimento@vitahemoterapia.com.br → junia_nascimento_vitahemoterapia_com_br
function emailToSharePointUser(email: string): string {
  return email.replace(/[@.]/g, "_");
}

// Cache por 10 min — evita N chamadas redundantes por execução de cron.
let _rootInfoCache: { driveId: string; itemId: string; expiresAt: number } | null = null;

export async function getShareRootInfo(): Promise<{ driveId: string; itemId: string }> {
  if (_rootInfoCache && Date.now() < _rootInfoCache.expiresAt) {
    return _rootInfoCache;
  }

  let driveId: string | undefined;

  // Caminho 1 (mais rápido): drive ID hardcoded via ONEDRIVE_DRIVE_ID
  // Obtenha em: GET /api/admin/diagnostico-onedrive → campo drive_id
  const directDriveId = process.env.ONEDRIVE_DRIVE_ID;
  if (directDriveId) {
    driveId = directDriveId;
  }

  const userEmail = process.env.ONEDRIVE_USER_EMAIL;
  const sharepointHost = process.env.ONEDRIVE_SHAREPOINT_HOST;

  // Caminho 2: /users/{email}/drive
  if (!driveId && userEmail) {
    const driveRes = await graphFetch(`/users/${encodeURIComponent(userEmail)}/drive?$select=id`);
    if (driveRes.ok) {
      const driveData = await driveRes.json();
      driveId = driveData.id;
    } else {
      const errText = await driveRes.text();
      console.warn(`[OneDrive] /users/${userEmail}/drive falhou, tentando via SharePoint site: ${errText}`);
    }
  }

  // Caminho 3: /sites/{host}:/personal/{sanitizedUser}:/drive (Sites.Read.All)
  // Funciona mesmo quando /users/ não resolve (OneDrive não provisionado via UPN)
  if (!driveId) {
    if (!userEmail && !sharepointHost) {
      throw new Error("[OneDrive] Configure ONEDRIVE_DRIVE_ID, ONEDRIVE_USER_EMAIL ou ONEDRIVE_SHAREPOINT_HOST.");
    }

    const host = sharepointHost ?? (() => {
      const domain = userEmail!.split("@")[1];
      const org = domain.split(".")[0];
      return `${org}-my.sharepoint.com`;
    })();

    const spUser = emailToSharePointUser(userEmail!);
    const siteRes = await graphFetch(`/sites/${host}:/personal/${spUser}:/drive?$select=id`);
    if (!siteRes.ok) {
      const err = await siteRes.text();
      throw new Error(`[OneDrive] Erro ao obter drive via SharePoint (${host}/personal/${spUser}): ${err}`);
    }
    const siteData = await siteRes.json();
    driveId = siteData.id;
  }

  if (!driveId) throw new Error("[OneDrive] Não foi possível obter o drive ID.");

  // Obter itemId da pasta configurada (raiz ou subpasta)
  const folderPath = process.env.ONEDRIVE_FOLDER_PATH ?? "";
  const folderEndpoint = folderPath
    ? `/drives/${driveId}/root:${folderPath}?$select=id`
    : `/drives/${driveId}/root?$select=id`;

  const folderRes = await graphFetch(folderEndpoint);
  if (!folderRes.ok) {
    const err = await folderRes.text();
    throw new Error(`[OneDrive] Erro ao obter pasta "${folderPath || "raiz"}": ${err}`);
  }
  const folderData = await folderRes.json();

  const result = { driveId, itemId: folderData.id as string, expiresAt: Date.now() + 10 * 60 * 1000 };
  _rootInfoCache = result;
  return result;
}

// Busca arquivo do dia para uma agência específica
// Padrão: DDMMYYYYAGENCIA.xlsx ou .pdf (ex: 07052026HMT.xlsx)
export async function buscarArquivoAgencia(
  codigoAgencia: string,
  data: Date = new Date(),
  rootInfo?: { driveId: string; itemId: string }
): Promise<ArquivoOneDrive | null> {
  try {
    const mesAtual = getMesAtual();
    const { driveId, itemId } = rootInfo ?? await getShareRootInfo();

    // Listar subpastas da raiz para encontrar pasta do mês
    const subpastas = await listarPasta(driveId, itemId);
    const pastaDoMes = subpastas.find(
      (item) => item.folder && item.name.toLowerCase() === mesAtual.toLowerCase()
    );

    if (!pastaDoMes) {
      console.warn(`[OneDrive] Pasta "${mesAtual}" não encontrada`);
      return null;
    }

    // Listar arquivos dentro da pasta do mês
    const arquivos = await listarPasta(driveId, pastaDoMes.id);

    // Padrão: DDMMYYYYAGENCIA.xlsx ou DDMMYYYYAGENCIA.pdf
    const dd = String(data.getDate()).padStart(2, "0");
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const yyyy = String(data.getFullYear());
    const prefixo = `${dd}${mm}${yyyy}${codigoAgencia}`.toUpperCase();

    const arquivo = arquivos.find((f) => {
      if (f.folder) return false;
      const nome = f.name.toUpperCase().replace(/[-_\s]/g, "");
      const nomeSemExt = nome.replace(/\.(XLSX|XLS|PDF)$/, "");
      return nomeSemExt === prefixo;
    });

    if (!arquivo || !arquivo["@microsoft.graph.downloadUrl"]) return null;

    return {
      id: arquivo.id,
      nome: arquivo.name,
      downloadUrl: arquivo["@microsoft.graph.downloadUrl"],
    };
  } catch (err) {
    console.error(`[OneDrive] Erro ao buscar arquivo para ${codigoAgencia}:`, err);
    return null;
  }
}

// Baixa o conteúdo de um arquivo pelo download URL
export async function baixarArquivo(downloadUrl: string): Promise<Buffer> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`[OneDrive] Erro ao baixar arquivo: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}
