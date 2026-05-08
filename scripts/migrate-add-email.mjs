// Adds lideranca_email column and seeds all agencies + pre-registers liderancas
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
        { type: "execute", stmt: { sql, args: args.map((v) => v === null ? { type: "null" } : { type: "text", value: String(v) }) } },
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
  return data;
}

const AGENCIAS = [
  { nome: "HUSC", codigo: "HUSC", liderancaNome: "Alessandra", liderancaEmail: "alessandra@vitahemoterapia.com.br", liderancaTelefone: "31984841831" },
  { nome: "HUB", codigo: "HUB", liderancaNome: "Alessandra", liderancaEmail: "alessandra@vitahemoterapia.com.br", liderancaTelefone: "31984841831" },
  { nome: "HIO", codigo: "HIO", liderancaNome: "Amanda", liderancaEmail: "amanda.rodrigues@vitahemoterapia.com.br", liderancaTelefone: "31988237731" },
  { nome: "HBH", codigo: "HBH", liderancaNome: "Amanda", liderancaEmail: "amanda.rodrigues@vitahemoterapia.com.br", liderancaTelefone: "31988237731" },
  { nome: "HL", codigo: "HL", liderancaNome: "Ana Carolina", liderancaEmail: "ana.gontijo@pulsa-mg.com.br", liderancaTelefone: "31991112277" },
  { nome: "HMDBC", codigo: "HMDBC", liderancaNome: "Ana Carolina", liderancaEmail: "ana.gontijo@pulsa-mg.com.br", liderancaTelefone: "31991112277" },
  { nome: "HVS", codigo: "HVS", liderancaNome: "Ana Paula", liderancaEmail: "paula.gomes@pulsa-mg.com.br", liderancaTelefone: "31998364361" },
  { nome: "HMON", codigo: "HMON", liderancaNome: "Ana Paula", liderancaEmail: "paula.gomes@pulsa-mg.com.br", liderancaTelefone: "31998364361" },
  { nome: "HSR", codigo: "HSR", liderancaNome: "Ana Paula", liderancaEmail: "paula.gomes@pulsa-mg.com.br", liderancaTelefone: "31998364361" },
  { nome: "HSCU Ub", codigo: "HSCU_UB", liderancaNome: "Beatriz", liderancaEmail: "beatriz.santos@vitahemoterapia.com.br", liderancaTelefone: "34996917919" },
  { nome: "HSG Ub", codigo: "HSG_UB", liderancaNome: "Beatriz", liderancaEmail: "beatriz.santos@vitahemoterapia.com.br", liderancaTelefone: "34996917919" },
  { nome: "HMDC", codigo: "HMDC", liderancaNome: "João", liderancaEmail: "joao.henrique@vitahemoterapia.com.br", liderancaTelefone: "31988575413" },
  { nome: "HMDSA", codigo: "HMDSA", liderancaNome: "João", liderancaEmail: "joao.henrique@vitahemoterapia.com.br", liderancaTelefone: "31988575413" },
  { nome: "HMDNL", codigo: "HMDNL", liderancaNome: "João", liderancaEmail: "joao.henrique@vitahemoterapia.com.br", liderancaTelefone: "31988575413" },
  { nome: "HDMU", codigo: "HDMU", liderancaNome: "Juana", liderancaEmail: "juana.sousa@pulsa-mg.com.br", liderancaTelefone: "31997595500" },
  { nome: "HUC", codigo: "HUC", liderancaNome: "Juana", liderancaEmail: "juana.sousa@pulsa-mg.com.br", liderancaTelefone: "31997595500" },
  { nome: "HLC", codigo: "HLC", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "HVC", codigo: "HVC", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "HSE", codigo: "HSE", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "HS", codigo: "HS", liderancaNome: "Raquel Villas Boas", liderancaEmail: "raquel.vilasboas@pulsa-mg.com.br", liderancaTelefone: "31986234137" },
  { nome: "UMC Ub", codigo: "UMC_UB", liderancaNome: "Raquel Miranda", liderancaEmail: "raquel.miranda@pulsa-mg.com.br", liderancaTelefone: "31990786976" },
  { nome: "Madrecor Ub", codigo: "MADRECOR_UB", liderancaNome: "Raquel Miranda", liderancaEmail: "raquel.miranda@pulsa-mg.com.br", liderancaTelefone: "31990786976" },
  { nome: "HFR", codigo: "HFR", liderancaNome: "Samara", liderancaEmail: "samara.santos@pulsa-mg.com.br", liderancaTelefone: "31989168728" },
  { nome: "HSL", codigo: "HSL", liderancaNome: "Samara", liderancaEmail: "samara.santos@pulsa-mg.com.br", liderancaTelefone: "31989168728" },
  { nome: "HMT", codigo: "HMT", liderancaNome: "Evelin", liderancaEmail: "evelin.viana@pulsa-mg.com.br", liderancaTelefone: "31992543425" },
];

