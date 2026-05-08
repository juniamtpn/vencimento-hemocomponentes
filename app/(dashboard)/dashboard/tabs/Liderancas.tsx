"use client";

import type { LiderancaInfo } from "../types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Props {
  liderancas: LiderancaInfo[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
];

export default function Liderancas({ liderancas }: Props) {
  const totalAgencias = liderancas.reduce((s, l) => s + l.total, 0);
  const totalEnviadas = liderancas.reduce((s, l) => s + l.enviadas, 0);
  const pctGeral = totalAgencias > 0 ? (totalEnviadas / totalAgencias) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Header + overall */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Lideranças e agências</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {liderancas.length} lideranças · {totalAgencias} agências no total
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3.5 py-2 shadow-card shrink-0">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">{totalEnviadas}/{totalAgencias}</span>
          <span className="text-slate-400 text-xs">recebidas hoje</span>
        </div>
      </div>

      {/* Overall progress card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-600">Planilhas recebidas hoje</p>
          <p className={`text-sm font-bold ${pctGeral === 100 ? "text-green-600" : pctGeral > 50 ? "text-amber-600" : "text-red-600"}`}>
            {Math.round(pctGeral)}%
          </p>
        </div>
        <Progress
          value={pctGeral}
          className="h-2.5"
          indicatorClassName={
            pctGeral === 100 ? "bg-green-500" : pctGeral > 50 ? "bg-amber-400" : "bg-red-500"
          }
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-slate-400">{totalEnviadas} recebidas</span>
          <span className="text-xs text-slate-400">{totalAgencias - totalEnviadas} pendentes</span>
        </div>
      </div>

      {/* Liderança cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {liderancas.map((l, idx) => {
          const pct = l.total > 0 ? (l.enviadas / l.total) * 100 : 0;
          const isComplete = l.enviadas === l.total;
          const isEmpty    = l.enviadas === 0;
          const barColor   = isComplete ? "bg-green-500" : isEmpty ? "bg-red-400" : "bg-amber-400";
          const statusText = isComplete ? "text-green-700" : isEmpty ? "text-red-600" : "text-amber-700";
          const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

          return (
            <div key={l.nome} className="rounded-xl border border-slate-200 bg-white shadow-card p-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-bold text-sm ${avatarColor}`}>
                  {getInitials(l.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{l.nome}</p>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {l.telefone ? (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />
                        </svg>
                        {l.telefone}
                      </span>
                    ) : null}
                    {l.email ? (
                      <a
                        href={`mailto:${l.email}`}
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 truncate transition-colors"
                        title={l.email}
                      >
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        <span className="truncate">{l.email}</span>
                      </a>
                    ) : null}
                    {!l.telefone && !l.email && (
                      <span className="text-xs text-slate-300">sem contato</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-bold whitespace-nowrap ${statusText}`}>
                  {l.enviadas}/{l.total}
                </span>
              </div>

              {/* Progress */}
              <Progress value={pct} className="h-1.5 mb-3" indicatorClassName={barColor} />

              {/* Agency chips */}
              <div className="flex flex-wrap gap-1.5">
                {l.agencias.map((ag) => (
                  <Badge
                    key={ag.id}
                    variant={
                      ag.status === "processado" ? "processado"
                      : ag.status === "erro" ? "erro"
                      : "sem_arquivo"
                    }
                    title={`${ag.nome} — ${ag.totalBolsas} bolsas`}
                    className="cursor-default text-[11px] gap-1"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      ag.status === "processado" ? "bg-green-500"
                      : ag.status === "erro" ? "bg-red-500"
                      : "bg-slate-400"
                    }`} />
                    {ag.codigo}
                    {ag.status === "processado" && ag.totalBolsas > 0 && (
                      <span className="opacity-60">({ag.totalBolsas})</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
