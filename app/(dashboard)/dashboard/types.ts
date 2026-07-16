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
  | "total_divergente"
  | "falha_leitura";

/**
 * Texto exibido no painel para cada recusa. `rotulo` vai no badge (curto, cabe
 * na coluna); `explicacao` diz o que fazer — é o que a pessoa precisa para
 * resolver sem abrir o e-mail nem chamar o TI.
 */
export const MOTIVO_ERRO_TEXTO: Record<MotivoErro, { rotulo: string; explicacao: string }> = {
  sem_texto: {
    rotulo: "Layout antigo (Vita)",
    explicacao:
      "O relatório veio no layout antigo do HEMOTE (Grupo Vita), que gera a página inteira como imagem — não há texto para o sistema ler. A agência precisa emitir o relatório no layout novo (Pulsa). Enquanto isso, as bolsas desta agência precisam ser conferidas manualmente.",
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
  falha_leitura: {
    rotulo: "Falha ao ler",
    explicacao:
      "O sistema encontrou o arquivo mas não conseguiu processá-lo — pode estar corrompido ou num formato inesperado. Avise o time de TI; o erro foi registrado para diagnóstico.",
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
