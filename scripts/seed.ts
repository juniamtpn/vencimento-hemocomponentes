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
  // Alessandra (31 98484-1831)
  { nome: "HUSC", codigo: "HUSC", liderancaNome: "Alessandra", liderancaTelefone: "31984841831" },
  { nome: "HUB", codigo: "HUB", liderancaNome: "Alessandra", liderancaTelefone: "31984841831" },
  // Amanda (31 98823-7731)
  { nome: "HIO", codigo: "HIO", liderancaNome: "Amanda", liderancaTelefone: "31988237731" },
  { nome: "HBH", codigo: "HBH", liderancaNome: "Amanda", liderancaTelefone: "31988237731" },
  // Ana Carolina (31 99111-2277)
  { nome: "HL", codigo: "HL", liderancaNome: "Ana Carolina", liderancaTelefone: "31991112277" },
  { nome: "HMDBC", codigo: "HMDBC", liderancaNome: "Ana Carolina", liderancaTelefone: "31991112277" },
  // Ana Paula (31 99836-4361)
  { nome: "HVS", codigo: "HVS", liderancaNome: "Ana Paula", liderancaTelefone: "31998364361" },
  { nome: "HMON", codigo: "HMON", liderancaNome: "Ana Paula", liderancaTelefone: "31998364361" },
  { nome: "HSR", codigo: "HSR", liderancaNome: "Ana Paula", liderancaTelefone: "31998364361" },
  // Beatriz (sem contato)
  { nome: "HSCU Ub", codigo: "HSCU_UB", liderancaNome: "Beatriz", liderancaTelefone: null },
  { nome: "HSG Ub", codigo: "HSG_UB", liderancaNome: "Beatriz", liderancaTelefone: null },
  // João (31 98857-5413)
  { nome: "HMDC", codigo: "HMDC", liderancaNome: "João", liderancaTelefone: "31988575413" },
  { nome: "HMDSA", codigo: "HMDSA", liderancaNome: "João", liderancaTelefone: "31988575413" },
  { nome: "HMDNL", codigo: "HMDNL", liderancaNome: "João", liderancaTelefone: "31988575413" },
  // Juana (31 99759-5500)
  { nome: "HDMU", codigo: "HDMU", liderancaNome: "Juana", liderancaTelefone: "31997595500" },
  { nome: "HUC", codigo: "HUC", liderancaNome: "Juana", liderancaTelefone: "31997595500" },
  // Raquel Villas Boas (31 98623-4137)
  { nome: "HLC", codigo: "HLC", liderancaNome: "Raquel Villas Boas", liderancaTelefone: "31986234137" },
  { nome: "HVC", codigo: "HVC", liderancaNome: "Raquel Villas Boas", liderancaTelefone: "31986234137" },
  { nome: "HSE", codigo: "HSE", liderancaNome: "Raquel Villas Boas", liderancaTelefone: "31986234137" },
  { nome: "HS", codigo: "HS", liderancaNome: "Raquel Villas Boas", liderancaTelefone: "31986234137" },
  // Raquel Miranda (sem contato)
  { nome: "UMC Ub", codigo: "UMC_UB", liderancaNome: "Raquel Miranda", liderancaTelefone: null },
  { nome: "Madrecor Ub", codigo: "MADRECOR_UB", liderancaNome: "Raquel Miranda", liderancaTelefone: null },
  // Samara (31 98916-8728)
  { nome: "HFR", codigo: "HFR", liderancaNome: "Samara", liderancaTelefone: "31989168728" },
  { nome: "HSL", codigo: "HSL", liderancaNome: "Samara", liderancaTelefone: "31989168728" },
  // Evelin (31 99254-3425)
  { nome: "HMT", codigo: "HMT", liderancaNome: "Evelin", liderancaTelefone: "31992543425" },
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
        liderancaTelefone: ag.liderancaTelefone ?? null,
        onedriveFolderId: null,
      })
      .onConflictDoNothing();

    console.log(`  ✓ ${ag.nome} (${ag.liderancaNome})`);
  }

  console.log("\n✅ Seed concluído!");
  console.log(
    "\n⚠️  Próximo passo: atualize onedrive_folder_id para cada agência."
  );
  console.log(
    "   Use o Drizzle Studio (npm run db:studio) ou atualize diretamente no Turso."
  );

  client.close();
}

seed().catch((e) => {
  console.error("❌ Erro no seed:", e);
  process.exit(1);
});
