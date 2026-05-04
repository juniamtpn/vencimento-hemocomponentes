"use client";

import { useState } from "react";
import type { ResumoAgencia, BolsaComAgencia } from "@/types";
import { gerarMensagemWhatsApp } from "@/lib/whatsapp-message";

type Urgencia = "vencido" | "hoje" | "amanha" | "3dias" | "ok";

const URGENCIA_CONFIG: Record<
  Urgencia,
  { label: string; color: string; dot: string }
> = {
  vencido: {
    label: "Vencido",
    color: "text-red-400 bg-red-900/30 border-red-700",
    dot: "bg-red-400",
  },
  hoje: {
    label: "Hoje",
    color: "text-orange-400 bg-orange-900/30 border-orange-700",
    dot: "bg-orange-400",
  },
  amanha: {
    label: "Amanhã",
    color: "text-yellow-400 bg-yellow-900/30 border-yellow-700",
    dot: "bg-yellow-400",
  },
  "3dias": {
    label: "3 dias",
    color: "text-blue-400 bg-blue-900/30 border-blue-700",
    dot: "bg-blue-400",
  },
  ok: {
    label: "OK",
    color: "text-green-400 bg-green-900/30 border-green-700",
    dot: "bg-green-400",
  },
};

function formatarData(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  resumos: ResumoAgencia[];
  dataHoje: string;
  perfil: string;
}

