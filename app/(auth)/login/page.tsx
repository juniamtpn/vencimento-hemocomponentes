"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
      <div className="w-full max-w-md p-8 bg-[#16213e] rounded-2xl border border-[#0f3460] shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C8102E] rounded-full mb-4">
            <span className="text-2xl">🩸</span>
          </div>
          <h1 className="text-2xl font-bold text-white">HEMOTE Vencimentos</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Controle de vencimento de hemocomponentes
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm text-center">
            Erro ao fazer login. Tente novamente.
          </div>
        )}

        <button
          onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-3 bg-[#0078d4] hover:bg-[#106ebe] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Entrar com conta Microsoft
        </button>

        <p className="mt-6 text-center text-xs text-gray-500">
          Acesso restrito a colaboradores do HEMOTE.{" "}
          <a
            href="/solicitar-acesso"
            className="text-[#C8102E] hover:underline"
          >
            Solicitar acesso
          </a>
        </p>
      </div>
    </div>
  );
}
