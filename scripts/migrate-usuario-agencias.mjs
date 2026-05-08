// Creates usuario_agencias junction table and populates it
// by matching agencias.lideranca_email to usuarios.email
import { nanoid } from "nanoid";

const TURSO_URL = process.env.TURSO_DATABASE_URL.replace("libsql://", "https://");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function execute(sql, args = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map((v) =>
              v === null ? { type: "null" } : { type: "text", value: String(v) }
            ),
          },
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json();
  if (data.results?.[0]?.type === "error") throw new Error(data.results[0].error.message);
  return data.results?.[0]?.response?.result;
}

async function query(sql, args = []) {
  const result = await execute(sql, args);
  const cols = result?.cols?.map((c) => c.name) ?? [];
  const rows = result?.rows ?? [];
  return rows.map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]?.value ?? null])));
}

// 1. Create table
console.log("1. Criando tabela usuario_agencias...");
try {
  await execute(`
    CREATE TABLE IF NOT EXISTS usuario_agencias (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id),
      agencia_id TEXT NOT NULL REFERENCES agencias(id)
    )
  `);
  console.log("   ✓ Tabela criada");
} catch (e) {
  console.log("   ✓ Tabela já existe:", e.message);
}

// 2. Check if already populated
const existing = await query("SELECT COUNT(*) as total FROM usuario_agencias");
const total = Number(existing[0]?.total ?? 0);
if (total > 0) {
  console.log(`\n   ℹ️  Tabela já tem ${total} registros. Pulando seed.`);
  console.log("\n✅ Migração concluída!");
  process.exit(0);
}

// 3. Populate: match agencias.lideranca_email → usuarios.email
console.log("\n2. Populando via lideranca_email → usuarios.email...");

const pares = await query(`
  SELECT u.id AS usuario_id, a.id AS agencia_id, u.email, a.codigo
  FROM usuarios u
  JOIN agencias a ON a.lideranca_email = u.email
  WHERE u.perfil = 'lideranca'
  ORDER BY u.email, a.codigo
`);

console.log(`   Encontrados ${pares.length} pares liderança–agência`);

for (const par of pares) {
  await execute(
    "INSERT OR IGNORE INTO usuario_agencias (id, usuario_id, agencia_id) VALUES (?, ?, ?)",
    [nanoid(), par.usuario_id, par.agencia_id]
  );
  console.log(`   ✓ ${par.email} → ${par.codigo}`);
}

console.log("\n✅ Migração concluída com sucesso!");
