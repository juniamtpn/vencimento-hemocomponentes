"use client";

import { useState, useMemo } from "react";
import type { LiderancaInfo, BolsaEnriquecida } from "../types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtTelefone } from "@/lib/format";

interface Props {
  liderancas: LiderancaInfo[];
  bolsas: BolsaEnriquecida[];
  perfil: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function fmtData(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const URGENCIA_CFG = {
  vencido: { label: "Vencida",         variant: "vencido" as const, dot: "bg-red-500" },
  hoje:    { label: "Vence hoje",      variant: "hoje"   as const, dot: "bg-orange-500" },
  amanha:  { label: "Vence amanhã",    variant: "amanha" as const, dot: "bg-amber-500" },
  "3dias": { label: "Próximos 3 dias", variant: "3dias"  as const, dot: "bg-yellow-500" },
  ok:      { label: "OK",              variant: "ok"     as const, dot: "bg-green-500" },
} as const;

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
];

export default function Liderancas({ liderancas, bolsas, perfil }: Props) {
  const isAdmin = perfil === "admin";

  const totalAgencias = liderancas.reduce((s, l) => s + l.total, 0);
  const totalEnviadas = liderancas.reduce((s, l) => s + l.enviadas, 0);
  const pctGeral = totalAgencias > 0 ? (totalEnviadas / totalAgencias) * 100 : 0;

  // Painel de mensagem: chave única por liderança (email ou nome)
  const [expandida, setExpandida] = useState<string | null>(null);
  const [agenciaSel, setAgenciaSel] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [copiado, setCopiado] = useState(false);

  function abrirPainel(key: string) {
    if (expandida === key) {
      setExpandida(null);
    } else {
      setExpandida(key);
      setAgenciaSel("");
      setMensagem("");
    }
  }

  const liderancaExpandida = expandida
    ? liderancas.find((l) => (l.email ?? l.nome) === expandida) ?? null
    : null;

  const agenciasProcessadas = liderancaExpandida
    ? liderancaExpandida.agencias.filter((ag) => ag.status === "processado")
    : [];

  const bolsasUrgentes = useMemo(() => {
    if (!agenciaSel) return [];
    return bolsas
      .filter(
        (b) =>
          b.agenciaId === agenciaSel &&
          ["vencido", "hoje", "amanha", "3dias"].includes(b.urgencia)
      )
      .sort((a, b) => {
        const ord: Record<string, number> = { vencido: 0, hoje: 1, amanha: 2, "3dias": 3 };
        return (
          (ord[a.urgencia] ?? 9) - (ord[b.urgencia] ?? 9) ||
          a.validade.localeCompare(b.validade)
        );
      });
  }, [bolsas, agenciaSel]);

  const agenciaSelecionada = liderancaExpandida?.agencias.find(
    (ag) => ag.id === agenciaSel
  );

  function gerarMensagem() {
    if (!agenciaSel || !liderancaExpandida || !agenciaSelecionada) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhas: string[] = [
      `*🩸 PULSA — Disponibilidade para Redistribuição*`,
      `*Agência:* ${agenciaSelecionada.nome}`,
      `*Data:* ${hoje}`,
      ``,
    ];

    const urgentes = bolsasUrgentes.filter((b) =>
      ["vencido", "hoje", "amanha"].includes(b.urgencia)
    );
    const tresDias = bolsasUrgentes.filter((b) => b.urgencia === "3dias");

    if (urgentes.length > 0) {
      linhas.push(`*⚠️ URGENTES (vencem em até 1 dia):*`);
      urgentes.forEach((b) => {
        const label =
          b.urgencia === "vencido" ? "VENCIDA" : b.urgencia === "hoje" ? "Hoje" : "Amanhã";
        linhas.push(
          `- ${b.componente} | ${b.abo} ${b.fatorRh} | Doe: ${b.doacao} | Val: ${fmtData(b.validade)} _(${label})_`
        );
      });
      linhas.push(``);
    }

    if (tresDias.length > 0) {
      linhas.push(`*⏰ Vencem em até 3 dias:*`);
      tresDias.forEach((b) => {
        linhas.push(
          `- ${b.componente} | ${b.abo} ${b.fatorRh} | Doe: ${b.doacao} | Val: ${fmtData(b.validade)}`
        );
      });
      linhas.push(``);
    }

    linhas.push(`_Mensagem gerada pelo sistema PULSA Vencimentos._`);
    setMensagem(linhas.join("\n"));
  }

  async function copiar() {
    await navigator.clipboard.writeText(mensagem);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

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
          const key = l.email ?? l.nome;
          const isExpanded = expandida === key;
          const pct = l.total > 0 ? (l.enviadas / l.total) * 100 : 0;
          const isComplete = l.enviadas === l.total;
          const isEmpty    = l.enviadas === 0;
          const barColor   = isComplete ? "bg-green-500" : isEmpty ? "bg-red-400" : "bg-amber-400";
          const statusText = isComplete ? "text-green-700" : isEmpty ? "text-red-600" : "text-amber-700";
          const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          const temProcessadas = l.agencias.some((ag) => ag.status === "processado");

          return (
            <div
              key={key}
              className={`rounded-xl border bg-white shadow-card p-4 transition-colors ${
                isExpanded ? "border-[#C8102E]/40 ring-1 ring-[#C8102E]/20" : "border-slate-200"
              }`}
            >
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
                        {fmtTelefone(l.telefone)}
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
              <div className="flex flex-wrap gap-1.5 mb-3">
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

              {/* Gerar aviso — admin only */}
              {isAdmin && temProcessadas && (
                <button
                  onClick={() => abrirPainel(key)}
                  className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-colors ${
                    isExpanded
                      ? "border-[#C8102E]/30 bg-[#C8102E]/5 text-[#C8102E] font-medium"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                    Gerar aviso de redistribuição
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Painel de mensagem — aparece abaixo do grid */}
      {isAdmin && liderancaExpandida && (
        <div className="rounded-xl border border-[#C8102E]/20 bg-white shadow-card overflow-hidden">
          {/* Painel header */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#C8102E]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              <p className="text-sm font-semibold text-slate-800">
                Aviso de redistribuição —{" "}
                <span className="text-[#C8102E]">{liderancaExpandida.nome}</span>
              </p>
              {liderancaExpandida.telefone && (
                <span className="text-xs text-slate-400 hidden sm:block">
                  · {fmtTelefone(liderancaExpandida.telefone)}
                </span>
              )}
            </div>
            <button
              onClick={() => { setExpandida(null); setAgenciaSel(""); setMensagem(""); }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Agency selector */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">
                Agência
              </label>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="flex-1 min-w-[200px] max-w-sm">
                  <Select
                    value={agenciaSel}
                    onValueChange={(v) => { setAgenciaSel(v); setMensagem(""); }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione uma agência..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agenciasProcessadas.map((ag) => (
                        <SelectItem key={ag.id} value={ag.id}>
                          <span className="font-medium">{ag.codigo}</span>
                          <span className="text-slate-400 ml-2">({ag.totalBolsas} bolsas)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {agenciaSel && (
                  <Button
                    onClick={gerarMensagem}
                    disabled={bolsasUrgentes.length === 0}
                    size="sm"
                    className="h-9 gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />
                    </svg>
                    Gerar mensagem
                  </Button>
                )}
              </div>
            </div>

            {/* Urgency table */}
            {agenciaSel && bolsasUrgentes.length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {bolsasUrgentes.length} bolsa{bolsasUrgentes.length !== 1 ? "s" : ""} urgente{bolsasUrgentes.length !== 1 ? "s" : ""} — {agenciaSelecionada?.nome}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {["Doação", "Componente", "ABO / Rh", "Validade", "Urgência"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-slate-400 text-[11px] font-semibold uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bolsasUrgentes.map((b) => {
                        const cfg = URGENCIA_CFG[b.urgencia as keyof typeof URGENCIA_CFG] ?? URGENCIA_CFG.ok;
                        return (
                          <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2 font-mono text-xs text-slate-500">{b.doacao}</td>
                            <td className="px-4 py-2 text-slate-800 text-xs font-medium">{b.componente}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs font-medium">{b.abo} {b.fatorRh}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs tabular-nums">{fmtData(b.validade)}</td>
                            <td className="px-4 py-2">
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

            {/* Empty state */}
            {agenciaSel && bolsasUrgentes.length === 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-5 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <div>
                  <p className="text-green-700 text-sm font-medium">Nenhuma bolsa urgente</p>
                  <p className="text-green-600 text-xs">Sem necessidade de redistribuição para esta agência.</p>
                </div>
              </div>
            )}

            {/* Generated message */}
            {mensagem && (
              <div className="rounded-lg border border-green-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-green-100 bg-green-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                    <p className="text-sm font-semibold text-green-800">Mensagem gerada</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copiar}
                    className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 gap-1.5"
                  >
                    {copiado ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Copiado!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-4">
                  <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-100">
                    {mensagem}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
