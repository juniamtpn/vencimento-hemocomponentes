"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UsuarioPendente {
  id: string;
  nome: string;
  email: string;
  agenciaNome: string;
  justificativa: string | null;
  createdAt: number;
}

export default function AprovacaoList({
  usuarios,
}: {
  usuarios: UsuarioPendente[];
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [perfis, setPerfis] = useState<Record<string, string>>({});

  async function aprovar(id: string) {
    setProcessing(id);
    await fetch(`/api/admin/aprovar/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfil: perfis[id] ?? "viewer" }),
    });
    setProcessing(null);
    router.refresh();
  }

  async function rejeitar(id: string) {
    setProcessing(id);
    await fetch(`/api/admin/rejeitar/${id}`, { method: "POST" });
    setProcessing(null);
    router.refresh();
  }

  if (usuarios.length === 0) {
    return (
      <div className="bg-[#16213e] rounded-xl border border-[#0f3460] p-10 text-center">
        <p className="text-2xl mb-2">✓</p>
        <p className="text-gray-500 text-sm">
          Nenhuma solicitação pendente no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {usuarios.map((u) => (
        <div
          key={u.id}
          className="bg-[#16213e] rounded-xl border border-[#0f3460] p-5"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold">{u.nome}</p>
              <p className="text-gray-400 text-sm">{u.email}</p>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                <span>Agência: {u.agenciaNome}</span>
                <span>
                  {new Date(u.createdAt * 1000).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {u.justificativa && (
                <p className="text-gray-400 text-sm mt-3 italic border-l-2 border-[#0f3460] pl-3">
                  &ldquo;{u.justificativa}&rdquo;
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 min-w-[170px]">
              <select
                value={perfis[u.id] ?? "viewer"}
                onChange={(e) =>
                  setPerfis({ ...perfis, [u.id]: e.target.value })
                }
                className="bg-[#1a1a2e] border border-[#0f3460] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#C8102E]"
              >
                <option value="viewer">Viewer</option>
                <option value="lideranca">Liderança</option>
                <option value="admin">Admin</option>
              </select>

              <button
                onClick={() => aprovar(u.id)}
                disabled={processing === u.id}
                className="bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
              >
                {processing === u.id ? "..." : "✓ Aprovar"}
              </button>

              <button
                onClick={() => rejeitar(u.id)}
                disabled={processing === u.id}
                className="bg-transparent hover:bg-red-900/30 disabled:opacity-40 text-red-400 text-xs font-semibold py-1.5 px-3 rounded-lg border border-red-900 transition-colors"
              >
                {processing === u.id ? "..." : "✕ Rejeitar"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