const LIDERANCAS = [
  { nome: "Alessandra", email: "alessandra@vitahemoterapia.com.br" },
  { nome: "Amanda", email: "amanda.rodrigues@vitahemoterapia.com.br" },
  { nome: "Ana Carolina", email: "ana.gontijo@pulsa-mg.com.br" },
  { nome: "Ana Paula", email: "paula.gomes@pulsa-mg.com.br" },
  { nome: "Beatriz", email: "beatriz.santos@vitahemoterapia.com.br" },
  { nome: "João", email: "joao.henrique@vitahemoterapia.com.br" },
  { nome: "Juana", email: "juana.sousa@pulsa-mg.com.br" },
  { nome: "Raquel Villas Boas", email: "raquel.vilasboas@pulsa-mg.com.br" },
  { nome: "Raquel Miranda", email: "raquel.miranda@pulsa-mg.com.br" },
  { nome: "Samara", email: "samara.santos@pulsa-mg.com.br" },
  { nome: "Evelin", email: "evelin.viana@pulsa-mg.com.br" },
];

// 1. Add column (ignore if already exists)
console.log("1. Adicionando coluna lideranca_email...");
try {
  await execute("ALTER TABLE agencias ADD COLUMN lideranca_email TEXT");
  console.log("   ✓ Coluna adicionada");
} catch (e) {
  if (e.message.includes("duplicate column")) {
    console.log("   ✓ Coluna já existe");
  } else {
    throw e;
  }
}

// 2. Upsert all agencies
console.log("\n2. Inserindo/atualizando agências...");
for (const ag of AGENCIAS) {
  // Try insert first, if conflicts update the record
  await execute(
    `INSERT INTO agencias (id, nome, codigo, lideranca_nome, lideranca_email, lideranca_telefone, onedrive_folder_id)
     VALUES (?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(codigo) DO UPDATE SET
       nome = excluded.nome,
       lideranca_nome = excluded.lideranca_nome,
       lideranca_email = excluded.lideranca_email,
       lideranca_telefone = excluded.lideranca_telefone`,
    [nanoid(), ag.nome, ag.codigo, ag.liderancaNome, ag.liderancaEmail, ag.liderancaTelefone]
  );
  console.log(`   ✓ ${ag.nome}`);
}

// 3. Pre-register all liderancas as approved users
console.log("\n3. Pré-cadastrando responsáveis...");
for (const l of LIDERANCAS) {
  await execute(
    `INSERT INTO usuarios (id, email, nome, agencia_id, perfil, status)
     VALUES (?, ?, ?, NULL, 'lideranca', 'aprovado')
     ON CONFLICT(email) DO UPDATE SET
       nome = excluded.nome,
       perfil = 'lideranca',
       status = 'aprovado'`,
    [nanoid(), l.email, l.nome]
  );
  console.log(`   ✓ ${l.nome} (${l.email})`);
}

console.log("\n✅ Migração concluída com sucesso!");
