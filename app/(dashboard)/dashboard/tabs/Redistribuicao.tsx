"use client";

import { useState, useMemo } from "react";
import type { BolsaEnriquecida, AgenciaStatus } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface Props {
  bolsas: BolsaEnriquecida[];
  agencias: AgenciaStatus[];
}

export default function Redistribuicao({ bolsas, agencias }: Props) {
  const [agenciaSel, setAgenciaSel] = useState("");
  const [mensagem, setMensagem]     = useState("");
  const [copiado, setCopiado]       = useState(false);

  const agenciasComDados = agencias.filter((a) => a.status === "processado");

  const bolsasSel = useMemo(() => {
    if (!agenciaSel) return [];
    return bolsas
      .filter((b) => b.agenciaId === agenciaSel && ["vencido", "hoje", "amanha", "3dias"].includes(b.urgencia))
      .sort((a, b) => {
        const ord: Record<string, number> = { vencido: 0, hoje: 1, amanha: 2, "3dias": 3 };
        return (ord[a.urgencia] ?? 9) - (ord[b.urgencia] ?? 9) || a.validade.localeCompare(b.validade);
      });
  }, [bolsas, agenciaSel]);

  const agenciaNome = agencias.find((a) => a.id === agenciaSel)?.nome ?? "";
  const lideranca   = agencias.find((a) => a.id === agenciaSel);

  function gerarMensagem() {
    if (!agenciaSel || bolsasSel.length === 0) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhas: string[] = [
      `*🩸 PULSA — Disponibilidade para Redistribuição*`,
      `*Agência:* ${agenciaNome}`,
      `*Data:* ${hoje}`,
      ``,
    ];

    const urgentes = bolsasSel.filter((b) => ["vencido", "hoje", "amanha"].includes(b.urgencia));
    const tresDias = bolsasSel.filter((b) => b.urgencia === "3dias");

    if (urgentes.length > 0) {
      linhas.push(`*⚠️ URGENTES (vencem em até 1 dia):*`);
      urgentes.forEach((b) => {
        const label = b.urgencia === "vencido" ? "VENCIDA" : b.urgencia === "hoje" ? "Hoje" : "Amanhã";
        linhas.push(`- ${b.componente} | ${b.abo} ${b.fatorRh} | Doe: ${b.doacao} | Val: ${fmtData(b.validade)} _(${label})_`);
      });
      linhas.push(``);
    }

    if (tresDias.length > 0) {
      linhas.push(`*⏰ Vencem em até 3 dias:*`);
      tresDias.forEach((b) => {
        linhas.push(`- ${b.componente} | ${b.abo} ${b.fatorRh} | Doe: ${b.doacao} | Val: ${fmtData(b.validade)}`);
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
      <div>
        <h2 className="text-base font-semibold text-slate-800">Redistribuição</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Selecione uma agência para gerar a mensagem de redistribuição via WhatsApp
        </p>
      </div>

      {/* Agency selector */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">
            Agência
          </label>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[220px]">
              <Select
                value={agenciaSel}
                onValueChange={(v) => { setAgenciaSel(v); setMensagem(""); }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione uma agência..." />
                </SelectTrigger>
                <SelectContent>
                  {agenciasComDados.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-medium">{a.codigo}</span>
                      <span className="text-slate-400 ml-2">— {a.liderancaNome}</span>
                      <span className="text-slate-400 ml-1">({a.totalBolsas} bolsas)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {agenciaSel && (
              <Button
                onClick={gerarMensagem}
                disabled={bolsasSel.length === 0}
                className="h-10 gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />
                </svg>
                Gerar mensagem WhatsApp
              </Button>
            )}
          </div>
        </div>

        {agenciaSel && lideranca && (
          <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span className="text-sm text-slate-600">
              <span className="font-semibold">{lideranca.liderancaNome}</span>
              {lideranca.liderancaTelefone && (
                <span className="text-slate-400 ml-2">· {lideranca.liderancaTelefone}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {agenciaSel && bolsasSel.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-green-700 text-sm font-medium">Nenhuma bolsa urgente nesta agência</p>
          <p className="text-green-600 text-xs">Sem necessidade de redistribuição no momento.</p>
        </div>
      )}

      {/* Urgent bags table */}
      {agenciaSel && bolsasSel.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {bolsasSel.length} bolsa{bolsasSel.length !== 1 ? "s" : ""} urgente{bolsasSel.length !== 1 ? "s" : ""} — {agenciaNome}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Doação", "Componente", "ABO / Rh", "Validade", "Urgência"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-slate-400 text-[11px] font-semibold uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bolsasSel.map((b) => {
                  const cfg = URGENCIA_CFG[b.urgencia as keyof typeof URGENCIA_CFG] ?? URGENCIA_CFG.ok;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{b.doacao}</td>
                      <td className="px-4 py-2.5 text-slate-800 text-xs font-medium">{b.componente}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs font-medium">{b.abo} {b.fatorRh}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs tabular-nums">{fmtData(b.validade)}</td>
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

      {/* Generated message */}
      {mensagem && (
        <div className="rounded-xl border border-green-200 bg-white shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-green-100 bg-green-50 flex items-center justify-between">
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
          <div className="p-5">
            <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-100">
              {mensagem}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
