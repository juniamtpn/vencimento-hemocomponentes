export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    await runMigrations();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

async function runMigrations() {
  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
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
    client.close();
    console.log("[Migration] execucoes_cron OK");
  } catch (e) {
    console.error("[Migration] Erro ao criar tabela execucoes_cron:", e);
  }
}
