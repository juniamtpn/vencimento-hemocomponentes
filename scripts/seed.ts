import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { nanoid } from "nanoid";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client, { schema });

const AGENCIAS = [
  // Alessandra
  { nome: "HUSC", codigo: "HUSC", liderancaNome: "Alessandra", liderancaEmail: "alessandra@vitahemoterapia.com.br", liderancaTelefone: "31984841831" },
  { nome: "HUB", codigo: "HUB", liderancaNome: "Alessandra", liderancaEmail: "alessandra@vitahemoterapia.com.br", liderancaTelefone: "31984841831" },
  // Amanda
  { nome: "HIO", codigo: "HIO", liderancaNome: "Amanda", liderancaEmail: "amanda.rodrigues@vitahemoterapia.com.br", liderancaTelefone: "31988237731" },
  { nome: "HBH", codigo: "HBH", liderancaNome: "Amanda", liderancaEmail: "amanda.rodrigues@vitahemoterapia.com.br", liderancaTelefone: "31988237731" },
  // Ana Carolina
  { nome: "HL", codigo: "HL", liderancaNome: "Ana Carolina", liderancaEmail: "ana.gontijo@pulsa-mg.com.br", liderancaTelefone: "31991112277" },
  { nome: "HMDBC", codigo: "HMDBC", liderancaNome: "Ana Carolina", liderancaEmail: "ana.gontijo@pulsa-mg.com.br", liderancaTelefone: "31991112277" },
  // Ana Paula
  { nome: "HVS", codigo: "HVS", liderancaNome: "Ana Paula", liderancaEmail: "paula.gomes@pulsa-mg.com.br", liderancaTelefone: "31998364361" },
  { nome: "HMON", codigo: "HMON", liderancaNome: "Ana Paula", liderancaEmail: "paula.gomes@pulsa-mg.com.br", liderancaTelefone: "31998364361" },
  { nome: "HSR", codigo: "HSR", liderancaNome: "Ana Paula", liderancaEmail: "paula.gomes@pulsa-mg.com.br", liderancaTelefone: "31998364361" },
  // Beatriz
  { nome: "HSCU Ub", codigo: "HSCU_UB", liderancaNome: "Beatriz", liderancaEmail: "beatriz.santos@vitahemoterapia.com.br", liderancaTelefone: "34996917919" },
  { nome: "HSG Ub", codigo: "HSG_UB", liderancaNome: "Beatriz", liderancaEmail: "beatriz.santos@vitahemoterapia.com.br", liderancaTelefone: "34996917919" },
  // João
  { nome: "HMDC", codigo: "HMDC", liderancaNome: "João", liderancaEmail: "joao.henrique@vitahemoterapia.com.br", liderancaTelefone: "31988575413" },
  { nome: "HMDSA", codigo: "HMDSA", liderancaNome: "João", liderancaEmail: "joao.henrique@vitahemoterapia.com.br", liderancaTelefone: "31988575413" },
  { nome: "HMDNL", codigo: "HMDNL", liderancaNome: "João", liderancaEmail: "joao.henrique@vitahemoterapia.com.br", liderancaTelefone: "31988575413" },
  // Juana
  { nome: "HDMU", codigo: "HDMU", liderancaNome: "Juana", liderancaEmail: "juana.sousa@pulsa-mg.com.br", liderancaTelefone: "31997595500" },
  { nome: "HUC", codigo: "HUC", liderancaNome: "Juana", liderancaEmail: "juana.sousa@pulsa-mg.com.br", liderancaTelefone: "31997595500" },
  // Raquel Villas Boas
  { nome: "HLC", codigo: "HLC", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "HVC", codigo: "HVC", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "HSE", codigo: "HSE", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "HS", codigo: "HS", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  // Raquel Miranda
  { nome: "UMC Ub", codigo: "UMC_UB", liderancaNome: "Raquel Miranda", liderancaEmail: "raquel.miranda@pulsa-mg.com.br", liderancaTelefone: "31990786976" },
  { nome: "Madrecor Ub", codigo: "MADRECOR_UB", liderancaNome: "Raquel Miranda", liderancaEmail: "raquel.miranda@pulsa-mg.com.br", liderancaTelefone: "31990786976" },
  // Samara
  { nome: "HFR", codigo: "HFR", liderancaNome: "Samara", liderancaEmail: "samara.santos@pulsa-mg.com.br", liderancaTelefone: "31989168728" },
  { nome: "HSL", codigo: "HSL", liderancaNome: "Samara", liderancaEmail: "samara.santos@pulsa-mg.com.br", liderancaTelefone: "31989168728" },
  // Evelin
  { nome: "HMT", codigo: "HMT", liderancaNome: "Evelin", liderancaEmail: "evelin.viana@pulsa-mg.com.br", liderancaTelefone: "31992543425" },
];

const LIDERANCAS = [
  { nome: "Alessandra", email: "alessandra@vitahemoterapia.com.br" },
  { nome: "Amanda", email: "amanda.rodrigues@vitahemoterapia.com.br" },
  { nome: "Ana Carolina", email: "ana.gontijo@pulsa-mg.com.br" },
  { nome: "Ana Paula", email: "paula.gomes@pulsa-mg.com.br" },
  { nome: "Beatriz", email: "beatriz.santos@vitahemoterapia.com.br" },
  { nome: "João", email: "joao.henrique@vitahemoterapia.com.br" },
  { nome: "Juana", email: "juana.sousa@pulsa-mg.com.br" },
  { nome: "Raquel Villas Boas", email: "raquel.vilasboas@pulsa-mg.com.br" },
  { nome: "Raquel Miranda", email: "raquel.miranda@pulsa-mg.com.br" },
  { nome: "Samara", email: "samara.santos@pulsa-mg.com.br" },
  { nome: "Evelin", email: "evelin.viana@pulsa-mg.com.br" },
];

async function seed() {
  console.log(`🌱 Inserindo ${AGENCIAS.length} agências...`);

  for (const ag of AGENCIAS) {
    await db
      .insert(schema.agencias)
      .values({
        id: nanoid(),
        nome: ag.nome,
        codigo: ag.codigo,
        liderancaNome: ag.liderancaNome,
        liderancaEmail: ag.liderancaEmail,
        liderancaTelefone: ag.liderancaTelefone,
      })
      .onConflictDoNothing();

    console.log(`  ✓ ${ag.nome} (${ag.liderancaNome})`);
  }

  console.log(`\n👥 Pré-cadastrando ${LIDERANCAS.length} responsáveis...`);

  for (const l of LIDERANCAS) {
    await db
      .insert(schema.usuarios)
      .values({
        id: nanoid(),
        email: l.email,
        nome: l.nome,
        agenciaId: null,
        perfil: "lideranca",
        status: "aprovado",
      })
      .onConflictDoNothing();

    console.log(`  ✓ ${l.nome} (${l.email})`);
  }

  console.log("\n✅ Seed concluído!");

  client.close();
}

seed().catch((e) => {
  console.error("❌ Erro no seed:", e);
  process.exit(1);
});
