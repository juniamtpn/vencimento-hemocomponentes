import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  console.log("Running migration: remove lideranca_telefone and lideranca_email from agencias...");

  await client.execute("ALTER TABLE agencias DROP COLUMN lideranca_telefone");
  console.log("  ✓ Dropped lideranca_telefone");

  await client.execute("ALTER TABLE agencias DROP COLUMN lideranca_email");
  console.log("  ✓ Dropped lideranca_email");

  console.log("\nMigration complete.");
  client.close();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
