"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fmtTelefone } from "@/lib/format";

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
  telefone: string | null;
  agenciasLabel: string;
  agenciaIds: string[];
  perfil: "admin" | "viewer" | "lideranca";
  status: "aprovado" | "rejeitado";
}

interface AgenciaOption {
  id: string;
  nome: string;
  codigo: string;
  liderancaNome: string | null;
  responsavelId: string | null;
}

interface ExecucaoInfo {
  id: string;
  iniciadoEm: number;
  finalizadoEm: number | null;
  triggeredBy: "cron" | "manual";
  status: "sucesso" | "parcial" | "erro" | "erro_fatal";
  totalAgencias: number;
  processadas: number;
  semArquivo: number;
  erros: number;
  detalhes: string | null;
  mensagemErro: string | null;
}

interface Props {
  pendentes: PendenteInfo[];
  usuarios: UsuarioInfo[];
  agencias: AgenciaOption[];
  execucoes: ExecucaoInfo[];
}

const PERFIL_LABEL: Record<string, string> = { admin: "Admin", lideranca: "Liderança", viewer: "Viewer" };

type Tab = "pendentes" | "usuarios" | "agencias" | "execucoes";

export default function AdminView({ pendentes, usuarios, agencias, execucoes }: Props) {
  const router = useRouter();

  // ── tabs ──────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>(pendentes.length > 0 ? "pendentes" : "usuarios");

  // ── search ────────────────────────────────────────────────
  const [searchUsuarios, setSearchUsuarios] = useState("");
  const [searchAgencias, setSearchAgencias] = useState("");

  // ── users state ───────────────────────────────────────────
  const [processing, setProcessing] = useState<string | null>(null);
  const [perfisAprov, setPerfisAprov] = useState<Record<string, string>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", telefone: "", perfil: "viewer" });
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // ── execucoes state ───────────────────────────────────────
  const [expandedExecucao, setExpandedExecucao] = useState<string | null>(null);

  const toggleExecucao = useCallback((id: string) => {
    setExpandedExecucao((prev) => (prev === id ? null : id));
  }, []);

  // ── agencies state ────────────────────────────────────────
  const [agenciasList, setAgenciasList] = useState<AgenciaOption[]>(agencias);
  const [processingAg, setProcessingAg] = useState(false);
  const [criandoAgencia, setCriandoAgencia] = useState(false);
  const [editandoAgenciaId, setEditandoAgenciaId] = useState<string | null>(null);
  const [confirmExcluirAgenciaId, setConfirmExcluirAgenciaId] = useState<string | null>(null);
  const [agenciaForm, setAgenciaForm] = useState({ codigo: "", nome: "", responsavelId: "" });
  const [erroAgencia, setErroAgencia] = useState<string | null>(null);

  // ── derived ───────────────────────────────────────────────
  const liderancaUsers = useMemo(
    () => usuarios.filter((u) => u.perfil === "lideranca" && u.status === "aprovado"),
    [usuarios]
  );

  const usuariosFiltrados = useMemo(() => {
    const q = searchUsuarios.toLowerCase();
    return q
      ? usuarios.filter((u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : usuarios;
  }, [usuarios, searchUsuarios]);

  const agenciasFiltradas = useMemo(() => {
    const q = searchAgencias.toLowerCase();
    return q
      ? agenciasList.filter((a) => a.codigo.toLowerCase().includes(q) || a.nome.toLowerCase().includes(q) || (a.liderancaNome ?? "").toLowerCase().includes(q))
      : agenciasList;
  }, [agenciasList, searchAgencias]);

  // ── user helpers ──────────────────────────────────────────
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

  async function reativar(id: string) {
    setProcessing(id);
    await fetch(`/api/admin/reativar/${id}`, { method: "POST" });
    setProcessing(null);
    router.refresh();
  }

  function abrirEdicaoUsuario(u: UsuarioInfo) {
    setEditandoId(u.id);
    setEditForm({ nome: u.nome, email: u.email, telefone: u.telefone ?? "", perfil: u.perfil });
    setErroModal(null);
  }

  async function salvarEdicaoUsuario() {
    if (!editandoId) return;
    setProcessing(editandoId);
    setErroModal(null);
    const res = await fetch(`/api/admin/usuarios/${editandoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, telefone: editForm.telefone || null }),
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

  async function excluirUsuario(id: string) {
    setProcessing(id);
    await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    setConfirmExcluir(null);
    setProcessing(null);
    router.refresh();
  }

  // ── agency helpers ────────────────────────────────────────
  function abrirCriarAgencia() {
    setAgenciaForm({ codigo: "", nome: "", responsavelId: "" });
    setErroAgencia(null);
    setCriandoAgencia(true);
  }

  function abrirEdicaoAgencia(ag: AgenciaOption) {
    setAgenciaForm({
      codigo: ag.codigo,
      nome: ag.nome === ag.codigo ? "" : ag.nome,
      responsavelId: ag.responsavelId ?? "",
    });
    setErroAgencia(null);
    setEditandoAgenciaId(ag.id);
  }

  async function salvarAgencia() {
    setProcessingAg(true);
    setErroAgencia(null);
    const isEdit = !!editandoAgenciaId;
    const url = isEdit ? `/api/admin/agencias/${editandoAgenciaId}` : "/api/admin/agencias";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: agenciaForm.codigo.trim().toUpperCase(),
        nome: agenciaForm.nome.trim() || agenciaForm.codigo.trim().toUpperCase(),
        responsavelId: agenciaForm.responsavelId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setErroAgencia(data.error ?? "Erro ao salvar.");
    } else {
      const data = await res.json();
      if (isEdit) {
        setAgenciasList((prev) =>
          prev.map((ag) => ag.id === editandoAgenciaId ? { ...ag, ...data.agencia } : ag)
        );
        setEditandoAgenciaId(null);
      } else {
        setAgenciasList((prev) =>
          [...prev, data.agencia].sort((a, b) => a.codigo.localeCompare(b.codigo))
        );
        setCriandoAgencia(false);
      }
    }
    setProcessingAg(false);
  }

  async function excluirAgencia(id: string) {
    setProcessingAg(true);
    const res = await fetch(`/api/admin/agencias/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setErroAgencia(data.error ?? "Erro ao excluir.");
    } else {
      setAgenciasList((prev) => prev.filter((ag) => ag.id !== id));
      setConfirmExcluirAgenciaId(null);
    }
    setProcessingAg(false);
  }

  const nomeConfirmacaoUsuario = confirmExcluir ? usuarios.find((u) => u.id === confirmExcluir)?.nome : null;
  const agenciaParaExcluir = confirmExcluirAgenciaId ? agenciasList.find((a) => a.id === confirmExcluirAgenciaId) : null;

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <TabButton active={tab === "pendentes"} onClick={() => setTab("pendentes")}>
          Solicitações
          {pendentes.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              {pendentes.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "usuarios"} onClick={() => setTab("usuarios")}>
          Usuários
          <span className="text-xs text-slate-400 font-normal">{usuarios.length}</span>
        </TabButton>
        <TabButton active={tab === "agencias"} onClick={() => setTab("agencias")}>
          Agências
          <span className="text-xs text-slate-400 font-normal">{agenciasList.length}</span>
        </TabButton>
        <TabButton active={tab === "execucoes"} onClick={() => setTab("execucoes")}>
          Execuções
          <span className="text-xs text-slate-400 font-normal">{execucoes.length}</span>
        </TabButton>
      </div>

      {/* ── PENDENTES ─────────────────────────────────────── */}
      {tab === "pendentes" && (
        pendentes.length === 0 ? (
          <EmptyState icon="check" title="Nenhuma solicitação pendente" sub="Todas as solicitações foram processadas." />
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
                    <button onClick={() => aprovar(u.id)} disabled={processing === u.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {processing === u.id ? "Aprovando…" : "Aprovar"}
                    </button>
                    <button onClick={() => rejeitar(u.id)} disabled={processing === u.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
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

      {/* ── USUÁRIOS ──────────────────────────────────────── */}
      {tab === "usuarios" && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchUsuarios}
              onChange={(e) => setSearchUsuarios(e.target.value)}
              placeholder="Buscar por nome ou email…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {usuariosFiltrados.length === 0 ? (
            <EmptyState icon="user" title={searchUsuarios ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <Th>Usuário</Th>
                      <Th className="hidden md:table-cell">Agências</Th>
                      <Th>Perfil</Th>
                      <Th>Status</Th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuariosFiltrados.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{u.nome}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                          {u.telefone && <p className="text-xs text-slate-400 mt-0.5">{fmtTelefone(u.telefone)}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{u.agenciasLabel}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 text-slate-600">
                            {PERFIL_LABEL[u.perfil] ?? u.perfil}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {u.status === "rejeitado" && (
                              <button
                                onClick={() => reativar(u.id)}
                                disabled={processing === u.id}
                                title="Reativar acesso"
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                              </button>
                            )}
                            <IconButton title="Editar" onClick={() => abrirEdicaoUsuario(u)}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </IconButton>
                            <IconButton title="Excluir" danger onClick={() => setConfirmExcluir(u.id)}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AGÊNCIAS ──────────────────────────────────────── */}
      {tab === "agencias" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={searchAgencias}
                onChange={(e) => setSearchAgencias(e.target.value)}
                placeholder="Buscar por sigla, nome ou responsável…"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <button onClick={abrirCriarAgencia}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nova agência
            </button>
          </div>

          {agenciasFiltradas.length === 0 ? (
            <EmptyState icon="building" title={searchAgencias ? "Nenhuma agência encontrada." : "Nenhuma agência cadastrada."} sub={!searchAgencias ? 'Clique em "Nova agência" para começar.' : undefined} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <Th>Sigla</Th>
                      <Th>Nome</Th>
                      <Th className="hidden md:table-cell">Responsável</Th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agenciasFiltradas.map((ag) => (
                      <tr key={ag.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-slate-800 text-[13px]">{ag.codigo}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {ag.nome && ag.nome !== ag.codigo ? ag.nome : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                          {ag.liderancaNome || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <IconButton title="Editar" onClick={() => abrirEdicaoAgencia(ag)}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </IconButton>
                            <IconButton title="Excluir" danger onClick={() => { setErroAgencia(null); setConfirmExcluirAgenciaId(ag.id); }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: editar usuário ─────────────────────────── */}
      {editandoId && (
        <Modal onClose={() => setEditandoId(null)} title="Editar usuário">
          <div className="space-y-3">
            <Field label="Nome">
              <input type="text" value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className={inputCls} />
            </Field>
            <Field label="Telefone">
              <input type="tel" value={editForm.telefone}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                placeholder="Ex: 31999990000"
                className={inputCls} />
            </Field>
            <Field label="Perfil">
              <select value={editForm.perfil}
                onChange={(e) => setEditForm({ ...editForm, perfil: e.target.value })}
                className={inputCls}>
                <option value="viewer">Viewer</option>
                <option value="lideranca">Liderança</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          {erroModal && <ErrorBox msg={erroModal} />}
          <ModalFooter
            onCancel={() => setEditandoId(null)}
            onConfirm={salvarEdicaoUsuario}
            loading={processing === editandoId}
            cancelDisabled={processing === editandoId}
          />
        </Modal>
      )}

      {/* ── Modal: criar / editar agência ────────────────── */}
      {(criandoAgencia || !!editandoAgenciaId) && (
        <Modal
          onClose={() => { setCriandoAgencia(false); setEditandoAgenciaId(null); }}
          title={editandoAgenciaId ? "Editar agência" : "Nova agência"}
        >
          <div className="space-y-3">
            <Field label="Sigla *">
              <input type="text" value={agenciaForm.codigo}
                onChange={(e) => setAgenciaForm({ ...agenciaForm, codigo: e.target.value })}
                placeholder="Ex: HMT"
                className={inputCls}
                autoFocus />
              <p className="text-[11px] text-slate-400 mt-1">Identificador usado no sistema. Será convertido para maiúsculas.</p>
            </Field>
            <Field label="Nome">
              <input type="text" value={agenciaForm.nome}
                onChange={(e) => setAgenciaForm({ ...agenciaForm, nome: e.target.value })}
                placeholder="Opcional — preencha depois se preferir"
                className={inputCls} />
            </Field>
            <Field label="Responsável">
              <select value={agenciaForm.responsavelId}
                onChange={(e) => setAgenciaForm({ ...agenciaForm, responsavelId: e.target.value })}
                className={inputCls}>
                <option value="">Sem responsável</option>
                {liderancaUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Exibe apenas usuários com perfil Liderança e status Ativo.</p>
            </Field>
          </div>
          {erroAgencia && <ErrorBox msg={erroAgencia} />}
          <ModalFooter
            onCancel={() => { setCriandoAgencia(false); setEditandoAgenciaId(null); }}
            onConfirm={salvarAgencia}
            loading={processingAg}
            confirmLabel={editandoAgenciaId ? "Salvar alterações" : "Criar agência"}
            confirmDisabled={!agenciaForm.codigo.trim()}
          />
        </Modal>
      )}

      {/* ── Modal: excluir usuário ────────────────────────── */}
      {confirmExcluir && (
        <ConfirmDeleteModal
          title="Excluir usuário"
          description={<>Tem certeza que deseja excluir <span className="font-medium text-slate-700">{nomeConfirmacaoUsuario}</span>? Esta ação não pode ser desfeita.</>}
          loading={processing === confirmExcluir}
          onCancel={() => setConfirmExcluir(null)}
          onConfirm={() => excluirUsuario(confirmExcluir)}
        />
      )}

      {/* ── EXECUÇÕES ─────────────────────────────────────── */}
      {tab === "execucoes" && (
        execucoes.length === 0 ? (
          <EmptyState icon="check" title="Nenhuma execução registrada ainda." sub="O histórico aparecerá aqui após a primeira execução do cron ou atualização manual." />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <Th>Início</Th>
                    <Th>Origem</Th>
                    <Th>Status</Th>
                    <Th>Agências</Th>
                    <Th>Duração</Th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {execucoes.map((ex) => {
                    const isExpanded = expandedExecucao === ex.id;
                    const duracao = ex.finalizadoEm ? ex.finalizadoEm - ex.iniciadoEm : null;
                    const detalhes: Array<{ agencia: string; codigo: string; status: string }> =
                      ex.detalhes ? JSON.parse(ex.detalhes) : [];
                    return (
                      <>
                        <tr key={ex.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            <p className="font-medium">{new Date(ex.iniciadoEm * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
                            <p className="text-xs text-slate-400">{new Date(ex.iniciadoEm * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${ex.triggeredBy === "cron" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                              {ex.triggeredBy === "cron" ? "Automático" : "Manual"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ExecucaoStatusBadge status={ex.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 space-y-0.5">
                            {ex.status === "erro_fatal" ? (
                              <span className="text-red-500 text-xs">—</span>
                            ) : (
                              <>
                                <p><span className="text-green-600 font-medium">{ex.processadas}</span> processadas</p>
                                {ex.semArquivo > 0 && <p><span className="text-amber-500 font-medium">{ex.semArquivo}</span> sem arquivo</p>}
                                {ex.erros > 0 && <p><span className="text-red-500 font-medium">{ex.erros}</span> com erro</p>}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {duracao !== null ? `${duracao}s` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {(detalhes.length > 0 || ex.mensagemErro) && (
                              <button
                                onClick={() => toggleExecucao(ex.id)}
                                title={isExpanded ? "Recolher" : "Ver detalhes"}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${ex.id}-detail`}>
                            <td colSpan={6} className="px-4 pb-4 pt-0 bg-slate-50">
                              {ex.mensagemErro && (
                                <div className="mb-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                  </svg>
                                  <span className="font-mono break-all">{ex.mensagemErro}</span>
                                </div>
                              )}
                              {detalhes.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                  {detalhes.map((d) => (
                                    <div key={d.codigo} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${
                                      d.status === "processado" ? "bg-green-50 border-green-200 text-green-700" :
                                      d.status === "sem_arquivo" ? "bg-amber-50 border-amber-200 text-amber-700" :
                                      d.status === "arquivo_desatualizado" ? "bg-orange-50 border-orange-200 text-orange-700" :
                                      d.status === "agencia_incorreta" ? "bg-purple-50 border-purple-200 text-purple-700" :
                                      "bg-red-50 border-red-200 text-red-700"
                                    }`}>
                                      <span className="font-mono font-semibold">{d.codigo}</span>
                                      <span className="text-[10px] opacity-70">{
                                        d.status === "processado" ? "ok" :
                                        d.status === "sem_arquivo" ? "sem arquivo" :
                                        d.status === "arquivo_desatualizado" ? "desatualizado" :
                                        d.status === "agencia_incorreta" ? "ag. incorreta" :
                                        "erro"
                                      }</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Modal: excluir agência ────────────────────────── */}
      {confirmExcluirAgenciaId && (
        <ConfirmDeleteModal
          title="Excluir agência"
          description={<>Tem certeza que deseja excluir a agência <span className="font-medium text-slate-700">{agenciaParaExcluir?.codigo}</span>? Esta ação não pode ser desfeita.</>}
          loading={processingAg}
          onCancel={() => setConfirmExcluirAgenciaId(null)}
          onConfirm={() => excluirAgencia(confirmExcluirAgenciaId)}
          error={erroAgencia}
        />
      )}
    </>
  );
}

// ── Primitives ────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}

function ExecucaoStatusBadge({ status }: { status: "sucesso" | "parcial" | "erro" | "erro_fatal" }) {
  const map = {
    sucesso: { cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500", label: "Sucesso" },
    parcial: { cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400", label: "Parcial" },
    erro: { cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", label: "Erro Drive" },
    erro_fatal: { cls: "bg-red-100 text-red-800 border-red-300", dot: "bg-red-600", label: "Falha fatal" },
  };
  const s = map[status] ?? map.erro;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: "aprovado" | "rejeitado" }) {
  const ok = status === "aprovado";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
      {ok ? "Ativo" : "Rejeitado"}
    </span>
  );
}

function IconButton({ children, title, danger, onClick }: { children: React.ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-md transition-colors ${danger ? "text-slate-400 hover:text-red-600 hover:bg-red-50" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{children}</svg>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      {msg}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, confirmLabel = "Salvar alterações", confirmDisabled = false, cancelDisabled = false }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean;
  confirmLabel?: string; confirmDisabled?: boolean; cancelDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2 justify-end">
      <button onClick={onCancel} disabled={cancelDisabled}
        className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={onConfirm} disabled={loading || confirmDisabled}
        className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
        {loading ? "Salvando…" : confirmLabel}
      </button>
    </div>
  );
}

function ConfirmDeleteModal({ title, description, loading, onCancel, onConfirm, error }: {
  title: string; description: React.ReactNode; loading: boolean;
  onCancel: () => void; onConfirm: () => void; error?: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{title}</p>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        {error && <ErrorBox msg={error} />}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
            {loading ? "Excluindo…" : "Sim, excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
      {icon === "check" && (
        <svg className="w-10 h-10 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )}
      {icon === "building" && (
        <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      )}
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}
