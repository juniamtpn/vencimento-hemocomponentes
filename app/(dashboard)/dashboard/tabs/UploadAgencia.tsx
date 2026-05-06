"use client";

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

export default function UploadAgencia({ agencias, dataHoje }: Props) {
  const enviadas   = agencias.filter((a) => a.status === "processado").length;
  const semArquivo = agencias.filter((a) => a.status === "sem_arquivo").length;
  const comErro    = agencias.filter((a) => a.status === "erro").length;
  const pctEnviadas = agencias.length > 0 ? Math.round((enviadas / agencias.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Status de Envio — {fmt(dataHoje)}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Planilhas lidas automaticamente pelo Google Drive às 10h (BRT)
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-card">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">{enviadas}/{agencias.length}</span>
          <span className="text-slate-400 text-xs">enviadas</span>
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
        <StatChip
          label="Enviadas"
          count={enviadas}
          total={agencias.length}
          bg="bg-green-50"
          border="border-green-200"
          text="text-green-700"
          dot="bg-green-500"
        />
        <StatChip
          label="Sem arquivo"
          count={semArquivo}
          total={agencias.length}
          bg="bg-slate-50"
          border="border-slate-200"
          text="text-slate-600"
          dot="bg-slate-400"
        />
        {comErro > 0 && (
          <StatChip
            label="Erro"
            count={comErro}
            total={agencias.length}
            bg="bg-red-50"
            border="border-red-200"
            text="text-red-700"
            dot="bg-red-500"
          />
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Agência", "Liderança", "Arquivo", "Bolsas", "Status"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agencias.map((ag) => (
              <tr key={ag.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-slate-800">{ag.codigo}</span>
                  {ag.nome !== ag.codigo && (
                    <span className="ml-2 text-slate-400 font-normal text-xs">{ag.nome}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">{ag.liderancaNome}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs font-mono truncate max-w-[180px]">
                  {ag.arquivoNome ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-700 text-sm font-medium tabular-nums">
                  {ag.status === "processado" ? ag.totalBolsas : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={ag.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
