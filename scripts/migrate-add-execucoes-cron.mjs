import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

console.log("Criando tabela execucoes_cron...");
await client.execute(`
  CREATE TABLE IF NOT EXISTS execucoes_cron (
    id TEXT PRIMARY KEY,
    iniciado_em INTEGER NOT NULL,
    finalizado_em INTEGER,
    triggered_by TEXT NOT NULL DEFAULT 'cron',
    status TEXT NOT NULL,
    total_agencias INTEGER NOT NULL DEFAULT 0,
    processadas INTEGER NOT NULL DEFAULT 0,
    sem_arquivo INTEGER NOT NULL DEFAULT 0,
    erros INTEGER NOT NULL DEFAULT 0,
    detalhes TEXT,
    mensagem_erro TEXT
  )
`);
console.log("✅ Tabela execucoes_cron criada com sucesso!");
client.close();
