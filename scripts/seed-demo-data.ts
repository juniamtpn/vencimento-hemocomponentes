import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const db = drizzle(client, { schema });

const hoje = new Date().toISOString().split("T")[0];

function addDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

type Urgencia = "vencido" | "hoje" | "amanha" | "3dias" | "ok";

const COMPONENTES = [
  "Concentrado de Hemácias",
  "Plaquetas",
  "Plasma Fresco Congelado",
  "Crioprecipitado",
  "Concentrado de Granulócitos",
];

const TIPOS_ABO = ["A", "B", "AB", "O"];
const TIPOS_RH = ["+", "-"];

function gerarBolsas(n: number): {
  instituicao: string;
  doacao: string;
  componente: string;
  validade: string;
  abo: string;
  fatorRh: string;
  urgencia: Urgencia;
}[] {
  const bolsas = [];
  const urgencias: { dias: number; urgencia: Urgencia }[] = [
    { dias: -2, urgencia: "vencido" },
    { dias: -1, urgencia: "vencido" },
    { dias: 0, urgencia: "hoje" },
    { dias: 1, urgencia: "amanha" },
    { dias: 2, urgencia: "3dias" },
    { dias: 3, urgencia: "3dias" },
    { dias: 7, urgencia: "ok" },
    { dias: 14, urgencia: "ok" },
    { dias: 30, urgencia: "ok" },
    { dias: 35, urgencia: "ok" },
  ];

  for (let i = 0; i < n; i++) {
    const u = urgencias[i % urgencias.length];
    const abo = TIPOS_ABO[i % TIPOS_ABO.length];
    const rh = TIPOS_RH[i % TIPOS_RH.length];
    const comp = COMPONENTES[i % COMPONENTES.length];
    bolsas.push({
      instituicao: "HEMOTE",
      doacao: `DOA${String(10000 + i).padStart(5, "0")}`,
      componente: comp,
      validade: addDias(u.dias),
      abo,
      fatorRh: rh,
      urgencia: u.urgencia,
    });
  }
  return bolsas;
}

async function seedDemoData() {
  console.log(`📅 Inserindo dados de demonstração para ${hoje}...\n`);

  const todasAgencias = await db.query.agencias.findMany();

  // Seleciona 8 agências para ter dados (as demais ficam sem arquivo)
  const agenciasComDados = todasAgencias.slice(0, 8);

  for (const ag of agenciasComDados) {
    const qtd = 8 + Math.floor(Math.random() * 12);
    const bolsas = gerarBolsas(qtd);

    const registroId = nanoid();
    await db.insert(schema.registrosDiarios).values({
      id: registroId,
      agenciaId: ag.id,
      dataProcessamento: hoje,
      totalBolsas: bolsas.length,
      arquivoNome: `relatorio_${ag.codigo}_${hoje}.xlsx`,
      status: "processado",
    });

    for (const b of bolsas) {
      await db.insert(schema.bolsas).values({
        id: nanoid(),
        registroId,
        agenciaId: ag.id,
        ...b,
      });
    }

    const v = bolsas.filter((b) => b.urgencia === "vencido").length;
    const h = bolsas.filter((b) => b.urgencia === "hoje").length;
    const a = bolsas.filter((b) => b.urgencia === "amanha").length;
    console.log(
      `  ✓ ${ag.nome}: ${bolsas.length} bolsas (${v} venc. | ${h} hoje | ${a} amanhã)`
    );
  }

  console.log(`\n✅ Dados de demo inseridos para ${agenciasComDados.length} agências.`);
  console.log(`   As demais ${todasAgencias.length - agenciasComDados.length} agências ficaram sem arquivo (para demonstrar o alerta).`);
  client.close();
}

seedDemoData().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
