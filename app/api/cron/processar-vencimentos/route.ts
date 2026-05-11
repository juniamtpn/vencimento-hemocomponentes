import { NextRequest, NextResponse } from "next/server";
import { processarVencimentos } from "@/lib/processar-vencimentos";
import { db } from "@/lib/db";
import { execucoesCron } from "@/lib/db/schema";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const iniciadoEm = Math.floor(Date.now() / 1000);
  try {
    const resultado = await processarVencimentos("cron");
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Cron] Erro no processamento:", error);
    await db.insert(execucoesCron).values({
      id: nanoid(),
      iniciadoEm,
      finalizadoEm: Math.floor(Date.now() / 1000),
      triggeredBy: "cron",
      status: "erro_fatal",
      totalAgencias: 0,
      processadas: 0,
      semArquivo: 0,
      erros: 0,
      mensagemErro: msg,
    }).catch(() => {});
    return NextResponse.json({ error: "Erro no processamento", detail: msg, stack }, { status: 500 });
  }
}
