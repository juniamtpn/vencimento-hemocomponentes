"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [demoEmail, setDemoEmail] = useState("admin@demo.com");
  const [demoPass, setDemoPass] = useState("demo123");
  const [loading, setLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  async function handleDemoLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDemoError("");
    const res = await signIn("demo-credentials", {
      email: demoEmail,
      password: demoPass,
      callbackUrl: "/dashboard",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setDemoError("Email ou senha inválidos. Use a senha: demo123");
    } else if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#C8102E]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#166534]/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.01] rounded-full border border-white/[0.04]" />
      </div>

      <div className="relative w-full max-w-sm px-4">
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/40 border border-slate-200/10 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#C8102E] via-[#E8284A] to-[#C8102E]" />

          <div className="p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 bg-[#C8102E] rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/30 mb-4">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                  <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-13-7-13z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">PULSA</h1>
              <p className="text-slate-500 text-sm mt-1 text-center">
                Gestão de Hemocomponentes
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center flex items-center gap-2 justify-center">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                Erro ao fazer login. Tente novamente.
              </div>
            )}

            <button
              onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
              className="w-full flex items-center justify-center gap-3 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold py-3 px-4 rounded-xl transition-all duration-150 shadow-sm shadow-blue-900/20"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Entrar com conta Microsoft
            </button>

            {isDemoMode && (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">demonstração</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <form onSubmit={handleDemoLogin} className="space-y-3">
                  <input
                    type="email"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] transition-all"
                  />
                  <input
                    type="password"
                    value={demoPass}
                    onChange={(e) => setDemoPass(e.target.value)}
                    placeholder="Senha"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] transition-all"
                  />
                  {demoError && (
                    <p className="text-red-600 text-xs">{demoError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#C8102E] hover:bg-[#a50d24] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 text-sm"
                  >
                    {loading ? "Entrando..." : "Entrar (Demo)"}
                  </button>
                </form>
                <p className="mt-3 text-center text-xs text-slate-400">admin@demo.com · demo123</p>
              </div>
            )}
          </div>

          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-slate-400">
              Acesso restrito a colaboradores da PULSA.{" "}
              <a href="/solicitar-acesso" className="text-[#C8102E] hover:text-[#a50d24] font-medium hover:underline transition-colors">
                Solicitar acesso
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Pulsa · Gestão de Hemocomponentes
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
