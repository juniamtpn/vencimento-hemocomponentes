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
  { nome: "HUSC", codigo: "HUSC", liderancaNome: "Alessandra" },
  { nome: "HUB", codigo: "HUB", liderancaNome: "Alessandra" },
  // Amanda
  { nome: "HIO", codigo: "HIO", liderancaNome: "Amanda" },
  { nome: "HBH", codigo: "HBH", liderancaNome: "Amanda" },
  // Ana Carolina
  { nome: "HL", codigo: "HL", liderancaNome: "Ana Carolina" },
  { nome: "HMDBC", codigo: "HMDBC", liderancaNome: "Ana Carolina" },
  // Ana Paula
  { nome: "HVS", codigo: "HVS", liderancaNome: "Ana Paula" },
  { nome: "HMON", codigo: "HMON", liderancaNome: "Ana Paula" },
  { nome: "HSR", codigo: "HSR", liderancaNome: "Ana Paula" },
  // Beatriz
  { nome: "HSCU Ub", codigo: "HSCU_UB", liderancaNome: "Beatriz" },
  { nome: "HSG Ub", codigo: "HSG_UB", liderancaNome: "Beatriz" },
  // João
  { nome: "HMDC", codigo: "HMDC", liderancaNome: "João" },
  { nome: "HMDSA", codigo: "HMDSA", liderancaNome: "João" },
  { nome: "HMDNL", codigo: "HMDNL", liderancaNome: "João" },
  // Juana
  { nome: "HDMU", codigo: "HDMU", liderancaNome: "Juana" },
  { nome: "HUC", codigo: "HUC", liderancaNome: "Juana" },
  // Raquel Villas Boas
  { nome: "HLC", codigo: "HLC", liderancaNome: "Raquel Villas Boas" },
  { nome: "HVC", codigo: "HVC", liderancaNome: "Raquel Villas Boas" },
  { nome: "HSE", codigo: "HSE", liderancaNome: "Raquel Villas Boas" },
  { nome: "HS", codigo: "HS", liderancaNome: "Raquel Villas Boas" },
  // Raquel Miranda
  { nome: "UMC Ub", codigo: "UMC_UB", liderancaNome: "Raquel Miranda" },
  { nome: "Madrecor Ub", codigo: "MADRECOR_UB", liderancaNome: "Raquel Miranda" },
  // Samara
  { nome: "HFR", codigo: "HFR", liderancaNome: "Samara" },
  { nome: "HSL", codigo: "HSL", liderancaNome: "Samara" },
  // Evelin
  { nome: "HMT", codigo: "HMT", liderancaNome: "Evelin" },
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
