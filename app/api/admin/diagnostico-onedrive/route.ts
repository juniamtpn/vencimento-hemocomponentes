import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDevSession } from "@/lib/dev-session";
import { getGraphToken } from "@/lib/graph-api";

export const runtime = "nodejs";

function emailToSharePointUser(email: string): string {
  return email.replace(/[@.]/g, "_");
}

export async function GET() {
  const session = getDevSession() ?? await getServerSession(authOptions);
  if (!session || (session.user as { perfil?: string }).perfil !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const userEmail = process.env.ONEDRIVE_USER_EMAIL ?? "";
  const sharepointHost = process.env.ONEDRIVE_SHAREPOINT_HOST ?? "";
  const folderPath = process.env.ONEDRIVE_FOLDER_PATH ?? "(raiz)";
  const directDriveId = process.env.ONEDRIVE_DRIVE_ID ?? "";

  const result: Record<string, unknown> = {
    env: {
      ONEDRIVE_DRIVE_ID: directDriveId || "(não configurado)",
      ONEDRIVE_USER_EMAIL: userEmail || "(não configurado)",
      ONEDRIVE_SHAREPOINT_HOST: sharepointHost || "(não configurado)",
      ONEDRIVE_FOLDER_PATH: folderPath,
    },
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

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let driveId: string | undefined;

  // Test 2: ONEDRIVE_DRIVE_ID direto
  if (directDriveId) {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${directDriveId}?$select=id,owner`,
      { headers }
    );
    const body = await res.json();
    if (res.ok) {
      driveId = directDriveId;
      result.drive_via_id_direto = "OK";
      result.drive_owner = body.owner?.user?.displayName ?? body.owner?.user?.email ?? "?";
      result.INSTRUCAO = "Drive ID direto funcionou! Mantenha ONEDRIVE_DRIVE_ID configurado.";
    } else {
      result.drive_via_id_direto = `ERRO HTTP ${res.status}`;
      result.drive_via_id_direto_erro = body;
    }
  }

  // Test 3: /users/{email}/drive
  if (!driveId && userEmail) {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/drive?$select=id,owner`,
      { headers }
    );
    const body = await res.json();
    if (res.ok) {
      driveId = body.id;
      result.drive_via_user = "OK";
      result.drive_id = driveId;
      result.drive_owner = body.owner?.user?.displayName ?? "?";
      result.INSTRUCAO = `Adicione ao Vercel: ONEDRIVE_DRIVE_ID=${driveId}`;
    } else {
      result.drive_via_user = `ERRO HTTP ${res.status}: ${body?.error?.code}`;
      result.drive_via_user_erro = body;
    }
  }

  // Test 4: /sites/{host}:/personal/{sanitizedUser}:/drive
  if (!driveId && (sharepointHost || userEmail)) {
    const host = sharepointHost || (() => {
      const domain = userEmail.split("@")[1];
      const org = domain.split(".")[0];
      return `${org}-my.sharepoint.com`;
    })();

    const spUser = emailToSharePointUser(userEmail || "");
    result.sharepoint_tentativa = `${host}:/personal/${spUser}`;

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${host}:/personal/${spUser}:/drive?$select=id,owner`,
      { headers }
    );
    const body = await res.json();
    if (res.ok) {
      driveId = body.id;
      result.drive_via_sharepoint = "OK";
      result.drive_id = driveId;
      result.drive_owner = body.owner?.user?.displayName ?? body.owner?.user?.email ?? "?";
      result.INSTRUCAO = `Adicione ao Vercel: ONEDRIVE_DRIVE_ID=${driveId}`;
    } else {
      result.drive_via_sharepoint = `ERRO HTTP ${res.status}: ${body?.error?.code}`;
      result.drive_via_sharepoint_erro = body;
    }
  }

  // Test 5: buscar usuário por nome (requer User.Read.All)
  if (!driveId && userEmail) {
    const nome = userEmail.split("@")[0].replace(".", " ");
    const searchRes = await fetch(
      `https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${nome.split(" ")[0]}')&$select=id,displayName,userPrincipalName,mail`,
      { headers }
    );
    if (searchRes.ok) {
      const searchBody = await searchRes.json();
      result.busca_usuario = searchBody.value?.slice(0, 5) ?? [];
      result.DICA = "Verifique o userPrincipalName correto acima e atualize ONEDRIVE_USER_EMAIL";
    } else {
      result.busca_usuario = `ERRO: ${searchRes.status}`;
    }
  }

  if (!driveId) {
    result.conclusao = "FALHOU — nenhuma abordagem obteve o drive ID";
    return NextResponse.json(result);
  }

  // Test 6: get root/target folder
  const fp = process.env.ONEDRIVE_FOLDER_PATH ?? "";
  const folderEndpoint = fp
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:${fp}?$select=id,name`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/root?$select=id,name`;

  const folderRes = await fetch(folderEndpoint, { headers });
  const folderBody = await folderRes.json();
  if (!folderRes.ok) {
    result.pasta = `ERRO HTTP ${folderRes.status}`;
    result.pasta_erro = folderBody;
    return NextResponse.json(result);
  }
  result.pasta = "OK";
  result.pasta_id = folderBody.id;
  result.pasta_nome = folderBody.name;
  result.conclusao = "TUDO OK — OneDrive acessível";

  return NextResponse.json(result);
}
