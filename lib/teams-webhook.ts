const WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL!;

interface TeamsCard {
  title: string;
  text: string;
  actions?: { type: string; name: string; target: string }[];
}

async function enviarCard(card: TeamsCard): Promise<void> {
  if (!WEBHOOK_URL) {
    console.warn("[Teams] TEAMS_WEBHOOK_URL não configurado — pulando envio.");
    return;
  }

  const body = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "C8102E",
    summary: card.title,
    sections: [
      {
        activityTitle: card.title,
        activityText: card.text,
      },
    ],
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

export async function notificarSolicitacaoAcesso(dados: {
  nome: string;
  email: string;
  agencia: string;
  justificativa: string;
  usuarioId: string;
  appUrl: string;
}): Promise<void> {
  await enviarCard({
    title: "🩸 Nova Solicitação de Acesso — HEMOTE Vencimentos",
    text: `**${dados.nome}** (${dados.email}) solicitou acesso ao sistema.\n\n**Agência:** ${dados.agencia}\n\n**Justificativa:** ${dados.justificativa}`,
    actions: [
      {
        type: "OpenUri",
        name: "Aprovar ou Rejeitar",
        target: `${dados.appUrl}/admin/aprovacoes`,
      },
    ],
  });
}

export async function notificarAcessoAprovado(dados: {
  nome: string;
  email: string;
  perfil: string;
}): Promise<void> {
  await enviarCard({
    title: "✅ Acesso Aprovado — HEMOTE Vencimentos",
    text: `O acesso de **${dados.nome}** (${dados.email}) foi **aprovado** com perfil **${dados.perfil}**.`,
  });
}

export async function notificarAcessoRejeitado(dados: {
  nome: string;
  email: string;
}): Promise<void> {
  await enviarCard({
    title: "❌ Acesso Rejeitado — HEMOTE Vencimentos",
    text: `O acesso de **${dados.nome}** (${dados.email}) foi **rejeitado**.`,
  });
}

export async function notificarAgenciasSemArquivo(
  agencias: string[]
): Promise<void> {
  if (agencias.length === 0) return;
  const lista = agencias.map((a) => `- ${a}`).join("\n");
  await enviarCard({
    title: "⚠️ Agências sem arquivo hoje — HEMOTE Vencimentos",
    text: `As seguintes agências **não enviaram planilha** no cron de hoje:\n\n${lista}`,
  });
}

export async function notificarVencimentosCriticos(dados: {
  agencia: string;
  vencidos: number;
  hoje: number;
  amanha: number;
}): Promise<void> {
  await enviarCard({
    title: `🔴 Vencimentos Críticos — ${dados.agencia}`,
    text: `**${dados.agencia}** tem bolsas em situação crítica:\n\n- Vencidas: **${dados.vencidos}**\n- Vencem hoje: **${dados.hoje}**\n- Vencem amanhã: **${dados.amanha}**`,
  });
}
