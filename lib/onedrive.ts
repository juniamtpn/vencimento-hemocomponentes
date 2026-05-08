import { graphFetch, encodeShareUrl } from "./graph-api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ArquivoOneDrive {
  id: string;
  nome: string;
  downloadUrl: string;
}

const MESES_PT: Record<string, string> = {
  Janeiro: "01", Fevereiro: "02", Março: "03", Abril: "04",
  Maio: "05", Junho: "06", Julho: "07", Agosto: "08",
  Setembro: "09", Outubro: "10", Novembro: "11", Dezembro: "12",
};

function getMesAtual(): string {
  const mes = format(new Date(), "MMMM", { locale: ptBR });
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

// Resolve a pasta raiz compartilhada via sharing URL
async function getRootFolderItems(): Promise<{ id: string; name: string; folder?: object }[]> {
  const shareUrl = process.env.ONEDRIVE_SHARING_URL!;
  const encoded = encodeShareUrl(shareUrl);

  const res = await graphFetch(`/shares/${encoded}/root/children?$select=id,name,folder`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[OneDrive] Erro ao listar pasta raiz: ${err}`);
  }
  const data = await res.json();
  return data.value ?? [];
}

// Busca itens dentro de uma pasta pelo ID (usando drives do site)
async function listarPasta(driveId: string, itemId: string): Promise<{ id: string; name: string; folder?: object; "@microsoft.graph.downloadUrl"?: string }[]> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}/children?$select=id,name,folder,@microsoft.graph.downloadUrl`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[OneDrive] Erro ao listar pasta: ${err}`);
  }
  const data = await res.json();
  return data.value ?? [];
}

// Obtém driveId e itemId da pasta raiz compartilhada
async function getShareRootInfo(): Promise<{ driveId: string; itemId: string }> {
  const shareUrl = process.env.ONEDRIVE_SHARING_URL!;
  const encoded = encodeShareUrl(shareUrl);

  const res = await graphFetch(`/shares/${encoded}/root?$select=id,parentReference`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[OneDrive] Erro ao obter pasta raiz: ${err}`);
  }
  const data = await res.json();
  return { driveId: data.parentReference.driveId, itemId: data.id };
}

// Busca arquivo do dia para uma agência específica
// Padrão: DDMMYYYYAGENCIA.xlsx ou .pdf (ex: 07052026HMT.xlsx)
export async function buscarArquivoAgencia(
  codigoAgencia: string,
  data: Date = new Date()
): Promise<ArquivoOneDrive | null> {
  try {
    const mesAtual = getMesAtual();
    const { driveId, itemId } = await getShareRootInfo();

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

    if (!arquivo) return null;

    return {
      id: arquivo.id,
      nome: arquivo.name,
      downloadUrl: arquivo["@microsoft.graph.downloadUrl"] ?? "",
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
