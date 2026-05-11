import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDevSession } from "@/lib/dev-session";
import { getGraphToken } from "@/lib/graph-api";

export const runtime = "nodejs";

export async function GET() {
  const session = getDevSession() ?? await getServerSession(authOptions);
  if (!session || (session.user as { perfil?: string }).perfil !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const userEmail = process.env.ONEDRIVE_USER_EMAIL ?? "";
  const folderPath = process.env.ONEDRIVE_FOLDER_PATH ?? "(raiz)";

  const result: Record<string, unknown> = {
    onedrive_user_email: userEmail || "(não configurado)",
    onedrive_folder_path: folderPath,
  };

  // Test 1: get Graph token
  let token: string;
  try {
    token = await getGraphToken();
    result.graph_token = "OK";
  } catch (e) {
    result.graph_token = "ERRO";
    result.graph_token_erro = String(e);
    return NextResponse.json(result);
  }

  if (!userEmail) {
    result.drive = "PULADO (ONEDRIVE_USER_EMAIL não configurado)";
    return NextResponse.json(result);
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Test 2: get user drive
  let driveId: string;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/drive?$select=id,owner`,
      { headers }
    );
    const body = await res.json();
    if (!res.ok) {
      result.drive = `ERRO HTTP ${res.status}`;
      result.drive_erro = body;
      return NextResponse.json(result);
    }
    driveId = body.id;
    result.drive = "OK";
    result.drive_id = driveId;
    result.drive_owner = body.owner?.user?.displayName ?? "?";
  } catch (e) {
    result.drive = "ERRO";
    result.drive_erro = String(e);
    return NextResponse.json(result);
  }

  // Test 3: get root/target folder
  const fp = process.env.ONEDRIVE_FOLDER_PATH ?? "";
  const folderEndpoint = fp
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:${fp}?$select=id,name`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/root?$select=id,name`;

  try {
    const res = await fetch(folderEndpoint, { headers });
    const body = await res.json();
    if (!res.ok) {
      result.pasta = `ERRO HTTP ${res.status}`;
      result.pasta_erro = body;
      return NextResponse.json(result);
    }
    result.pasta = "OK";
    result.pasta_id = body.id;
    result.pasta_nome = body.name;
  } catch (e) {
    result.pasta = "ERRO";
    result.pasta_erro = String(e);
    return NextResponse.json(result);
  }

  return NextResponse.json(result);
}
