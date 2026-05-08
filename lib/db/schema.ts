import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const agencias = sqliteTable("agencias", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  codigo: text("codigo").notNull().unique(),
  liderancaNome: text("lideranca_nome").notNull(),
  liderancaTelefone: text("lideranca_telefone"),
  liderancaEmail: text("lideranca_email"),
  onedriveFolderId: text("onedrive_folder_id"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const usuarios = sqliteTable("usuarios", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  agenciaId: text("agencia_id").references(() => agencias.id),
  perfil: text("perfil", { enum: ["admin", "viewer", "lideranca"] })
    .notNull()
    .default("viewer"),
  status: text("status", { enum: ["pendente", "aprovado", "rejeitado"] })
    .notNull()
    .default("pendente"),
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

export const notificacoes = sqliteTable("notificacoes", {
  id: text("id").primaryKey(),
  tipo: text("tipo", {
    enum: [
      "acesso_solicitado",
      "acesso_aprovado",
      "acesso_rejeitado",
      "vencimento_critico",
      "sem_arquivo",
    ],
  }).notNull(),
  destinatario: text("destinatario").notNull(),
  conteudo: text("conteudo").notNull(),
  enviado: integer("enviado").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export type AgenciaInsert = typeof agencias.$inferInsert;
export type UsuarioInsert = typeof usuarios.$inferInsert;
export type RegistroDiarioInsert = typeof registrosDiarios.$inferInsert;
export type BolsaInsert = typeof bolsas.$inferInsert;
export type NotificacaoInsert = typeof notificacoes.$inferInsert;
