import type { BolsaComAgencia } from "@/types";

export function gerarMensagemWhatsApp(
  bolsas: BolsaComAgencia[],
  agenciaOrigem: string
): string {
  if (bolsas.length === 0) {
    return "Nenhuma bolsa disponível para redistribuição no momento.";
  }

  const urgentes = bolsas.filter((b) =>
    ["vencido", "hoje", "amanha"].includes(b.urgencia)
  );
  const tresDias = bolsas.filter((b) => b.urgencia === "3dias");

  const hoje = new Date().toLocaleDateString("pt-BR");

  const linhas: string[] = [
    `*🩸 HEMOTE — Disponibilidade para Redistribuição*`,
    `*Agência:* ${agenciaOrigem}`,
    `*Data:* ${hoje}`,
    ``,
  ];

  if (urgentes.length > 0) {
    linhas.push(`*⚠️ URGENTES (vencem em até 1 dia):*`);
    urgentes.forEach((b) => {
      const label =
        b.urgencia === "vencido"
          ? "VENCIDO"
          : b.urgencia === "hoje"
            ? "Hoje"
            : "Amanhã";
      linhas.push(
        `- ${b.componente} | ${b.abo}${b.fatorRh} | Doe: ${b.doacao} | Val: ${formatarData(b.validade)} _(${label})_`
      );
    });
    linhas.push(``);
  }

  if (tresDias.length > 0) {
    linhas.push(`*⏰ Vencem em até 3 dias:*`);
    tresDias.forEach((b) => {
      linhas.push(
        `- ${b.componente} | ${b.abo}${b.fatorRh} | Doe: ${b.doacao} | Val: ${formatarData(b.validade)}`
      );
    });
    linhas.push(``);
  }

  linhas.push(`_Mensagem gerada automaticamente pelo sistema HEMOTE._`);

  return linhas.join("\n");
}

function formatarData(isoDate: string): string {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
