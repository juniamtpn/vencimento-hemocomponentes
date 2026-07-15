export interface BolsaEnriquecida {
  id: string;
  agenciaId: string;
  agenciaCodigo: string;
  agenciaNome: string;
  liderancaNome: string;
  instituicao: string;
  doacao: string;
  componente: string;
  abo: string;
  fatorRh: string;
  validade: string;
  urgencia: string;
}

export type MotivoErro =
  | "sem_texto"
  | "data_invalida"
  | "agencia_incorreta"
  | "total_divergente";

/**
 * Texto exibido no painel para cada recusa. `rotulo` vai no badge (curto, cabe
 * na coluna); `explicacao` diz o que fazer — é o que a pessoa precisa para
 * resolver sem abrir o e-mail nem chamar o TI.
 */
export const MOTIVO_ERRO_TEXTO: Record<MotivoErro, { rotulo: string; explicacao: string }> = {
  sem_texto: {
    rotulo: "PDF escaneado",
    explicacao:
      "O PDF foi enviado como imagem digitalizada e não contém texto — o sistema não consegue ler as bolsas. A agência precisa exportar o relatório direto do sistema, sem imprimir e escanear.",
  },
  data_invalida: {
    rotulo: "Relatório de outro dia",
    explicacao:
      "A data de emissão do relatório não é a de hoje. Somente relatórios do dia atual são aceitos — a agência precisa exportar um relatório atualizado.",
  },
  agencia_incorreta: {
    rotulo: "Agência trocada",
    explicacao:
      "O relatório identifica uma agência diferente da pasta em que foi enviado. Provavelmente o arquivo foi colocado na pasta errada.",
  },
  total_divergente: {
    rotulo: "Leitura não confere",
    explicacao:
      "O número de bolsas lidas não bate com o total que o próprio relatório declara. Os dados não foram publicados para não exibir um estoque incompleto. Se repetir, avise o time de TI.",
  },
};

export interface AgenciaStatus {
  id: string;
  nome: string;
  codigo: string;
  liderancaNome: string;
  liderancaTelefone: string | null;
  status: "processado" | "sem_arquivo" | "erro";
  motivoErro: MotivoErro | null;
  totalBolsas: number;
  arquivoNome: string | null;
  tipoEnvio: "automatico" | "manual" | null;
  enviadoPor: string | null;
  createdAt: number | null;
}

export interface LiderancaInfo {
  nome: string;
  telefone: string | null;
  email: string | null;
  agencias: {
    id: string;
    codigo: string;
    nome: string;
    status: string;
    totalBolsas: number;
  }[];
  enviadas: number;
  total: number;
}