export default function DashboardView({ resumos, dataHoje, perfil }: Props) {
  const [agenciaSel, setAgenciaSel] = useState<string | null>(null);
  const [bolsas, setBolsas] = useState<BolsaComAgencia[]>([]);
  const [loadingBolsas, setLoadingBolsas] = useState(false);
  const [filtroUrg, setFiltroUrg] = useState<string>("todos");
  const [mensagem, setMensagem] = useState<string>("");
  const [mostrarMsg, setMostrarMsg] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const totalVencidos = resumos.reduce((s, r) => s + r.vencidos, 0);
  const totalHoje = resumos.reduce((s, r) => s + r.hoje, 0);
  const totalAmanha = resumos.reduce((s, r) => s + r.amanha, 0);
  const totalSemArquivo = resumos.filter((r) => r.semArquivo).length;

  async function selecionarAgencia(id: string) {
    if (agenciaSel === id) {
      setAgenciaSel(null);
      setBolsas([]);
      setMostrarMsg(false);
      return;
    }
    setAgenciaSel(id);
    setFiltroUrg("todos");
    setMostrarMsg(false);
    setLoadingBolsas(true);
    try {
      const res = await fetch(`/api/bolsas?agenciaId=${id}&data=${dataHoje}`);
      const data = await res.json();
      setBolsas(data.bolsas ?? []);
    } catch {
      setBolsas([]);
    } finally {
      setLoadingBolsas(false);
    }
  }

  function gerarWhatsApp() {
    const resumo = resumos.find((r) => r.agencia.id === agenciaSel);
    const nome = resumo?.agencia.nome ?? "";
    const urgentes = bolsas.filter((b) =>
      ["vencido", "hoje", "amanha", "3dias"].includes(b.urgencia)
    );
    const msg = gerarMensagemWhatsApp(urgentes, nome);
    setMensagem(msg);
    setMostrarMsg(true);
  }

  async function copiarMensagem() {
    await navigator.clipboard.writeText(mensagem);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const bolsasFiltradas =
    filtroUrg === "todos"
      ? bolsas
      : bolsas.filter((b) => b.urgencia === filtroUrg);

  const resumoSel = resumos.find((r) => r.agencia.id === agenciaSel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Dashboard de Vencimentos</h2>
        <p className="text-gray-400 text-sm">
          Posição do dia: {formatarData(dataHoje)}
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Bolsas Vencidas" value={totalVencidos} textColor="text-red-400" />
        <SummaryCard label="Vencem Hoje" value={totalHoje} textColor="text-orange-400" />
        <SummaryCard label="Vencem Amanhã" value={totalAmanha} textColor="text-yellow-400" />
        <SummaryCard
          label="Sem Arquivo"
          value={totalSemArquivo}
          textColor="text-gray-400"
          suffix="ag."
        />
      </div>

      {/* Agencies grid */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Agências Transfusionais ({resumos.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {resumos.map((r) => (
            <AgenciaCard
              key={r.agencia.id}
              resumo={r}
              selecionada={agenciaSel === r.agencia.id}
              onClick={() => selecionarAgencia(r.agencia.id)}
            />
          ))}
        </div>
      </section>

      {/* Detail panel */}
      {agenciaSel && (
        <section className="bg-[#16213e] rounded-2xl border border-[#0f3460] p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-white font-bold text-lg">
                {resumoSel?.agencia.nome}
              </h3>
              <p className="text-gray-400 text-sm">
                Liderança:{" "}
                <span className="text-gray-300">
                  {resumoSel?.agencia.liderancaNome}
                </span>
                {resumoSel?.agencia.liderancaTelefone && (
                  <span className="text-gray-500 ml-1">
                    ({resumoSel.agencia.liderancaTelefone})
                  </span>
                )}
              </p>
              <p className="text-gray-600 text-xs mt-0.5">
                {bolsas.length} bolsas processadas
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={gerarWhatsApp}
                className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                📱 WhatsApp
              </button>
              <button
                onClick={() => {
                  setAgenciaSel(null);
                  setBolsas([]);
                  setMostrarMsg(false);
                }}
                className="text-xs text-gray-500 hover:text-white px-2 py-1.5 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Urgency filter pills */}
          <div className="flex gap-2 flex-wrap mb-4">
            <FilterPill
              label="Todos"
              count={bolsas.length}
              active={filtroUrg === "todos"}
              onClick={() => setFiltroUrg("todos")}
            />
            {(["vencido", "hoje", "amanha", "3dias", "ok"] as Urgencia[]).map(
              (u) => (
                <FilterPill
                  key={u}
                  label={URGENCIA_CONFIG[u].label}
                  count={bolsas.filter((b) => b.urgencia === u).length}
                  active={filtroUrg === u}
                  onClick={() => setFiltroUrg(u)}
                />
              )
            )}
          </div>

          {/* Table */}
          {loadingBolsas ? (
            <div className="text-center py-10 text-gray-500">Carregando...</div>
          ) : bolsasFiltradas.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              {resumoSel?.semArquivo
                ? "Agência não enviou planilha hoje."
                : "Nenhuma bolsa para este filtro."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#0f3460]/50">
              <table className="w-full text-sm">
                <thead className="bg-[#0f3460]/30">
                  <tr className="text-gray-400 text-xs">
                    <th className="text-left px-3 py-2">Doação</th>
                    <th className="text-left px-3 py-2">Componente</th>
                    <th className="text-left px-3 py-2">ABO</th>
                    <th className="text-left px-3 py-2">Rh</th>
                    <th className="text-left px-3 py-2">Validade</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bolsasFiltradas.map((b) => {
                    const cfg = URGENCIA_CONFIG[b.urgencia as Urgencia];
                    return (
                      <tr
                        key={b.id}
                        className="border-t border-[#0f3460]/30 hover:bg-[#0f3460]/20 transition-colors"
                      >
                        <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                          {b.doacao}
                        </td>
                        <td className="px-3 py-2 text-white">{b.componente}</td>
                        <td className="px-3 py-2 text-gray-300">{b.abo}</td>
                        <td className="px-3 py-2 text-gray-300">{b.fatorRh}</td>
                        <td className="px-3 py-2 text-gray-300">
                          {formatarData(b.validade)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* WhatsApp message box */}
          {mostrarMsg && (
            <div className="mt-5 p-4 bg-[#1a1a2e] rounded-xl border border-green-900/50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-green-400 text-xs font-semibold uppercase tracking-wide">
                  Mensagem WhatsApp — Redistribuição
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={copiarMensagem}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copiado ? "✓ Copiado!" : "Copiar"}
                  </button>
                  <button
                    onClick={() => setMostrarMsg(false)}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {mensagem}
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  textColor,
  suffix,
}: {
  label: string;
  value: number;
  textColor: string;
  suffix?: string;
}) {
  return (
    <div className="bg-[#16213e] rounded-xl border border-[#0f3460] p-4">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColor}`}>
        {value}
        {suffix && (
          <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>
        )}
      </p>
    </div>
  );
}

function AgenciaCard({
  resumo,
  selecionada,
  onClick,
}: {
  resumo: ResumoAgencia;
  selecionada: boolean;
  onClick: () => void;
}) {
  const temCritico = resumo.vencidos > 0 || resumo.hoje > 0;

  return (
    <button
      onClick={onClick}
      className={`text-left w-full p-4 rounded-xl border transition-all ${
        selecionada
          ? "bg-[#0f3460] border-[#C8102E] shadow-lg"
          : "bg-[#16213e] border-[#0f3460] hover:border-[#C8102E]/50 hover:bg-[#16213e]/80"
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {resumo.agencia.nome}
          </p>
          <p className="text-gray-500 text-xs truncate">
            {resumo.agencia.liderancaNome}
          </p>
        </div>
        {resumo.semArquivo && (
          <span className="shrink-0 text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
            sem arquivo
          </span>
        )}
        {!resumo.semArquivo && temCritico && (
          <span className="shrink-0 text-xs text-red-400 bg-red-900/30 border border-red-800 px-1.5 py-0.5 rounded">
            crítico
          </span>
        )}
      </div>

      {!resumo.semArquivo && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {resumo.vencidos > 0 && (
            <span className="text-red-400">{resumo.vencidos} venc.</span>
          )}
          {resumo.hoje > 0 && (
            <span className="text-orange-400">{resumo.hoje} hoje</span>
          )}
          {resumo.amanha > 0 && (
            <span className="text-yellow-400">{resumo.amanha} amanhã</span>
          )}
          {resumo.tresDias > 0 && (
            <span className="text-blue-400">{resumo.tresDias} 3d</span>
          )}
          {resumo.ok > 0 && (
            <span className="text-green-500">{resumo.ok} ok</span>
          )}
          {resumo.vencidos === 0 &&
            resumo.hoje === 0 &&
            resumo.amanha === 0 &&
            resumo.tresDias === 0 &&
            resumo.ok === 0 && (
              <span className="text-gray-700">sem bolsas</span>
            )}
        </div>
      )}
    </button>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        active
          ? "bg-[#C8102E] border-[#C8102E] text-white"
          : "border-[#0f3460] text-gray-400 hover:text-white"
      }`}
    >
      {label}
      <span className={`ml-1 ${active ? "text-red-200" : "text-gray-600"}`}>
        ({count})
      </span>
    </button>
  );
}
