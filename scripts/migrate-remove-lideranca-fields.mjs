import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  console.log("Running migration: normalize agencias and usuarios tables...");

  // Drop redundant columns already removed in previous migration
  // (lideranca_telefone and lideranca_email were dropped earlier)

  // Remove lideranca_nome from agencias — derived from usuarios via usuario_agencias
  try {
    await client.execute("ALTER TABLE agencias DROP COLUMN lideranca_nome");
    console.log("  ✓ Dropped agencias.lideranca_nome");
  } catch (e) {
    if (String(e).includes("no such column")) {
      console.log("  – agencias.lideranca_nome already absent, skipping");
    } else throw e;
  }

  // Remove agencia_id from usuarios — junction table is the single source of truth
  try {
    await client.execute("ALTER TABLE usuarios DROP COLUMN agencia_id");
    console.log("  ✓ Dropped usuarios.agencia_id");
  } catch (e) {
    if (String(e).includes("no such column")) {
      console.log("  – usuarios.agencia_id already absent, skipping");
    } else throw e;
  }

  // Enforce one responsible per agency at DB level
  try {
    await client.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_agencias_agencia_id ON usuario_agencias(agencia_id)"
    );
    console.log("  ✓ Created UNIQUE index on usuario_agencias(agencia_id)");
  } catch (e) {
    console.log("  – Could not create unique index:", String(e));
  }

  console.log("\nMigration complete.");
  client.close();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
