"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 hidden sm:block">Sair?</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs font-medium text-red-400 hover:text-red-300 px-2 py-1 transition-colors"
        >
          Sim
        </button>
        <button
          onClick={() => setConfirmando(false)}
          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors"
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
      </svg>
      <span className="hidden sm:block">Sair</span>
    </button>
  );
}
