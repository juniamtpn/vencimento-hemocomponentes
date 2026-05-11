import { graphFetch, encodeShareUrl } from "./graph-api";
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

// Obtém driveId e itemId da pasta raiz compartilhada.
// Cache por 10 min — evita N chamadas redundantes por execução de cron.
let _rootInfoCache: { driveId: string; itemId: string; expiresAt: number } | null = null;

export async function getShareRootInfo(): Promise<{ driveId: string; itemId: string }> {
  if (_rootInfoCache && Date.now() < _rootInfoCache.expiresAt) {
    return _rootInfoCache;
  }

  const shareUrl = process.env.ONEDRIVE_SHARING_URL;
  if (!shareUrl) {
    throw new Error("[OneDrive] Variável ONEDRIVE_SHARING_URL não configurada. Adicione-a nas variáveis de ambiente do Vercel.");
  }

  const encoded = encodeShareUrl(shareUrl);
  const res = await graphFetch(`/shares/${encoded}/root?$select=id,parentReference`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[OneDrive] Erro ao obter pasta raiz: ${err}`);
  }
  const data = await res.json();
  const result = { driveId: data.parentReference.driveId, itemId: data.id, expiresAt: Date.now() + 10 * 60 * 1000 };
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
