// O QUE O AVISO DO NAVEGADOR ESCREVE QUANDO ENTRA PEDIDO.
//
// POR QUE ISTO EXISTE
//
// O `SinoNotificacao` tinha o `avisarNoNavegador` escrito, pedindo permissao
// pra padaria junto com o som, listado como dependencia do efeito, e NUNCA
// CHAMADO. A padaria autorizou a notificacao e nao recebeu nenhuma. O
// comentario dele dizia que era pra funcionar com a aba minimizada, "que e o
// caso real da padaria": era justamente o caso que nao funcionava.
//
// O texto saiu do componente pra poder ser medido sem subir a tela, do mesmo
// jeito que a busca do cliente e o texto da cobranca sairam.
//
// A REGRA
//
// So sai daqui o que a contagem REALMENTE traz. Quando ela traz o item, o aviso
// diz o nome e o valor, que e o que faz alguem largar o forno e vir olhar. Sem
// item, diz quantos entraram e onde, sem inventar detalhe nenhum.

import { brl } from "@/lib/tipos";

export type ItemDoSino = {
  id: string;
  nome: string;
  total: number;
  onde: "fila" | "aguardando";
  motivo: string | null;
};
export type Contagem = {
  fila: number;
  aguardando: number;
  ajuda: number;
  itens?: ItemDoSino[];
};

export function recadoDoSino(nova: Contagem, antes: Contagem): string {
  const novos = Math.max(
    0,
    nova.fila - antes.fila + (nova.aguardando - antes.aguardando) + (nova.ajuda - antes.ajuda),
  );

  // Um pedido so, e o sino sabe qual: diz o nome e o valor.
  if (novos === 1) {
    const conhecidos = new Set((antes.itens ?? []).map((i) => i.id));
    const chegou = (nova.itens ?? []).find((i) => !conhecidos.has(i.id));
    if (chegou) {
      return chegou.total > 0
        ? chegou.nome + ", " + brl(chegou.total)
        : "Pedido novo de " + chegou.nome;
    }
  }

  // Cliente pedindo pra falar com gente vem antes da contagem de pedido: e a
  // unica das tres que tem alguem esperando resposta AGORA.
  if (nova.ajuda > antes.ajuda) return "Um cliente pediu pra falar com a equipe";
  if (novos > 1) return novos + " pedidos novos esperando";
  return "Pedido novo esperando";
}
