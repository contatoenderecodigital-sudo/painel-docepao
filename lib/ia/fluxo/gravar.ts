// ============================================================================
//  DO FLUXO NOVO PRO PEDIDO EM MONTAGEM
//
//  O fluxo novo guarda o estado da conversa em memoria. Esta peca leva isso pro
//  MESMO lugar que o painel ja le e edita hoje: `docepao.pedido_montagem`.
//
//  POR QUE NA MESMA ESTRUTURA
//
//  Pedido do dono em 23/08/2026, olhando a tela dele: "tem que salvar aqui
//  tambem e dar pra alterar igual antes".
//
//  Ele esta certo, e e a parte do sistema que nunca deu problema. Na tela a
//  dona troca a categoria, troca o produto, muda a quantidade e escreve o
//  recheio, com os chips de sabor do lado. Se o fluxo novo gravasse noutro
//  formato, ela perderia tudo isso e a impressora tambem, porque o cupom sai da
//  mesma fonte.
//
//  Entao aqui nao se inventa nada: usa `anotarItem` e `anotarDados`, que sao as
//  funcoes que o painel usa. O fluxo mudou; o pedido continua o mesmo.
//
//  E POR ISSO O PAINEL E A IMPRESSAO NAO PRECISAM DE UMA LINHA NOVA.
// ============================================================================

import { anotarItem, anotarDados, lerMontagem, limparMontagem } from "@/lib/banco/montagem";
import { unidadeDoProduto } from "@/lib/ia/cerebro";
import type { Estado } from "./fluxo";

/** O que ja esta gravado, no formato que o fluxo entende. */
export async function lerEstadoDoBanco(negocioId: string, clienteId: string): Promise<Partial<Estado>> {
  const m = await lerMontagem(negocioId, clienteId);
  const d = (m.dados ?? {}) as Record<string, string | null>;
  return {
    itens: (m.itens ?? []).map((i) => ({
      produto: String(i.produto),
      categoria: String(i.categoria ?? ""),
      qtd: Number(i.qtd) || 0,
      obs: i.obs ?? null,
    })),
    dados: {
      nome: d.cliente_nome ?? null,
      data: d.retirada_data ?? null,
      hora: d.retirada_hora ?? null,
      pagamento: d.forma_pagamento ?? null,
    },
    // O que o cliente dispensou fica junto dos dados: a tela ja mostra isso.
    naoQuer: String(d.nao_quer ?? "").split(",").map((x) => x.trim()).filter(Boolean),
  };
}

/**
 * GRAVA O QUE MUDOU.
 *
 * So o que mudou: chamar anotarItem pra tudo a cada mensagem faria a linha ser
 * reescrita sem necessidade, e a dona perderia o que tivesse editado na tela
 * entre uma mensagem e outra do cliente.
 */
export async function gravarEstado(
  negocioId: string,
  clienteId: string,
  antes: Estado,
  depois: Estado,
): Promise<void> {
  // ------------------------------------------------------------- itens
  const chave = (i: { produto: string; categoria: string }) =>
    String(i.produto).toLowerCase().trim() + "|" + String(i.categoria);
  const jaEra = new Map(antes.itens.map((i) => [chave(i), i]));

  for (const i of depois.itens) {
    const velho = jaEra.get(chave(i));
    // Item igualzinho nao volta pro banco: a dona pode ter mexido na tela.
    if (velho && velho.qtd === i.qtd && (velho.obs ?? null) === (i.obs ?? null)) continue;
    await anotarItem(negocioId, clienteId, {
      produto: i.produto,
      categoria: i.categoria as never,
      qtd: i.qtd,
      // A unidade sai do cardapio, que e a mesma fonte do preco. Foi assim que
      // 1,5 kg de empadao virava "1 un" na versao antiga.
      unidade: unidadeDoProduto(i.produto, i.categoria),
      obs: i.obs ?? null,
    });
  }

  // ------------------------------------------------------------- dados
  const mudou: Record<string, string> = {};
  const par = [
    ["cliente_nome", antes.dados.nome, depois.dados.nome],
    ["retirada_data", antes.dados.data, depois.dados.data],
    ["retirada_hora", antes.dados.hora, depois.dados.hora],
    ["forma_pagamento", antes.dados.pagamento, depois.dados.pagamento],
  ] as const;
  for (const [campo, velho, novo] of par) {
    if (novo && novo !== velho) mudou[campo] = String(novo);
  }
  // O que ele dispensou tambem e dado: sem isso a etapa pulada volta a ser
  // perguntada quando a conversa recomeca do banco.
  if (depois.naoQuer.length && depois.naoQuer.join(",") !== antes.naoQuer.join(",")) {
    mudou.nao_quer = depois.naoQuer.join(", ");
  }
  if (Object.keys(mudou).length) await anotarDados(negocioId, clienteId, mudou as never);
}

/** O cliente mandou recomecar: apaga tudo, itens e dados. */
export async function zerar(negocioId: string, clienteId: string): Promise<void> {
  await limparMontagem(negocioId, clienteId);
}
