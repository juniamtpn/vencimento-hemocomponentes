import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const agencias = sqliteTable("agencias", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  codigo: text("codigo").notNull().unique(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const usuarios = sqliteTable("usuarios", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  perfil: text("perfil", { enum: ["admin", "viewer", "lideranca"] })
    .notNull()
    .default("viewer"),
  status: text("status", { enum: ["pendente", "aprovado", "rejeitado"] })
    .notNull()
    .default("pendente"),
  telefone: text("telefone"),
  justificativa: text("justificativa"),
  aprovadoPor: text("aprovado_por"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const registrosDiarios = sqliteTable("registros_diarios", {
  id: text("id").primaryKey(),
  agenciaId: text("agencia_id")
    .notNull()
    .references(() => agencias.id),
  dataProcessamento: text("data_processamento").notNull(),
  totalBolsas: integer("total_bolsas").notNull().default(0),
  arquivoNome: text("arquivo_nome"),
  status: text("status", {
    enum: ["processado", "sem_arquivo", "erro"],
  })
    .notNull()
    .default("processado"),
  tipoEnvio: text("tipo_envio", { enum: ["automatico", "manual"] })
    .notNull()
    .default("automatico"),
  enviadoPor: text("enviado_por"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const bolsas = sqliteTable("bolsas", {
  id: text("id").primaryKey(),
  registroId: text("registro_id")
    .notNull()
    .references(() => registrosDiarios.id),
  agenciaId: text("agencia_id")
    .notNull()
    .references(() => agencias.id),
  instituicao: text("instituicao").notNull(),
  doacao: text("doacao").notNull(),
  componente: text("componente").notNull(),
  validade: text("validade").notNull(),
  abo: text("abo").notNull(),
  fatorRh: text("fator_rh").notNull(),
  urgencia: text("urgencia", {
    enum: ["vencido", "hoje", "amanha", "3dias", "ok"],
  })
    .notNull()
    .default("ok"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const usuarioAgencias = sqliteTable("usuario_agencias", {
  id: text("id").primaryKey(),
  usuarioId: text("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  agenciaId: text("agencia_id")
    .notNull()
    .references(() => agencias.id),
});

export const execucoesCron = sqliteTable("execucoes_cron", {
  id: text("id").primaryKey(),
  iniciadoEm: integer("iniciado_em").notNull(),
  finalizadoEm: integer("finalizado_em"),
  triggeredBy: text("triggered_by").notNull().default("cron"),
  status: text("status").notNull(),
  totalAgencias: integer("total_agencias").notNull().default(0),
  processadas: integer("processadas").notNull().default(0),
  semArquivo: integer("sem_arquivo").notNull().default(0),
  erros: integer("erros").notNull().default(0),
  detalhes: text("detalhes"),
  mensagemErro: text("mensagem_erro"),
});

export type AgenciaInsert = typeof agencias.$inferInsert;
export type UsuarioInsert = typeof usuarios.$inferInsert;
export type RegistroDiarioInsert = typeof registrosDiarios.$inferInsert;
export type BolsaInsert = typeof bolsas.$inferInsert;
export type UsuarioAgenciaInsert = typeof usuarioAgencias.$inferInsert;
export type ExecucaoCronInsert = typeof execucoesCron.$inferInsert;
