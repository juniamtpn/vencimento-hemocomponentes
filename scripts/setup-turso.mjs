const TURSO_URL = process.env.TURSO_DATABASE_URL.replace("libsql://", "https://");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function execute(sql) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql } }, { type: "close" }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

const tables = [
  {
    name: "agencias",
    sql: `CREATE TABLE IF NOT EXISTS agencias (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      lideranca_nome TEXT NOT NULL,
      lideranca_telefone TEXT,
      onedrive_folder_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  },
  {
    name: "usuarios",
    sql: `CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      agencia_id TEXT REFERENCES agencias(id),
      perfil TEXT NOT NULL DEFAULT 'viewer',
      status TEXT NOT NULL DEFAULT 'pendente',
      justificativa TEXT,
      aprovado_por TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  },
  {
    name: "registros_diarios",
    sql: `CREATE TABLE IF NOT EXISTS registros_diarios (
      id TEXT PRIMARY KEY,
      agencia_id TEXT NOT NULL REFERENCES agencias(id),
      data_processamento TEXT NOT NULL,
      total_bolsas INTEGER NOT NULL DEFAULT 0,
      arquivo_nome TEXT,
      status TEXT NOT NULL DEFAULT 'processado',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  },
  {
    name: "bolsas",
    sql: `CREATE TABLE IF NOT EXISTS bolsas (
      id TEXT PRIMARY KEY,
      registro_id TEXT NOT NULL REFERENCES registros_diarios(id),
      agencia_id TEXT NOT NULL REFERENCES agencias(id),
      instituicao TEXT NOT NULL,
      doacao TEXT NOT NULL,
      componente TEXT NOT NULL,
      validade TEXT NOT NULL,
      abo TEXT NOT NULL,
      fator_rh TEXT NOT NULL,
      urgencia TEXT NOT NULL DEFAULT 'ok',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  },
  {
    name: "notificacoes",
    sql: `CREATE TABLE IF NOT EXISTS notificacoes (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      destinatario TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      enviado INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  },
];

console.log("Criando tabelas no Turso...\n");
for (const table of tables) {
  await execute(table.sql);
  console.log(`✓ Tabela '${table.name}' criada`);
}
console.log("\n✅ Banco de dados configurado com sucesso!");
