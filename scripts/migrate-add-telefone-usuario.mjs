// Adds telefone column to usuarios table
const TURSO_URL = process.env.TURSO_DATABASE_URL.replace("libsql://", "https://");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function execute(sql) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: [] } },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.results?.[0]?.type === "error") throw new Error(data.results[0].error.message);
  return data;
}

console.log("Adicionando coluna telefone à tabela usuarios...");
try {
  await execute("ALTER TABLE usuarios ADD COLUMN telefone TEXT");
  console.log("✓ Coluna adicionada");
} catch (e) {
  if (e.message.includes("duplicate column")) {
    console.log("✓ Coluna já existe");
  } else {
    throw e;
  }
}
console.log("✅ Migração concluída!");
