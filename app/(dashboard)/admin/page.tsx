import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios, agencias, usuarioAgencias } from "@/lib/db/schema";
import { eq, ne } from "drizzle-orm";
import Link from "next/link";
import AdminView from "./AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.perfil !== "admin") redirect("/dashboard");

  const [pendentes, naoP, todasAgencias, todasRelacoes] = await Promise.all([
    db.query.usuarios.findMany({ where: eq(usuarios.status, "pendente") }),
    db.query.usuarios.findMany({ where: ne(usuarios.status, "pendente") }),
    db.query.agencias.findMany(),
    db.query.usuarioAgencias.findMany(),
  ]);

  const agenciasMap = new Map(todasAgencias.map((a) => [a.id, a]));
  const usuariosAdminMap = new Map([...pendentes, ...naoP].map((u) => [u.id, u]));

  // usuarioId → agenciaId[]
  const relacoesPorUsuario = new Map<string, string[]>();
  // agenciaId → first usuarioId (primary responsible)
  const responsavelPorAgencia = new Map<string, string>();
  for (const rel of todasRelacoes) {
    const lista = relacoesPorUsuario.get(rel.usuarioId) ?? [];
    lista.push(rel.agenciaId);
    relacoesPorUsuario.set(rel.usuarioId, lista);
    if (!responsavelPorAgencia.has(rel.agenciaId)) {
      responsavelPorAgencia.set(rel.agenciaId, rel.usuarioId);
    }
  }

  const pendentesInfo = pendentes.map((u) => {
    const agIds = relacoesPorUsuario.get(u.id) ?? [];
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      agenciaNome: agIds.length > 0 ? (agenciasMap.get(agIds[0])?.nome ?? "—") : "—",
      justificativa: u.justificativa,
      createdAt: u.createdAt,
    };
  });

  const usuariosInfo = naoP.map((u) => {
    const agenciaIds = relacoesPorUsuario.get(u.id) ?? [];
    const agenciasLabel = agenciaIds.length === 0
      ? "—"
      : agenciaIds.map((id) => agenciasMap.get(id)?.codigo ?? id).join(", ");
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      telefone: u.telefone ?? null,
      agenciasLabel,
      agenciaIds,
      perfil: u.perfil as "admin" | "viewer" | "lideranca",
      status: u.status as "aprovado" | "rejeitado",
    };
  });

  const agenciasOptions = todasAgencias.map((a) => {
    const responsavelId = responsavelPorAgencia.get(a.id) ?? null;
    const responsavel = responsavelId ? usuariosAdminMap.get(responsavelId) : null;
    return {
      id: a.id,
      nome: a.nome,
      codigo: a.codigo,
      liderancaNome: responsavel?.nome ?? null,
      responsavelId,
    };
  });

  const ativos = naoP.filter((u) => u.status === "aprovado").length;
  const rejeitados = naoP.filter((u) => u.status === "rejeitado").length;

  return (
    <div className="max-w-screen-xl mx-auto px-5 py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 font-medium">Administração</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Painel de Administração</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gerencie acessos e usuários do sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Pendentes</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{pendentes.length}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Ativos</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{ativos}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rejeitados</p>
          <p className="text-3xl font-bold text-slate-600 mt-1">{rejeitados}</p>
        </div>
      </div>

      <AdminView
        pendentes={pendentesInfo}
        usuarios={usuariosInfo}
        agencias={agenciasOptions}
      />
    </div>
  );
}
