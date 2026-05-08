import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processarVencimentos } from "@/lib/processar-vencimentos";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Allow cron secret or authenticated admin/lideranca users
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !["admin", "lideranca"].includes((session.user as { perfil?: string }).perfil ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  try {
    const resultado = await processarVencimentos();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("[Processar] Erro:", error);
    return NextResponse.json({ error: "Erro no processamento" }, { status: 500 });
  }
}
