import { graphFetch } from "./graph-api";

const WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

// General channel webhook (admin/overview notifications)
async function enviarWebhook(card: { title: string; text: string; actions?: { type: string; name: string; target: string }[] }): Promise<void> {
  if (!WEBHOOK_URL) {
    console.warn("[Teams] TEAMS_WEBHOOK_URL não configurado — pulando envio.");
    return;
  }

  const body = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "C8102E",
    summary: card.title,
    sections: [{ activityTitle: card.title, activityText: card.text }],
    potentialAction: card.actions?.map((a) => ({
      "@type": "OpenUri",
      name: a.name,
      targets: [{ os: "default", uri: a.target }],
    })),
  };

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error("[Teams] Falha ao enviar webhook:", response.statusText);
  }
}

// Send email notification via Microsoft Graph (Mail.Send permission)
// Sent as the admin account (ADMIN_EMAIL env var)
async function enviarEmail(
  para: string,
  assunto: string,
  corpo: string
): Promise<void> {
  const remetente = process.env.ADMIN_EMAIL!;

  const res = await graphFetch(`/users/${encodeURIComponent(remetente)}/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject: assunto,
        body: { contentType: "HTML", content: corpo },
        toRecipients: [{ emailAddress: { address: para } }],
      },
      saveToSentItems: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Email] Erro ao enviar para ${para}:`, err);
  }
}

export async function notificarSolicitacaoAcesso(dados: {
  nome: string;
  email: string;
  agencia: string;
  justificativa: string;
  usuarioId: string;
  appUrl: string;
}): Promise<void> {
  await enviarWebhook({
    title: "🩸 Nova Solicitação de Acesso — PULSA Vencimentos",
    text: `**${dados.nome}** (${dados.email}) solicitou acesso ao sistema.\n\n**Agência:** ${dados.agencia}\n\n**Justificativa:** ${dados.justificativa}`,
    actions: [{ type: "OpenUri", name: "Aprovar ou Rejeitar", target: `${dados.appUrl}/admin/aprovacoes` }],
  });
}

export async function notificarAcessoAprovado(dados: {
  nome: string;
  email: string;
  perfil: string;
}): Promise<void> {
  await enviarWebhook({
    title: "✅ Acesso Aprovado — PULSA Vencimentos",
    text: `O acesso de **${dados.nome}** (${dados.email}) foi **aprovado** com perfil **${dados.perfil}**.`,
  });
}

export async function notificarAcessoRejeitado(dados: {
  nome: string;
  email: string;
}): Promise<void> {
  await enviarWebhook({
    title: "❌ Acesso Rejeitado — PULSA Vencimentos",
    text: `O acesso de **${dados.nome}** (${dados.email}) foi **rejeitado**.`,
  });
}

// Notify each responsável individually about their missing agency file
// Activated from 2026-05-11 onwards
export async function notificarResponsaveisArquivoFaltando(
  agenciasPorResponsavel: { email: string; nome: string; agencias: string[] }[]
): Promise<void> {
  const hoje = new Date();
  const ativacaoNotificacoes = new Date("2026-05-11");
  if (hoje < ativacaoNotificacoes) return;

  for (const resp of agenciasPorResponsavel) {
    const listaAgencias = resp.agencias.join(", ");
    const mensagem =
      `<p>🚨 <b>${resp.nome}</b>,</p>` +
      `<p>O arquivo de estoque de hoje ainda não foi recebido para: <b>${listaAgencias}</b>.</p>` +
      `<p>Por favor, envie o arquivo o quanto antes para manter o controle de vencimentos atualizado.</p>` +
      `<p style="color:#888;font-size:12px;">— PULSA Vencimentos</p>`;

    await enviarEmail(
      resp.email,
      "🚨 PULSA — Arquivo de estoque não recebido",
      mensagem
    );
    console.log(`[Teams] Notificação enviada para ${resp.email} (${listaAgencias})`);
  }
}

// Also send a summary to the admin webhook
export async function notificarAgenciasSemArquivo(agencias: string[]): Promise<void> {
  if (agencias.length === 0) return;
  const lista = agencias.map((a) => `- ${a}`).join("\n");
  await enviarWebhook({
    title: "⚠️ Agências sem arquivo hoje — PULSA Vencimentos",
    text: `As seguintes agências **não enviaram planilha** no processamento de hoje:\n\n${lista}`,
  });
}

export async function notificarVencimentosCriticos(dados: {
  agencia: string;
  vencidos: number;
  hoje: number;
  amanha: number;
}): Promise<void> {
  await enviarWebhook({
    title: `🔴 Vencimentos Críticos — ${dados.agencia}`,
    text: `**${dados.agencia}** tem bolsas em situação crítica:\n\n- Vencidas: **${dados.vencidos}**\n- Vencem hoje: **${dados.hoje}**\n- Vencem amanhã: **${dados.amanha}**`,
  });
}
