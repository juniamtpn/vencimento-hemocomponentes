import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const TELEFONES = [
  { email: "alessandra@vitahemoterapia.com.br",       telefone: "31984841831" },
  { email: "amanda.rodrigues@vitahemoterapia.com.br",  telefone: "31988237731" },
  { email: "ana.gontijo@pulsa-mg.com.br",              telefone: "31991112277" },
  { email: "paula.gomes@pulsa-mg.com.br",              telefone: "31998364361" },
  { email: "beatriz.santos@vitahemoterapia.com.br",    telefone: "34996917919" },
  { email: "joao.henrique@vitahemoterapia.com.br",     telefone: "31988575413" },
  { email: "juana.sousa@pulsa-mg.com.br",              telefone: "31997595500" },
  { email: "raquel.vilasboas@pulsa-mg.com.br",         telefone: "31986234137" },
  { email: "raquel.miranda@pulsa-mg.com.br",           telefone: "31990786976" },
  { email: "samara.santos@pulsa-mg.com.br",            telefone: "31989168728" },
  { email: "evelin.viana@pulsa-mg.com.br",             telefone: "31992543425" },
];

async function run() {
  console.log("Preenchendo telefones dos usuários...\n");

  for (const { email, telefone } of TELEFONES) {
    const result = await client.execute({
      sql: "UPDATE usuarios SET telefone = ? WHERE email = ?",
      args: [telefone, email],
    });

    if (result.rowsAffected > 0) {
      console.log(`  ✓ ${email} → ${telefone}`);
    } else {
      console.log(`  – ${email} não encontrado, pulando`);
    }
  }

  console.log("\nConcluído.");
  client.close();
}

run().catch((e) => {
  console.error("Erro:", e);
  process.exit(1);
});
