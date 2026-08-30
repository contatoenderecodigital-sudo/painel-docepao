// STATUS DO WHATSAPP: entregue, lida, falhou.
//
// A Meta manda isto num webhook proprio, e as vezes no MESMO pacote de uma
// mensagem nova. Quem so olha `statuses` quando `messages` esta vazio perde o
// recibo: o UPDATE nunca roda, e o painel fica sem entregue/lida mesmo com o
// evento na porta.
//
// Aqui so se extraem os eventos. Gravar e logar e de quem chama. Recibo nao se
// inventa: se o id nao casar com mensagem nenhuma, o banco fica como estava.

export type StatusWhatsapp = {
  id: string;
  situacao: string;
  erro?: string;
};

type Pacote = {
  messages?: unknown[];
  statuses?: {
    id?: string;
    status?: string;
    errors?: { title?: string; message?: string }[];
  }[];
};

export function statusesDoWebhook(valor: Pacote | null | undefined): StatusWhatsapp[] {
  const saida: StatusWhatsapp[] = [];
  for (const st of valor?.statuses ?? []) {
    if (!st?.id || !st.status) continue;
    const erro = st.errors?.[0]?.title || st.errors?.[0]?.message;
    saida.push({
      id: st.id,
      situacao: st.status,
      ...(erro ? { erro: String(erro) } : {}),
    });
  }
  return saida;
}

export function pacoteTemMensagem(valor: Pacote | null | undefined): boolean {
  return Boolean(valor?.messages?.length);
}
