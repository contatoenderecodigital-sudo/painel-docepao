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
import { unidadeDoPedido as unidadeDoProduto } from "@/lib/ia/dados/produtos";
import type { Estado } from "./fluxo";
import type { EtapaId } from "./etapas";

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

    // ------------------------------------------------- a memoria da conversa
    ...estadoDosDados(d),
  };
}

/**
 * A MEMORIA DA CONVERSA, LIDA DO BANCO.
 *
 * ISTO FALTAVA, E ERA O DEFEITO MAIS CARO DO FLUXO NOVO.
 *
 * No WhatsApp cada mensagem e uma chamada nova: o estado nasce do banco e morre
 * no fim. Como so item e dados eram gravados, tudo o mais se perdia entre uma
 * mensagem e outra do cliente.
 *
 * Na pratica: ele dizia "festa pra 20 pessoas", recebia a proposta de R$ 418,80
 * e tocava em "Pode ser". A mensagem do botao chegava com ehFesta false,
 * pessoas null e base null, entao nao havia base pra virar pedido: o aceite
 * dele caia no vazio e a conversa voltava pro comeco.
 *
 * Nos testes passava porque la a conversa inteira roda dentro de uma chamada
 * so, com o estado vivo na memoria. Conversa de verdade nao e assim.
 *
 * E funcao pura e exportada de proposito: assim da pra provar a ida e a volta
 * sem banco nenhum, que e o teste que faltava existir.
 */
export function estadoDosDados(d: Record<string, string | null | undefined>): Partial<Estado> {
  return {
    ehFesta: d.fluxo_festa === "sim",
    pessoas: Number(d.fluxo_pessoas) > 0 ? Number(d.fluxo_pessoas) : null,
    baseAceita: d.fluxo_base_aceita === "sim",
    pecas: lerPecas(d.fluxo_topo, d.fluxo_papel),
    topoNome: d.fluxo_topo_nome || null,
    topoIdade: d.fluxo_topo_idade || null,
    tema: d.fluxo_tema || null,
    escrito: d.fluxo_escrito || null,
    forminha: d.fluxo_forminha || null,
    prato: d.fluxo_prato === "aberto" || d.fluxo_prato === "tampa" ? d.fluxo_prato : null,
    ofereceu: d.fluxo_ofereceu === "sim",
    ultimaFala: d.fluxo_ultima_fala || null,
    insistiu: Number(d.fluxo_insistiu) || 0,
    // DE QUE ETAPA VEIO A ULTIMA PERGUNTA.
    //
    // Precisa sobreviver a mensagem, senao a regra dos detalhes opcionais nunca
    // dispara: no WhatsApp cada mensagem e uma chamada nova, e "eu ja perguntei
    // isso" so existe se estiver gravado.
    etapasJaPerguntadas:
      d.fluxo_perguntei && d.fluxo_perguntei !== "nenhum"
        ? (String(d.fluxo_perguntei).split(",").filter(Boolean) as EtapaId[])
        : [],
    assunto: d.fluxo_assunto && d.fluxo_assunto !== "nenhum" ? (d.fluxo_assunto as EtapaId) : null,
    retomarEm: d.fluxo_retomar && d.fluxo_retomar !== "nenhum" ? (d.fluxo_retomar as EtapaId) : null,
    // O QUE ELE PEDIU FORA DA HORA PRECISA SOBREVIVER A MENSAGEM.
    //
    // No WhatsApp cada mensagem e uma chamada nova, com o estado lido do banco.
    // Se o guardado nao passasse por aqui, o bolo citado durante o docinho
    // sumiria do mesmo jeito: a etapa do bolo so chega na mensagem seguinte.
    guardados: lerGuardados(d.fluxo_guardados),
  };
}

/** O que ficou guardado, gravado como JSON. Lista vazia quando nao ha nada. */
function lerGuardados(bruto?: string | null): { produto: string; qtd: number; obs?: string | null }[] {
  if (!bruto || bruto === "nenhum") return [];
  try {
    const lista = JSON.parse(String(bruto));
    return Array.isArray(lista) ? lista.slice(0, 20) : [];
  } catch {
    // JSON quebrado nao pode derrubar a conversa: perde-se o guardado, nao o atendimento.
    console.warn("[fluxo] fluxo_guardados ilegivel, ignorando");
    return [];
  }
}

/**
 * Cada peca tem tres estados, e o banco guarda os tres.
 *
 * Ausente e "ainda nao perguntei", que e diferente de "ele disse que nao". Sem
 * essa diferenca a padaria nao consegue perguntar de uma peca de cada vez: ela
 * nao saberia qual das duas ja tem resposta.
 */
function lerPecas(
  topo: string | null | undefined,
  papel: string | null | undefined,
): { topo: boolean | null; papelDeArroz: boolean | null } | null {
  const ler = (v: string | null | undefined) => {
    const t = String(v ?? "").trim().toLowerCase();
    if (!t) return null;
    return t === "sim";
  };
  const t = ler(topo);
  const p = ler(papel);
  if (t === null && p === null) return null;
  return { topo: t, papelDeArroz: p };
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
  // A memoria da conversa vai pelo mesmo caminho dos dados porque e o mesmo
  // lugar: `dados` e jsonb, e campo que a tela nao mostra nao atrapalha a tela.
  Object.assign(mudou, dadosQueMudaram(antes, depois));

  if (Object.keys(mudou).length) await anotarDados(negocioId, clienteId, mudou as never);
}

