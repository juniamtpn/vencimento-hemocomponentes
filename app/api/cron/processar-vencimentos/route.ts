import { NextRequest, NextResponse } from "next/server";
import { processarVencimentos } from "@/lib/processar-vencimentos";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resultado = await processarVencimentos();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Cron] Erro no processamento:", error);
    return NextResponse.json({ error: "Erro no processamento", detail: msg, stack }, { status: 500 });
  }
}
