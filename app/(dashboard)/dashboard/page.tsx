import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { agencias, registrosDiarios, bolsas } from "@/lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import DashboardView from "./DashboardView";
import type { BolsaEnriquecida, AgenciaStatus, LiderancaInfo } from "./types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const hoje = format(toZonedTime(new Date(), "America/Sao_Paulo"), "yyyy-MM-dd");

  const todasAgencias = await db.query.agencias.findMany({
    orderBy: asc(agencias.nome),
  });

  const registros = await db.query.registrosDiarios.findMany({
    where: eq(registrosDiarios.dataProcessamento, hoje),
  });

  const registroIds = registros.map((r) => r.id);

  const todasBolsas =
    registroIds.length > 0
      ? await db.query.bolsas.findMany({
          where: inArray(bolsas.registroId, registroIds),
        })
      : [];

  const agenciasMap = new Map(todasAgencias.map((a) => [a.id, a]));
  const registrosMap = new Map(registros.map((r) => [r.agenciaId, r]));

  // Enrich bolsas with agency + liderança info
  const bolsasEnriquecidas: BolsaEnriquecida[] = todasBolsas.map((b) => {
    const ag = agenciasMap.get(b.agenciaId)!;
    return {
      id: b.id,
      agenciaId: b.agenciaId,
      agenciaCodigo: ag.codigo,
      agenciaNome: ag.nome,
      liderancaNome: ag.liderancaNome,
      liderancaTelefone: ag.liderancaTelefone ?? null,
      instituicao: b.instituicao,
      doacao: b.doacao,
      componente: b.componente,
      abo: b.abo,
      fatorRh: b.fatorRh,
      validade: b.validade,
      urgencia: b.urgencia,
    };
  });

  // Agency upload status
  const agenciasStatus: AgenciaStatus[] = todasAgencias.map((ag) => {
    const reg = registrosMap.get(ag.id);
    return {
      id: ag.id,
      nome: ag.nome,
      codigo: ag.codigo,
      liderancaNome: ag.liderancaNome,
      liderancaTelefone: ag.liderancaTelefone ?? null,
      status: (reg?.status ?? "sem_arquivo") as AgenciaStatus["status"],
      totalBolsas: reg?.totalBolsas ?? 0,
      arquivoNome: reg?.arquivoNome ?? null,
      tipoEnvio: (reg?.tipoEnvio ?? null) as AgenciaStatus["tipoEnvio"],
      enviadoPor: reg?.enviadoPor ?? null,
      createdAt: reg?.createdAt ?? null,
    };
  });

  // Group by liderança
  const liderancasMap = new Map<string, LiderancaInfo>();
  for (const ag of todasAgencias) {
    if (!liderancasMap.has(ag.liderancaNome)) {
      liderancasMap.set(ag.liderancaNome, {
        nome: ag.liderancaNome,
        telefone: ag.liderancaTelefone ?? null,
        email: ag.liderancaEmail ?? null,
        agencias: [],
        enviadas: 0,
        total: 0,
      });
    }
    const l = liderancasMap.get(ag.liderancaNome)!;
    const reg = registrosMap.get(ag.id);
    const status = (reg?.status ?? "sem_arquivo") as AgenciaStatus["status"];
    l.agencias.push({
      id: ag.id,
      codigo: ag.codigo,
      nome: ag.nome,
      status,
      totalBolsas: reg?.totalBolsas ?? 0,
    });
    l.total++;
    if (status === "processado") l.enviadas++;
  }

  const liderancas = Array.from(liderancasMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome)
  );

  return (
    <DashboardView
      bolsas={bolsasEnriquecidas}
      agenciasStatus={agenciasStatus}
      liderancas={liderancas}
      dataHoje={hoje}
      perfil={session.user.perfil}
    />
  );
}
