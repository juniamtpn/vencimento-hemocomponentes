export interface BolsaEnriquecida {
  id: string;
  agenciaId: string;
  agenciaCodigo: string;
  agenciaNome: string;
  liderancaNome: string;
  liderancaTelefone: string | null;
  instituicao: string;
  doacao: string;
  componente: string;
  abo: string;
  fatorRh: string;
  validade: string;
  urgencia: string;
}

export interface AgenciaStatus {
  id: string;
  nome: string;
  codigo: string;
  liderancaNome: string;
  liderancaTelefone: string | null;
  status: "processado" | "sem_arquivo" | "erro";
  totalBolsas: number;
  arquivoNome: string | null;
}

export interface LiderancaInfo {
  nome: string;
  telefone: string | null;
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
