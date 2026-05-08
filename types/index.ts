export type Perfil = "admin" | "viewer" | "lideranca";
export type StatusUsuario = "pendente" | "aprovado" | "rejeitado";
export type Urgencia = "vencido" | "hoje" | "amanha" | "3dias" | "ok";
export type StatusRegistro = "processado" | "sem_arquivo" | "erro";

export interface Agencia {
  id: string;
  nome: string;
  codigo: string;
  liderancaNome: string;
  liderancaTelefone: string | null;
  liderancaEmail: string | null;
  onedriveFolderId: string | null;
  createdAt: number;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  agenciaId: string | null;
  perfil: Perfil;
  status: StatusUsuario;
  justificativa: string | null;
  aprovadoPor: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RegistroDiario {
  id: string;
  agenciaId: string;
  dataProcessamento: string;
  totalBolsas: number;
  arquivoNome: string | null;
  status: StatusRegistro;
  createdAt: number;
}

export interface Bolsa {
  id: string;
  registroId: string;
  agenciaId: string;
  instituicao: string;
  doacao: string;
  componente: string;
  validade: string;
  abo: string;
  fatorRh: string;
  urgencia: Urgencia;
  createdAt: number;
}

export interface BolsaComAgencia extends Bolsa {
  agenciaNome: string;
  agenciaCodigo: string;
}

export interface ResumoAgencia {
  agencia: Agencia;
  vencidos: number;
  hoje: number;
  amanha: number;
  tresDias: number;
  ok: number;
  semArquivo: boolean;
  dataUltimoProcessamento: string | null;
}
