import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processarVencimentos } from "@/lib/processar-vencimentos";
import { db } from "@/lib/db";
import { execucoesCron } from "@/lib/db/schema";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !["admin", "lideranca"].includes((session.user as { perfil?: string }).perfil ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  const iniciadoEm = Math.floor(Date.now() / 1000);
  try {
    const resultado = await processarVencimentos("manual");
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Processar] Erro:", error);
    await db.insert(execucoesCron).values({
      id: nanoid(),
      iniciadoEm,
      finalizadoEm: Math.floor(Date.now() / 1000),
      triggeredBy: "manual",
      status: "erro_fatal",
      totalAgencias: 0,
      processadas: 0,
      semArquivo: 0,
      erros: 0,
      mensagemErro: msg,
    }).catch(() => {});
    return NextResponse.json({ error: "Erro no processamento", detail: msg }, { status: 500 });
  }
}
