"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

const AGENCIAS = [
  "HUSC", "HUB", "HIO", "HBH", "HL", "HMDBC",
  "HVS", "HMON", "HSR", "HSCU Ub", "HSG Ub",
  "HMDC", "HMDSA", "HMDNL", "HDMU", "HUC",
  "HLC", "HVC", "HSE", "HS", "UMC Ub", "Madrecor Ub",
  "HFR", "HSL", "HMT",
];

export default function SolicitarAcessoPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const [form, setForm] = useState({
    nome: "",
    agencia: "",
    justificativa: "",
  });
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");

    try {
      await signIn("azure-ad", { redirect: false });

      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setErro(data.error ?? "Erro ao enviar solicitação.");
      } else {
        setEnviado(true);
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <div className="max-w-md w-full p-8 bg-[#16213e] rounded-2xl border border-[#0f3460] text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Solicitação enviada!
          </h2>
          <p className="text-gray-400 text-sm">
            Sua solicitação foi enviada para a administradora. Você receberá uma
            resposta em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] p-4">
      <div className="w-full max-w-md p-8 bg-[#16213e] rounded-2xl border border-[#0f3460] shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white">Solicitar Acesso</h1>
          <p className="text-gray-400 text-sm mt-1">
            HEMOTE Vencimentos — Sistema Interno
          </p>
        </div>

        {status === "pendente" && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
            Sua solicitação está em análise. Aguarde a aprovação da
            administradora.
          </div>
        )}

        {status === "rejeitado" && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            Sua solicitação foi rejeitada. Entre em contato com a administradora.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Nome completo
            </label>
            <input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C8102E]"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Agência</label>
            <select
              required
              value={form.agencia}
              onChange={(e) => setForm({ ...form, agencia: e.target.value })}
              className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C8102E]"
            >
              <option value="">Selecione sua agência</option>
              {AGENCIAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Justificativa
            </label>
            <textarea
              required
              rows={3}
              value={form.justificativa}
              onChange={(e) =>
                setForm({ ...form, justificativa: e.target.value })
              }
              className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C8102E] resize-none"
              placeholder="Por que você precisa de acesso ao sistema?"
            />
          </div>

          {erro && (
            <p className="text-red-400 text-sm text-center">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C8102E] hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Enviando..." : "Solicitar Acesso"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          <a href="/login" className="text-[#C8102E] hover:underline">
            Voltar ao login
          </a>
        </p>
      </div>
    </div>
  );
}
