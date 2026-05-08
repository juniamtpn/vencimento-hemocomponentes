"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BolsaEnriquecida, AgenciaStatus, LiderancaInfo } from "./types";
import UploadAgencia from "./tabs/UploadAgencia";
import PainelVencimentos from "./tabs/PainelVencimentos";
import Alertas from "./tabs/Alertas";
import Redistribuicao from "./tabs/Redistribuicao";
import Liderancas from "./tabs/Liderancas";

type Tab = "upload" | "painel" | "alertas" | "redistribuicao" | "liderancas";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "painel",
    label: "Vencimentos",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    id: "alertas",
    label: "Alertas",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
  {
    id: "upload",
    label: "Envios",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    id: "redistribuicao",
    label: "Redistribuição",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    id: "liderancas",
    label: "Lideranças",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
];

interface Props {
  bolsas: BolsaEnriquecida[];
  agenciasStatus: AgenciaStatus[];
  liderancas: LiderancaInfo[];
  dataHoje: string;
  perfil: string;
}

export default function DashboardView({
  bolsas,
  agenciasStatus,
  liderancas,
  dataHoje,
  perfil,
}: Props) {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<Tab>("painel");
  const [atualizando, setAtualizando] = useState(false);
  const [msgAtualizar, setMsgAtualizar] = useState("");

  const handleAtualizar = useCallback(async () => {
    setAtualizando(true);
    setMsgAtualizar("");
    try {
      const res = await fetch("/api/processar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsgAtualizar(data.error ?? "Erro ao atualizar.");
      } else {
        const processadas = (data.resultados as { status: string }[]).filter((r) => r.status === "processado").length;
        setMsgAtualizar(`✓ ${processadas} agência(s) atualizadas.`);
        router.refresh();
      }
    } catch {
      setMsgAtualizar("Erro de conexão.");
    } finally {
      setAtualizando(false);
      setTimeout(() => setMsgAtualizar(""), 5000);
    }
  }, [router]);

  const vencidas = bolsas.filter((b) => b.urgencia === "vencido").length;
  const hoje = bolsas.filter((b) => b.urgencia === "hoje").length;
  const semArquivo = agenciasStatus.filter((a) => a.status !== "processado").length;
  const totalAlertas = (vencidas > 0 ? 1 : 0) + (hoje > 0 ? 1 : 0) + (semArquivo > 0 ? 1 : 0);

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <nav className="flex gap-0.5 overflow-x-auto py-1.5">
          {TABS.map((tab) => {
            const isActive = abaAtiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-150 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className={isActive ? "text-white" : "text-slate-400"}>{tab.icon}</span>
                {tab.label}
                {tab.id === "alertas" && totalAlertas > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${
                    isActive ? "bg-[#C8102E] text-white" : "bg-red-100 text-red-700"
                  }`}>
                    {totalAlertas}
                  </span>
                )}
              </button>
            );
          })}
          </nav>

          {/* Atualizar button — admin only */}
          {perfil === "admin" && (
            <div className="flex items-center gap-2 py-1.5 shrink-0">
              {msgAtualizar && (
                <span className="text-xs text-slate-500">{msgAtualizar}</span>
              )}
              <button
                onClick={handleAtualizar}
                disabled={atualizando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-all duration-150 whitespace-nowrap"
              >
                <svg className={`w-3.5 h-3.5 ${atualizando ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {atualizando ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-6 max-w-screen-xl mx-auto w-full page-enter">
        {abaAtiva === "upload" && (
          <UploadAgencia agencias={agenciasStatus} dataHoje={dataHoje} />
        )}
        {abaAtiva === "painel" && <PainelVencimentos bolsas={bolsas} />}
        {abaAtiva === "alertas" && (
          <Alertas bolsas={bolsas} agencias={agenciasStatus} />
        )}
        {abaAtiva === "redistribuicao" && (
          <Redistribuicao bolsas={bolsas} agencias={agenciasStatus} />
        )}
        {abaAtiva === "liderancas" && <Liderancas liderancas={liderancas} />}
      </div>
    </div>
  );
}
