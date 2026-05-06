"use client";

import type { BolsaEnriquecida, AgenciaStatus } from "../types";

interface Props {
  bolsas: BolsaEnriquecida[];
  agencias: AgenciaStatus[];
}

export default function Alertas({ bolsas, agencias }: Props) {
  const vencidas   = bolsas.filter((b) => b.urgencia === "vencido");
  const hoje       = bolsas.filter((b) => b.urgencia === "hoje");
  const amanha     = bolsas.filter((b) => b.urgencia === "amanha");
  const semArquivo = agencias.filter((a) => a.status !== "processado");
  const comErro    = agencias.filter((a) => a.status === "erro");

  function agruparPorAgencia(lista: BolsaEnriquecida[]) {
    const mapa = new Map<string, number>();
    for (const b of lista) mapa.set(b.agenciaCodigo, (mapa.get(b.agenciaCodigo) ?? 0) + 1);
    return Array.from(mapa.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cod, qtd]) => `${cod}: ${qtd}`)
      .join("  ·  ");
  }

  const temAlertas =
    vencidas.length > 0 || hoje.length > 0 || amanha.length > 0 ||
    semArquivo.length > 0 || comErro.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Alertas do dia</h2>
        {temAlertas && (
          <span className="text-xs text-slate-500 font-medium">
            {[vencidas, hoje, amanha, semArquivo, comErro].filter(l => l.length > 0).length} tipo{[vencidas, hoje, amanha, semArquivo, comErro].filter(l => l.length > 0).length !== 1 ? "s" : ""} de alerta
          </span>
        )}
      </div>

      {!temAlertas && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-green-800 text-sm">Tudo em ordem</p>
            <p className="text-green-600 text-xs mt-0.5">Todas as agências enviaram planilhas e não há bolsas críticas.</p>
          </div>
        </div>
      )}

      {vencidas.length > 0 && (
        <AlertCard
          color="red"
          titulo={`${vencidas.length} bolsa${vencidas.length !== 1 ? "s" : ""} vencida${vencidas.length !== 1 ? "s" : ""}`}
          detalhe={agruparPorAgencia(vencidas)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
      )}

      {hoje.length > 0 && (
        <AlertCard
          color="orange"
          titulo={`${hoje.length} bolsa${hoje.length !== 1 ? "s" : ""} vence${hoje.length !== 1 ? "m" : ""} hoje`}
          detalhe={agruparPorAgencia(hoje)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      )}

      {amanha.length > 0 && (
        <AlertCard
          color="amber"
          titulo={`${amanha.length} bolsa${amanha.length !== 1 ? "s" : ""} vence${amanha.length !== 1 ? "m" : ""} amanhã`}
          detalhe={agruparPorAgencia(amanha)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          }
        />
      )}

      {semArquivo.length > 0 && (
        <AlertCard
          color="slate"
          titulo={`${semArquivo.length} agência${semArquivo.length !== 1 ? "s" : ""} sem relatório hoje`}
          detalhe={semArquivo.map((a) => a.codigo).join(", ")}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          }
        />
      )}

      {comErro.length > 0 && (
        <AlertCard
          color="red"
          titulo={`${comErro.length} agência${comErro.length !== 1 ? "s" : ""} com erro de processamento`}
          detalhe={comErro.map((a) => a.codigo).join(", ")}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          }
        />
      )}
    </div>
  );
}

const COLOR_MAP = {
  red:   { card: "bg-red-50    border-red-200",   icon: "bg-red-100   text-red-600",   title: "text-red-800",   detail: "text-red-600"   },
  orange:{ card: "bg-orange-50 border-orange-200", icon: "bg-orange-100 text-orange-600", title: "text-orange-800", detail: "text-orange-700" },
  amber: { card: "bg-amber-50  border-amber-200",  icon: "bg-amber-100 text-amber-600",  title: "text-amber-800",  detail: "text-amber-700"  },
  slate: { card: "bg-slate-50  border-slate-200",  icon: "bg-slate-100 text-slate-500",  title: "text-slate-700",  detail: "text-slate-600"  },
} as const;

type AlertColor = keyof typeof COLOR_MAP;

function AlertCard({
  color,
  titulo,
  detalhe,
  icon,
}: {
  color: AlertColor;
  titulo: string;
  detalhe: string;
  icon: React.ReactNode;
}) {
  const s = COLOR_MAP[color];
  return (
    <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${s.card}`}>
      <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${s.icon}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${s.title}`}>{titulo}</p>
        <p className={`text-sm mt-0.5 leading-relaxed ${s.detail}`}>{detalhe}</p>
      </div>
    </div>
  );
}
