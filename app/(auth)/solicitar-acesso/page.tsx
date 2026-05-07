"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

const AGENCIAS = [
  "HUSC", "HUB", "HIO", "HBH", "HL", "HMDBC",
  "HVS", "HMON", "HSR", "HSCU Ub", "HSG Ub",
  "HMDC", "HMDSA", "HMDNL", "HDMU", "HUC",
  "HLC", "HVC", "HSE", "HS", "UMC Ub", "Madrecor Ub",
  "HFR", "HSL", "HMT",
];

function SolicitarAcessoForm() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const [form, setForm] = useState({ nome: "", agencia: "", justificativa: "" });
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
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Solicitação enviada!</h2>
          <p className="text-slate-500 text-sm">
            Sua solicitação foi enviada para a administradora. Você receberá uma resposta em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#C8102E] via-[#E8284A] to-[#C8102E]" />

        <div className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800">Solicitar Acesso</h1>
            <p className="text-slate-500 text-sm mt-1">HEMOTE Vencimentos — Sistema Interno</p>
          </div>

          {status === "pendente" && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              Sua solicitação está em análise. Aguarde a aprovação da administradora.
            </div>
          )}

          {status === "rejeitado" && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              Sua solicitação foi rejeitada. Entre em contato com a administradora.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nome completo</label>
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] transition-all"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Agência</label>
              <select
                required
                value={form.agencia}
                onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] transition-all"
              >
                <option value="">Selecione sua agência</option>
                {AGENCIAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Justificativa</label>
              <textarea
                required
                rows={3}
                value={form.justificativa}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] transition-all resize-none"
                placeholder="Por que você precisa de acesso ao sistema?"
              />
            </div>

            {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C8102E] hover:bg-[#a50d24] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 text-sm"
            >
              {loading ? "Enviando..." : "Solicitar Acesso"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            <a href="/login" className="text-[#C8102E] hover:underline font-medium">
              Voltar ao login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SolicitarAcessoPage() {
  return (
    <Suspense>
      <SolicitarAcessoForm />
    </Suspense>
  );
}
