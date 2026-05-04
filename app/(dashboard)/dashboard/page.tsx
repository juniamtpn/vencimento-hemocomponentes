import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { agencias, registrosDiarios, bolsas } from "@/lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import DashboardView from "./DashboardView";
import type { ResumoAgencia } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const hoje = format(
    toZonedTime(new Date(), "America/Sao_Paulo"),
    "yyyy-MM-dd"
  );

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

  type UrgCount = {
    vencido: number;
    hoje: number;
    amanha: number;
    "3dias": number;
    ok: number;
  };

  const registrosMap = new Map(registros.map((r) => [r.agenciaId, r]));
  const bolsasPorAgencia = new Map<string, UrgCount>();

  for (const bolsa of todasBolsas) {
    if (!bolsasPorAgencia.has(bolsa.agenciaId)) {
      bolsasPorAgencia.set(bolsa.agenciaId, {
        vencido: 0,
        hoje: 0,
        amanha: 0,
        "3dias": 0,
        ok: 0,
      });
    }
    const counts = bolsasPorAgencia.get(bolsa.agenciaId)!;
    counts[bolsa.urgencia as keyof UrgCount]++;
  }

  const resumos: ResumoAgencia[] = todasAgencias.map((agencia) => {
    const registro = registrosMap.get(agencia.id);
    const counts = bolsasPorAgencia.get(agencia.id) ?? {
      vencido: 0,
      hoje: 0,
      amanha: 0,
      "3dias": 0,
      ok: 0,
    };
    return {
      agencia,
      vencidos: counts.vencido,
      hoje: counts.hoje,
      amanha: counts.amanha,
      tresDias: counts["3dias"],
      ok: counts.ok,
      semArquivo: !registro || registro.status === "sem_arquivo",
      dataUltimoProcessamento: registro?.dataProcessamento ?? null,
    };
  });

  return (
    <DashboardView
      resumos={resumos}
      dataHoje={hoje}
      perfil={session.user.perfil}
    />
  );
}
