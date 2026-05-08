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
  { nome: "HUSC", codigo: "HUSC" },
  { nome: "HUB", codigo: "HUB" },
  { nome: "HIO", codigo: "HIO" },
  { nome: "HBH", codigo: "HBH" },
  { nome: "HL", codigo: "HL" },
  { nome: "HMDBC", codigo: "HMDBC" },
  { nome: "HVS", codigo: "HVS" },
  { nome: "HMON", codigo: "HMON" },
  { nome: "HSR", codigo: "HSR" },
  { nome: "HSCU Ub", codigo: "HSCU_UB" },
  { nome: "HSG Ub", codigo: "HSG_UB" },
  { nome: "HMDC", codigo: "HMDC" },
  { nome: "HMDSA", codigo: "HMDSA" },
  { nome: "HMDNL", codigo: "HMDNL" },
  { nome: "HDMU", codigo: "HDMU" },
  { nome: "HUC", codigo: "HUC" },
  { nome: "HLC", codigo: "HLC" },
  { nome: "HVC", codigo: "HVC" },
  { nome: "HSE", codigo: "HSE" },
  { nome: "HS", codigo: "HS" },
  { nome: "UMC Ub", codigo: "UMC_UB" },
  { nome: "Madrecor Ub", codigo: "MADRECOR_UB" },
  { nome: "HFR", codigo: "HFR" },
  { nome: "HSL", codigo: "HSL" },
  { nome: "HMT", codigo: "HMT" },
];

const LIDERANCAS = [
  { nome: "Alessandra", email: "alessandra@vitahemoterapia.com.br", agencias: ["HUSC", "HUB"] },
  { nome: "Amanda", email: "amanda.rodrigues@vitahemoterapia.com.br", agencias: ["HIO", "HBH"] },
  { nome: "Ana Carolina", email: "ana.gontijo@pulsa-mg.com.br", agencias: ["HL", "HMDBC"] },
  { nome: "Ana Paula", email: "paula.gomes@pulsa-mg.com.br", agencias: ["HVS", "HMON", "HSR"] },
  { nome: "Beatriz", email: "beatriz.santos@vitahemoterapia.com.br", agencias: ["HSCU_UB", "HSG_UB"] },
  { nome: "João", email: "joao.henrique@vitahemoterapia.com.br", agencias: ["HMDC", "HMDSA", "HMDNL"] },
  { nome: "Juana", email: "juana.sousa@pulsa-mg.com.br", agencias: ["HDMU", "HUC"] },
  { nome: "Raquel Villas Boas", email: "raquel.vilasboas@pulsa-mg.com.br", agencias: ["HLC", "HVC", "HSE", "HS"] },
  { nome: "Raquel Miranda", email: "raquel.miranda@pulsa-mg.com.br", agencias: ["UMC_UB", "MADRECOR_UB"] },
  { nome: "Samara", email: "samara.santos@pulsa-mg.com.br", agencias: ["HFR", "HSL"] },
  { nome: "Evelin", email: "evelin.viana@pulsa-mg.com.br", agencias: ["HMT"] },
];

async function seed() {
  console.log(`🌱 Inserindo ${AGENCIAS.length} agências...`);

  const agenciaIds = new Map<string, string>();
  for (const ag of AGENCIAS) {
    const id = nanoid();
    await db
      .insert(schema.agencias)
      .values({ id, nome: ag.nome, codigo: ag.codigo })
      .onConflictDoNothing();
    agenciaIds.set(ag.codigo, id);
    console.log(`  ✓ ${ag.nome}`);
  }

  console.log(`\n👥 Pré-cadastrando ${LIDERANCAS.length} responsáveis...`);

  for (const l of LIDERANCAS) {
    const usuarioId = nanoid();
    await db
      .insert(schema.usuarios)
      .values({
        id: usuarioId,
        email: l.email,
        nome: l.nome,
        perfil: "lideranca",
        status: "aprovado",
      })
      .onConflictDoNothing();

    // Link to agencies via junction table
    for (const codigoAg of l.agencias) {
      const agId = agenciaIds.get(codigoAg);
      if (agId) {
        await db
          .insert(schema.usuarioAgencias)
          .values({ id: nanoid(), usuarioId, agenciaId: agId })
          .onConflictDoNothing();
      }
    }

    console.log(`  ✓ ${l.nome} (${l.email}) → ${l.agencias.join(", ")}`);
  }

  console.log("\n✅ Seed concluído!");

  client.close();
}

seed().catch((e) => {
  console.error("❌ Erro no seed:", e);
  process.exit(1);
});
