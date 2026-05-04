import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.perfil !== "admin") redirect("/dashboard");

  const pendentes = await db.query.usuarios.findMany({
    where: eq(usuarios.status, "pendente"),
  });

  const aprovados = await db.query.usuarios.findMany({
    where: eq(usuarios.status, "aprovado"),
  });

  const rejeitados = await db.query.usuarios.findMany({
    where: eq(usuarios.status, "rejeitado"),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Painel de Administração</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#16213e] rounded-xl border border-[#0f3460] p-5">
          <p className="text-gray-400 text-xs mb-1">Aprovações Pendentes</p>
          <p className="text-2xl font-bold text-yellow-400">{pendentes.length}</p>
          {pendentes.length > 0 && (
            <Link
              href="/admin/aprovacoes"
              className="text-xs text-[#C8102E] hover:underline mt-2 block"
            >
              Ver solicitações →
            </Link>
          )}
        </div>
        <div className="bg-[#16213e] rounded-xl border border-[#0f3460] p-5">
          <p className="text-gray-400 text-xs mb-1">Usuários Ativos</p>
          <p className="text-2xl font-bold text-green-400">{aprovados.length}</p>
        </div>
        <div className="bg-[#16213e] rounded-xl border border-[#0f3460] p-5">
          <p className="text-gray-400 text-xs mb-1">Acessos Rejeitados</p>
          <p className="text-2xl font-bold text-gray-500">{rejeitados.length}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Link
          href="/admin/aprovacoes"
          className="bg-[#C8102E] hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm"
        >
          Gerenciar Solicitações
        </Link>
        <Link
          href="/dashboard"
          className="bg-[#0f3460] hover:bg-[#0f3460]/70 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm"
        >
          Ver Dashboard
        </Link>
      </div>

      {aprovados.length > 0 && (
        <div className="bg-[#16213e] rounded-xl border border-[#0f3460] p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">
            Usuários com Acesso ({aprovados.length})
          </h3>
          <div className="space-y-2">
            {aprovados.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between text-sm py-2 border-b border-[#0f3460]/50 last:border-0"
              >
                <div>
                  <p className="text-white">{u.nome}</p>
                  <p className="text-gray-500 text-xs">{u.email}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full border border-[#0f3460] text-gray-400 capitalize">
                  {u.perfil}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