/** O cliente mandou recomecar: apaga tudo, itens e dados. */
export async function zerar(negocioId: string, clienteId: string): Promise<void> {
  await limparMontagem(negocioId, clienteId);
}

/**
 * A MEMORIA DA CONVERSA, ESCRITA PRO BANCO.
 *
 * So o que mudou, pelo mesmo motivo dos itens: gravar tudo a cada mensagem
 * passaria por cima do que a dona editasse na tela.
 *
 * O QUE SE APAGA VIRA A PALAVRA "nenhum".
 *
 * anotarDados nao grava valor vazio, de proposito: string vazia era jeito comum
 * de apagar dado sem querer. Entao o vazio aqui tem que ter nome, senao uma
 * etapa resolvida nunca se desmarcava.
 */
export function dadosQueMudaram(antes: Estado, depois: Estado): Record<string, string> {
  const mudou: Record<string, string> = {};
  if (depois.ehFesta && !antes.ehFesta) mudou.fluxo_festa = "sim";
  if (depois.pessoas && depois.pessoas !== antes.pessoas) mudou.fluxo_pessoas = String(depois.pessoas);
  if (depois.baseAceita && !antes.baseAceita) mudou.fluxo_base_aceita = "sim";
  const simNao = (v: boolean | null | undefined) => (v === true ? "sim" : v === false ? "nao" : null);
  const topoAntes = simNao(antes.pecas?.topo);
  const topoDepois = simNao(depois.pecas?.topo);
  if (topoDepois && topoDepois !== topoAntes) mudou.fluxo_topo = topoDepois;
  const papelAntes = simNao(antes.pecas?.papelDeArroz);
  const papelDepois = simNao(depois.pecas?.papelDeArroz);
  if (papelDepois && papelDepois !== papelAntes) mudou.fluxo_papel = papelDepois;
  if (depois.topoNome && depois.topoNome !== antes.topoNome) mudou.fluxo_topo_nome = depois.topoNome;
  if (depois.topoIdade && depois.topoIdade !== antes.topoIdade) mudou.fluxo_topo_idade = depois.topoIdade;
  if (depois.tema && depois.tema !== antes.tema) mudou.fluxo_tema = depois.tema;
  if (depois.escrito && depois.escrito !== antes.escrito) mudou.fluxo_escrito = depois.escrito;
  if (depois.forminha && depois.forminha !== antes.forminha) mudou.fluxo_forminha = depois.forminha;
  if (depois.prato && depois.prato !== antes.prato) mudou.fluxo_prato = depois.prato;
  if (depois.ofereceu && !antes.ofereceu) mudou.fluxo_ofereceu = "sim";
  // A ultima pergunta e a contagem de insistencia: sem isso a padaria nao sabe
  // que ja perguntou aquilo, porque cada mensagem e uma execucao nova.
  if ((depois.ultimaFala ?? null) !== (antes.ultimaFala ?? null)) {
    mudou.fluxo_ultima_fala = depois.ultimaFala ?? "nenhum";
  }
  if ((depois.insistiu ?? 0) !== (antes.insistiu ?? 0)) {
    mudou.fluxo_insistiu = String(depois.insistiu ?? 0);
  }
  // A lista inteira, separada por virgula. Perguntado uma vez, perguntado pra
  // sempre: sem isto a etapa reabre na mensagem seguinte.
  const perguntadasAntes = (antes.etapasJaPerguntadas ?? []).join(",");
  const perguntadasDepois = (depois.etapasJaPerguntadas ?? []).join(",");
  if (perguntadasDepois !== perguntadasAntes) {
    mudou.fluxo_perguntei = perguntadasDepois || "nenhum";
  }
  if ((depois.assunto ?? null) !== (antes.assunto ?? null)) mudou.fluxo_assunto = depois.assunto ?? "nenhum";
  if ((depois.retomarEm ?? null) !== (antes.retomarEm ?? null)) mudou.fluxo_retomar = depois.retomarEm ?? "nenhum";
  // O GUARDADO MUDOU? Grava a lista inteira, e "nenhum" quando esvazia.
  //
  // Comparar por JSON e o suficiente: a lista e curta e muda pouco. O que nao
  // pode e deixar de gravar quando ela ESVAZIA, senao o item ja aplicado volta
  // a entrar na proxima mensagem e o pedido ganha linha repetida.
  {
    const antesJson = JSON.stringify(antes.guardados ?? []);
    const depoisJson = JSON.stringify(depois.guardados ?? []);
    if (antesJson !== depoisJson) {
      mudou.fluxo_guardados = (depois.guardados ?? []).length ? depoisJson : "nenhum";
    }
  }

  return mudou;
}
