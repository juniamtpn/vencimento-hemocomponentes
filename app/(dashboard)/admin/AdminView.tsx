"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PendenteInfo {
  id: string;
  nome: string;
  email: string;
  agenciaNome: string;
  justificativa: string | null;
  createdAt: number;
}

interface UsuarioInfo {
  id: string;
  nome: string;
  email: string;
  agenciasLabel: string;
  agenciaIds: string[];
  perfil: "admin" | "viewer" | "lideranca";
  status: "aprovado" | "rejeitado";
}

interface AgenciaOption {
  id: string;
  nome: string;
  codigo: string;
}

interface Props {
  pendentes: PendenteInfo[];
  usuarios: UsuarioInfo[];
  agencias: AgenciaOption[];
}

const PERFIL_LABEL: Record<string, string> = {
  admin: "Admin",
  lideranca: "Liderança",
  viewer: "Viewer",
};

export default function AdminView({ pendentes, usuarios, agencias }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"pendentes" | "usuarios">(
    pendentes.length > 0 ? "pendentes" : "usuarios"
  );
  const [processing, setProcessing] = useState<string | null>(null);
  const [perfisAprov, setPerfisAprov] = useState<Record<string, string>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    email: "",
    perfil: "viewer",
    agenciaIds: [] as string[],
  });
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);

  async function aprovar(id: string) {
    setProcessing(id);
    await fetch(`/api/admin/aprovar/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfil: perfisAprov[id] ?? "viewer" }),
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

  function abrirEdicao(u: UsuarioInfo) {
    setEditandoId(u.id);
    setEditForm({
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      agenciaIds: u.agenciaIds,
    });
    setErroModal(null);
  }

  function toggleAgencia(agenciaId: string) {
    setEditForm((prev) => ({
      ...prev,
      agenciaIds: prev.agenciaIds.includes(agenciaId)
        ? prev.agenciaIds.filter((id) => id !== agenciaId)
        : [...prev.agenciaIds, agenciaId],
    }));
  }

  async function salvarEdicao() {
    if (!editandoId) return;
    setProcessing(editandoId);
    setErroModal(null);
    const res = await fetch(`/api/admin/usuarios/${editandoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      const data = await res.json();
      setErroModal(data.error ?? "Erro ao salvar.");
    } else {
      setEditandoId(null);
      router.refresh();
    }
    setProcessing(null);
  }

  async function excluir(id: string) {
    setProcessing(id);
    await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    setConfirmExcluir(null);
    setProcessing(null);
    router.refresh();
  }

  const nomeConfirmacao = confirmExcluir
    ? usuarios.find((u) => u.id === confirmExcluir)?.nome
    : null;

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("pendentes")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "pendentes"
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Solicitações
          {pendentes.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              {pendentes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("usuarios")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "usuarios"
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Usuários
          <span className="text-xs text-slate-400 font-normal">{usuarios.length}</span>
        </button>
      </div>

      {/* PENDENTES */}
      {tab === "pendentes" && (
        pendentes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <svg className="w-10 h-10 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-slate-500 text-sm font-medium">Nenhuma solicitação pendente</p>
            <p className="text-slate-400 text-xs mt-1">Todas as solicitações foram processadas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{u.nome}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{u.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                      <span className="text-xs text-slate-400">Agência: <span className="text-slate-600">{u.agenciaNome}</span></span>
                      <span className="text-xs text-slate-400">
                        {new Date(u.createdAt * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    {u.justificativa && (
                      <p className="text-slate-500 text-xs mt-3 italic border-l-2 border-slate-200 pl-2.5 leading-relaxed">
                        &ldquo;{u.justificativa}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 w-[160px] shrink-0">
                    <select
                      value={perfisAprov[u.id] ?? "viewer"}
                      onChange={(e) => setPerfisAprov({ ...perfisAprov, [u.id]: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="lideranca">Liderança</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => aprovar(u.id)}
                      disabled={processing === u.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {processing === u.id ? "Aprovando…" : "Aprovar"}
                    </button>
                    <button
                      onClick={() => rejeitar(u.id)}
                      disabled={processing === u.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                      {processing === u.id ? "Rejeitando…" : "Rejeitar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* USUARIOS */}
      {tab === "usuarios" && (
        usuarios.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-500 text-sm">Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">Usuário</th>
                    <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide hidden md:table-cell">Agências</th>
                    <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">Perfil</th>
                    <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{u.nome}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                        {u.agenciasLabel}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 text-slate-600">
                          {PERFIL_LABEL[u.perfil] ?? u.perfil}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          u.status === "aprovado"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-600 border border-red-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.status === "aprovado" ? "bg-green-500" : "bg-red-500"}`} />
                          {u.status === "aprovado" ? "Ativo" : "Rejeitado"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => abrirEdicao(u)}
                            title="Editar"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmExcluir(u.id)}
                            title="Excluir"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modal: Editar usuário */}
      {editandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditandoId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Editar usuário</h3>
              <button onClick={() => setEditandoId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Nome</label>
                <input
                  type="text"
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Perfil</label>
                <select
                  value={editForm.perfil}
                  onChange={(e) => setEditForm({ ...editForm, perfil: e.target.value, agenciaIds: [] })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="viewer">Viewer</option>
                  <option value="lideranca">Liderança</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Agency selection — multi for liderança, single for viewer */}
              {editForm.perfil === "lideranca" ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Agências</label>
                    {editForm.agenciaIds.length > 0 && (
                      <span className="text-[11px] text-slate-400">{editForm.agenciaIds.length} selecionada{editForm.agenciaIds.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {agencias.map((a) => {
                      const checked = editForm.agenciaIds.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                            checked ? "bg-slate-100" : "hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAgencia(a.id)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-slate-700 accent-slate-700"
                          />
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{a.codigo}</span>
                            {a.nome !== a.codigo && (
                              <span className="text-slate-400"> — {a.nome}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Agência</label>
                  <select
                    value={editForm.agenciaIds[0] ?? ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        agenciaIds: e.target.value ? [e.target.value] : [],
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">Nenhuma</option>
                    {agencias.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome !== a.codigo ? `${a.codigo} — ${a.nome}` : a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {erroModal && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {erroModal}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditandoId(null)}
                disabled={processing === editandoId}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={processing === editandoId}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing === editandoId ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar exclusão */}
      {confirmExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmExcluir(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Excluir usuário</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Tem certeza que deseja excluir <span className="font-medium text-slate-700">{nomeConfirmacao}</span>? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmExcluir(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => excluir(confirmExcluir)}
                disabled={processing === confirmExcluir}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing === confirmExcluir ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
