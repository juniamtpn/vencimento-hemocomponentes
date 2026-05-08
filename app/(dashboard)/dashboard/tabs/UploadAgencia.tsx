"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AgenciaStatus } from "../types";
import { Badge } from "@/components/ui/badge";

interface Props {
  agencias: AgenciaStatus[];
  dataHoje: string;
}

function fmt(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDataHora(unixSec: number) {
  const d = new Date(unixSec * 1000);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${data} às ${hora}`;
}

export default function UploadAgencia({ agencias, dataHoje }: Props) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [agenciaSelecionada, setAgenciaSelecionada] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enviadas    = agencias.filter((a) => a.status === "processado").length;
  const semArquivo  = agencias.filter((a) => a.status === "sem_arquivo").length;
  const comErro     = agencias.filter((a) => a.status === "erro").length;
  const manuais     = agencias.filter((a) => a.tipoEnvio === "manual").length;
  const pctEnviadas = agencias.length > 0 ? Math.round((enviadas / agencias.length) * 100) : 0;

  function abrirModal() {
    setAgenciaSelecionada("");
    setArquivo(null);
    setErro("");
    setModalAberto(true);
  }

  function fecharModal() {
    if (enviando) return;
    setModalAberto(false);
  }

  async function handleUpload() {
    if (!agenciaSelecionada || !arquivo) {
      setErro("Selecione a agência e o arquivo.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("agenciaId", agenciaSelecionada);
      const res = await fetch("/api/envios/upload-manual", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao enviar.");
      } else {
        setModalAberto(false);
        router.refresh();
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Status de Envio — {fmt(dataHoje)}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Planilhas lidas automaticamente pelo OneDrive às 10h (BRT)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirModal}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Importação manual
          </button>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-card">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">{enviadas}/{agencias.length}</span>
            <span className="text-slate-400 text-xs">enviadas</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600">Progresso de envios hoje</span>
          <span className={`text-xs font-bold ${pctEnviadas === 100 ? "text-green-600" : pctEnviadas > 50 ? "text-amber-600" : "text-red-600"}`}>
            {pctEnviadas}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pctEnviadas === 100 ? "bg-green-500" : pctEnviadas > 50 ? "bg-amber-400" : "bg-red-500"
            }`}
            style={{ width: `${pctEnviadas}%` }}
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <StatChip label="Enviadas"    count={enviadas}   total={agencias.length} bg="bg-green-50"  border="border-green-200"  text="text-green-700"  dot="bg-green-500" />
        <StatChip label="Sem arquivo" count={semArquivo} total={agencias.length} bg="bg-slate-50"  border="border-slate-200"  text="text-slate-600"  dot="bg-slate-400" />
        {comErro > 0 && (
          <StatChip label="Erro"      count={comErro}    total={agencias.length} bg="bg-red-50"    border="border-red-200"    text="text-red-700"   dot="bg-red-500" />
        )}
        {manuais > 0 && (
          <StatChip label="Manuais"   count={manuais}    total={enviadas}        bg="bg-amber-50"  border="border-amber-200"  text="text-amber-700" dot="bg-amber-400" />
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide w-[140px]">Agência</th>
                <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">Liderança</th>
                <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">Arquivo</th>
                <th className="text-right px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide w-[80px]">Bolsas</th>
                <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide w-[200px]">Envio</th>
                <th className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide w-[100px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agencias.map((ag) => (
                <tr
                  key={ag.id}
                  className={`transition-colors ${
                    ag.tipoEnvio === "manual"
                      ? "bg-amber-50/30 hover:bg-amber-50/60"
                      : "hover:bg-slate-50/60"
                  }`}
                >
                  {/* Agência */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800">{ag.codigo}</span>
                    {ag.nome !== ag.codigo && (
                      <p className="text-slate-400 text-[11px] leading-tight mt-0.5">{ag.nome}</p>
                    )}
                  </td>

                  {/* Liderança */}
                  <td className="px-4 py-3 text-slate-600 text-xs">{ag.liderancaNome}</td>

                  {/* Arquivo */}
                  <td className="px-4 py-3">
                    {ag.arquivoNome ? (
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate block max-w-[180px]" title={ag.arquivoNome}>
                        {ag.arquivoNome}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Bolsas */}
                  <td className="px-4 py-3 text-right">
                    {ag.status === "processado" ? (
                      <span className="font-semibold text-slate-800 tabular-nums">{ag.totalBolsas}</span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Envio */}
                  <td className="px-4 py-3">
                    <EnvioCell ag={ag} />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={ag.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de importação manual */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={fecharModal}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Importação manual</h3>
              <button onClick={fecharModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Agência */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Agência</label>
              <select
                value={agenciaSelecionada}
                onChange={(e) => setAgenciaSelecionada(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Selecione uma agência...</option>
                {agencias.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.codigo} — {ag.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Arquivo */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Arquivo (.xlsx, .xls, .pdf)</label>
              <div
                className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 cursor-pointer hover:border-slate-400 hover:bg-slate-100 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                {arquivo ? (
                  <span className="text-sm font-medium text-slate-700">{arquivo.name}</span>
                ) : (
                  <span className="text-sm text-slate-400">Clique para selecionar o arquivo</span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={fecharModal}
                disabled={enviando}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={enviando || !agenciaSelecionada || !arquivo}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {enviando ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Enviando...
                  </>
                ) : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvioCell({ ag }: { ag: AgenciaStatus }) {
  if (!ag.tipoEnvio || ag.status !== "processado") {
    return <span className="text-slate-300 text-xs">—</span>;
  }

  const dataHora = ag.createdAt ? fmtDataHora(ag.createdAt) : null;

  if (ag.tipoEnvio === "manual") {
    const email = ag.enviadoPor ?? "";
    const nomeExibido = email.includes("@")
      ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : email;

    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-md px-2 py-0.5">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          Manual
        </span>
        <div className="space-y-0.5 pl-0.5">
          {dataHora && <p className="text-[11px] text-slate-500 leading-tight">{dataHora}</p>}
          {nomeExibido && (
            <p className="text-[11px] text-slate-400 leading-tight" title={email}>
              por {nomeExibido}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5">
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Automático
      </span>
      {dataHora && <p className="text-[11px] text-slate-500 pl-0.5 leading-tight">{dataHora}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "processado") {
    return (
      <Badge variant="processado" className="gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Enviada
      </Badge>
    );
  }
  if (status === "erro") {
    return (
      <Badge variant="erro" className="gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Erro
      </Badge>
    );
  }
  return (
    <Badge variant="sem_arquivo" className="gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Sem arquivo
    </Badge>
  );
}

function StatChip({
  label, count, total, bg, border, text, dot,
}: {
  label: string; count: number; total: number;
  bg: string; border: string; text: string; dot: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border ${bg} ${border}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className={`font-bold text-lg leading-none ${text}`}>{count}</span>
      <span className={`text-sm ${text}`}>{label}</span>
      <span className={`text-xs opacity-60 ${text}`}>({pct}%)</span>
    </div>
  );
}
