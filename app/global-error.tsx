"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-800">Algo deu errado</h2>
          <p className="text-slate-500 text-sm">
            Ocorreu um erro inesperado. Nossa equipe foi notificada.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
