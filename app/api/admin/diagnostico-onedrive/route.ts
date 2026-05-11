import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDevSession } from "@/lib/dev-session";
import { getGraphToken, encodeShareUrl } from "@/lib/graph-api";

export const runtime = "nodejs";

export async function GET() {
  const session = getDevSession() ?? await getServerSession(authOptions);
  if (!session || (session.user as { perfil?: string }).perfil !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const shareUrl = process.env.ONEDRIVE_SHARING_URL ?? "";
  const urlMasked = shareUrl.length > 20
    ? shareUrl.slice(0, 40) + "…" + shareUrl.slice(-10)
    : "(vazia)";

  const result: Record<string, unknown> = {
    onedrive_url_configurada: !!shareUrl,
    onedrive_url_preview: urlMasked,
  };

  // Test 1: get Graph token
  try {
    const token = await getGraphToken();
    result.graph_token = "OK";
    result.graph_token_preview = token.slice(0, 20) + "…";
  } catch (e) {
    result.graph_token = "ERRO";
    result.graph_token_erro = String(e);
    return NextResponse.json(result);
  }

  if (!shareUrl) {
    result.shares_endpoint = "PULADO (URL vazia)";
    return NextResponse.json(result);
  }

  // Test 2: call /shares endpoint
  const encoded = encodeShareUrl(shareUrl);
  result.encoded_share = encoded.slice(0, 30) + "…";

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${encoded}/root?$select=id,name,parentReference`,
      {
        headers: {
          Authorization: `Bearer ${await getGraphToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    const body = await res.json();
    if (res.ok) {
      result.shares_endpoint = "OK";
      result.drive_id = body.parentReference?.driveId ?? "?";
      result.item_id = body.id ?? "?";
      result.item_name = body.name ?? "?";
    } else {
      result.shares_endpoint = `ERRO HTTP ${res.status}`;
      result.shares_erro = body;
    }
  } catch (e) {
    result.shares_endpoint = "ERRO";
    result.shares_erro = String(e);
  }

  return NextResponse.json(result, { status: 200 });
}
