// ============================================================================
//  O QUE VAI PRO MOTOR DE PRECO
//
//  O motor casa o produto pelo NOME. A conversa guarda o nome junto da
//  CATEGORIA, e essa diferenca custou um pedido inteiro.
//
//  O CASO, IMPRESSO NO PAPEL EM 23/08/2026
//
//  A cliente escolheu bolo de festa sabor prestigio, 2,5 kg. No painel estava
//  certo: "Bolo de festa / prestigio / 2,5 quilos". Na comanda saiu:
//
//    == BOLO CASEIRO ==
//    2,5 un  bolo caseiro prestigio com ganache
//    2,5 un x R$ 33,90 = R$ 84,75
//
//  Porque "prestigio" sozinho, no cardapio, e o nome do BOLO CASEIRO prestigio
//  com ganache, que sai por unidade a R$ 33,90. O bolo de festa prestigio sai
//  por QUILO a R$ 46,90, e so aparece quando o nome comeca com "bolo".
//
//  O estrago passou do preco: o pedido foi pra bancada errada da cozinha.
//
//  ENTAO A CATEGORIA VAI JUNTO
//
//  Aqui o nome e completado com o que a categoria ja sabe, antes de chegar no
//  motor. O que a dona ve na tela nao muda: ela continua vendo "prestigio" no
//  campo de sabor, que e como ela fala.
//
//  Um lugar so, usado pelos tres que perguntam preco (a fala do total, o resumo
//  do pedido e o fechamento), porque numero que diverge entre eles e o pior
//  defeito que este projeto ja teve.
// ============================================================================

export type ItemDaConversa = { produto: string; categoria?: string; qtd: number; obs?: string | null };

/**
 * Os itens do jeito que o motor entende.
 *
 * Sabor de bolo de festa ganha "bolo" na frente: sem isso o motor acha o bolo
 * caseiro de mesmo nome, que e outro produto, outro preco e outra bancada.
 */
export function paraOMotor(itens: ItemDaConversa[]): { item: string; qtd: number; obs?: string }[] {
  return itens.map((i) => {
    const nome = String(i.produto || "").trim();
    const categoria = String(i.categoria || "");
    const jaDizBolo = /^bolo\b/i.test(nome);
    const item = categoria.startsWith("bolo_festa") && !jaDizBolo ? "bolo " + nome : nome;
    return { item, qtd: Number(i.qtd) || 0, obs: i.obs ?? undefined };
  });
}
