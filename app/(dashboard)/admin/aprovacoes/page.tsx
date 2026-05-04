import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios, agencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AprovacaoList from "./AprovacaoList";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.perfil !== "admin") redirect("/dashboard");

  const pendentes = await db.query.usuarios.findMany({
    where: eq(usuarios.status, "pendente"),
  });

  const todasAgencias = await db.query.agencias.findMany();
  const agenciasMap = new Map(todasAgencias.map((a) => [a.id, a.nome]));

  const pendentesEnriquecidos = pendentes.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    agenciaNome: u.agenciaId ? (agenciasMap.get(u.agenciaId) ?? "—") : "—",
    justificativa: u.justificativa,
    createdAt: u.createdAt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Solicitações de Acesso
          </h2>
          <p className="text-gray-400 text-sm">
            {pendentesEnriquecidos.length} pendente
            {pendentesEnriquecidos.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <AprovacaoList usuarios={pendentesEnriquecidos} />
    </div>
  );
}
