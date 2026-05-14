"use client";

import { useState, useMemo } from "react";
import type { BolsaEnriquecida } from "../types";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const URGENCIA_CFG = {
  vencido: { label: "Vencida",         variant: "vencido" as const, dot: "bg-red-500" },
  hoje:    { label: "Vence hoje",      variant: "hoje"   as const, dot: "bg-orange-500" },
  amanha:  { label: "Vence amanhã",    variant: "amanha" as const, dot: "bg-amber-500" },
  "3dias": { label: "Próximos 3 dias", variant: "3dias"  as const, dot: "bg-yellow-500" },
  ok:      { label: "OK",              variant: "ok"     as const, dot: "bg-green-500" },
} as const;

type Urg = keyof typeof URGENCIA_CFG;

function fmtData(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface MetricCardProps {
  label: string;
  value: number;
  accent: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
}

function MetricCard({ label, value, accent, bg, text, icon }: MetricCardProps) {
  return (
    <div className={`rounded-xl border bg-white shadow-card overflow-hidden`}>
      <div className={`h-1 ${accent}`} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-3xl font-bold ${text}`}>{value}</p>
          </div>
          <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
            <span className={text}>{icon}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  bolsas: BolsaEnriquecida[];
}

export default function PainelVencimentos({ bolsas }: Props) {
  const [filtroComp, setFiltroComp] = useState("todos");
  const [filtroUrg, setFiltroUrg] = useState("todos");

  const componentes = useMemo(
    () => ["todos", ...Array.from(new Set(bolsas.map((b) => b.componente))).sort()],
    [bolsas]
  );

  const vencidos  = bolsas.filter((b) => b.urgencia === "vencido").length;
  const hoje      = bolsas.filter((b) => b.urgencia === "hoje").length;
  const amanha    = bolsas.filter((b) => b.urgencia === "amanha").length;
  const tresDias  = bolsas.filter((b) => b.urgencia === "3dias").length;

  const bolsasFiltradas = useMemo(() => {
    let result = bolsas;
    if (filtroComp !== "todos") result = result.filter((b) => b.componente === filtroComp);
    if (filtroUrg === "relevantes")     result = result.filter((b) => b.urgencia !== "ok");
    else if (filtroUrg !== "todos")     result = result.filter((b) => b.urgencia === filtroUrg);
    const order: Record<string, number> = { vencido: 0, hoje: 1, amanha: 2, "3dias": 3, ok: 4 };
    return [...result].sort(
      (a, b) => (order[a.urgencia] ?? 5) - (order[b.urgencia] ?? 5) || a.validade.localeCompare(b.validade)
    );
  }, [bolsas, filtroComp, filtroUrg]);

  return (
    <div className="space-y-5">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Vencidas"
          value={vencidos}
          accent="bg-red-500"
          bg="bg-red-50"
          text="text-red-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
        />
        <MetricCard
          label="Vencem hoje"
          value={hoje}
          accent="bg-orange-500"
          bg="bg-orange-50"
          text="text-orange-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
        <MetricCard
          label="Vencem amanhã"
          value={amanha}
          accent="bg-amber-500"
          bg="bg-amber-50"
          text="text-amber-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
        />
        <MetricCard
          label="Próximos 3 dias"
          value={tresDias}
          accent="bg-yellow-400"
          bg="bg-yellow-50"
          text="text-yellow-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" /></svg>}
        />
      </div>

      {/* Filters row */}
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <p className="text-slate-500 text-sm">
          <span className="font-semibold text-slate-700">{bolsasFiltradas.length}</span>{" "}
          registro{bolsasFiltradas.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          <Select value={filtroComp} onValueChange={setFiltroComp}>
            <SelectTrigger className="w-[190px] h-8 text-xs">
              <SelectValue placeholder="Componente" />
            </SelectTrigger>
            <SelectContent>
              {componentes.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c === "todos" ? "Todos componentes" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroUrg} onValueChange={setFiltroUrg}>
            <SelectTrigger className="w-[175px] h-8 text-xs">
              <SelectValue placeholder="Urgência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevantes" className="text-xs">Urgentes (excl. OK)</SelectItem>
              <SelectItem value="todos"      className="text-xs">Todas urgências</SelectItem>
              <SelectItem value="vencido"    className="text-xs">Vencidas</SelectItem>
              <SelectItem value="hoje"       className="text-xs">Vencem hoje</SelectItem>
              <SelectItem value="amanha"     className="text-xs">Vencem amanhã</SelectItem>
              <SelectItem value="3dias"      className="text-xs">Próximos 3 dias</SelectItem>
              <SelectItem value="ok"         className="text-xs">OK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {bolsasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-card py-16 flex flex-col items-center gap-3 text-slate-400">
          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p className="text-sm">Nenhuma bolsa encontrada para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["Agência", "Liderança", "Instituição", "Doação", "Componente", "ABO / Rh", "Validade", "Urgência"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bolsasFiltradas.map((b) => {
                  const cfg = URGENCIA_CFG[b.urgencia as Urg] ?? URGENCIA_CFG.ok;
                  const isUrgent = b.urgencia === "vencido" || b.urgencia === "hoje";
                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/60 transition-colors ${isUrgent ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-slate-800">{b.agenciaCodigo}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{b.liderancaNome}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs max-w-[160px] truncate">{b.instituicao}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{b.doacao}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap">{b.componente}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap font-medium">{b.abo} {b.fatorRh}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap font-medium tabular-nums">{fmtData(b.validade)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={cfg.variant} className="gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
