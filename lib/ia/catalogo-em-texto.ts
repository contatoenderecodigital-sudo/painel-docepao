// ============================================================================
//  O CATÁLOGO VIRANDO TEXTO PRA IA LER.
//
//  Por que isto existe:
//
//  A lista de produtos e sabores estava escrita À MÃO dentro do prompt, e de
//  novo dentro do catalogo.json, e de novo nas imagens do cardápio. Três cópias
//  da mesma verdade, e elas divergiram exatamente como se espera:
//
//   - o prompt dizia que o chodó era de calabresa; o catálogo dizia presunto e
//     queijo, que é o que a dona falou no áudio. A IA oferecia calabresa e o
//     próprio código recusava depois.
//   - o prompt oferecia bolo salgado de calabresa; a casa faz frango, presunto
//     ou legumes.
//   - o prompt dizia que empadão com palmito era só de palmito; a dona disse
//     "se ACRESCENTAR o palmito", e a venda de frango com palmito era recusada.
//
//  Nenhuma dessas divergências aparecia em teste nenhum, porque texto de prompt
//  não é verificado por ninguém. Agora o texto NASCE do catálogo: mexer no JSON
//  muda o que a Dora fala, e não existe mais um segundo lugar pra esquecer.
//
//  A tabela de PREÇOS continua fora do prompt de propósito: preço sai de
//  ferramenta, nunca da memória dela. Aqui vai só o que ela precisa pra
//  conversar, ou seja, o que existe e que sabor tem.
// ============================================================================

import catalogo from "./dados/catalogo.json";

type ItemSimples = { nome: string; preco?: number };
type Salgado = { nome: string; recheio?: string; recheios?: string[]; _nota?: string };
type Produto = {
  nome: string;
  preco: number;
  categoria: string;
  unidade?: string;
  sabores?: string[];
  _nota?: string;
};

function lista(nomes: string[]): string {
  return nomes.join(", ");
}

// "coxinha (frango)" quando o recheio é fixo; só o nome quando não tem.
function comRecheioFixo(itens: Salgado[]): string {
  return itens
    .map((i) => (i.recheio ? `${i.nome} (${i.recheio})` : i.nome))
    .join(", ");
}

// "pastel assado, esfirra e croissant (carne, frango, ...)" agrupando quem
// compartilha a mesma lista, que é como a dona fala e como economiza token.
function agrupadoPorRecheios(itens: Salgado[]): string {
  const grupos = new Map<string, string[]>();
  for (const i of itens) {
    if (!i.recheios?.length) continue;
    const chave = i.recheios.join(", ");
    grupos.set(chave, [...(grupos.get(chave) ?? []), i.nome]);
  }
  return [...grupos.entries()]
    .map(([recheios, nomes]) => `${lista(nomes)} (${recheios})`)
    .join("; ");
}

export function catalogoEmTexto(): string {
  const s = catalogo as unknown as {
    salgados: { frito: { itens: Salgado[] }; assado: { itens: Salgado[] } };
    doces: { itens: (ItemSimples & { sabores?: string[] })[] };
    bolos_recheados: { faixas: { sabores: string[] }[] };
    bolos_caseiros: { itens: ItemSimples[] };
    pizza: { sabores_salgados?: string[]; sabores_doces?: string[] };
    outros_produtos: Produto[];
    forminhas_docinho: { cores: string[] };
  };

  const fritos = s.salgados.frito.itens;
  const assados = s.salgados.assado.itens;
  const fritoFixo = fritos.filter((i) => !i.recheios?.length);
  const fritoComSabor = fritos.filter((i) => i.recheios?.length);
  const assadoFixo = assados.filter((i) => !i.recheios?.length);

  // A trufa e um item so no catalogo, com a lista de sabores dentro dele.
  const doces = s.doces.itens.filter((i) => !i.sabores?.length).map((i) => i.nome);
  const trufas = s.doces.itens.find((i) => i.sabores?.length)?.sabores ?? [];
  const recheados = s.bolos_recheados.faixas.flatMap((f) => f.sabores);
  const caseiros = s.bolos_caseiros.itens.map((i) => i.nome);
  const pizzaSalgada = s.pizza.sabores_salgados ?? [];
  const pizzaDoce = s.pizza.sabores_doces ?? [];

  // Por quilo e por unidade saem da própria marcação do produto, não de uma
  // segunda lista escrita à mão que alguém esquece de atualizar.
  const porQuilo = s.outros_produtos.filter((p) => p.unidade === "kg");
  const porUnidade = s.outros_produtos.filter((p) => p.unidade !== "kg");
  const descreve = (p: Produto) =>
    p.sabores?.length ? `${p.nome} (${lista(p.sabores)})` : p.nome;

  const linhas = [
    "# O QUE A PADARIA TEM (catálogo, SEM preço de propósito)",
    "Você conhece os itens, mas NÃO sabe os valores de cabeça: todo preço vem de montar_orcamento ou da imagem do cardápio.",
    `SALGADOS FRITOS de sabor fixo, não pergunte recheio: ${comRecheioFixo(fritoFixo)}.`,
    `FRITOS QUE TÊM SABOR e você precisa perguntar: ${agrupadoPorRecheios(fritoComSabor)}.`,
    `SALGADOS ASSADOS e o recheio de cada um: ${agrupadoPorRecheios(assados)}. De recheio fixo: ${comRecheioFixo(assadoFixo)}.`,
    `DOCINHOS: ${lista(doces)}.${trufas.length ? ` Trufas: ${lista(trufas)}.` : ""}`,
    `BOLOS RECHEADOS, vendidos por quilo: ${lista(recheados)}. Bolo de festa PODE ser de dois sabores: os dois vão no nome do bolo (ex: bolo brigadeiro com morango) e o preço é o do sabor mais caro. Nunca diga que a casa faz um sabor só.`,
    `BOLOS CASEIROS: ${lista(caseiros)}.`,
    `PIZZA DE FORMA 60x40, inteira (até 4 sabores, serve 6 a 8) ou meia (até 2 sabores, serve até 4). Salgados: ${lista(pizzaSalgada)}. Doces: ${lista(pizzaDoce)}.`,
    `POR QUILO, e a quantidade registrada é o PESO: ${porQuilo.map(descreve).join("; ")}.`,
    `POR UNIDADE, vendidos inteiros: ${porUnidade.map(descreve).join("; ")}.`,
    "Pão fresco e itens de balcão são pesados na hora na loja, sem preço fechado pelo WhatsApp.",
  ];

  return linhas.join("\n");
}

// As cores da forminha também saem do catálogo: a lista já mudou uma vez e
// ficou desencontrada entre a tela e o prompt.
export function coresDaForminha(): string {
  const f = (catalogo as unknown as { forminhas_docinho: { cores: string[] } }).forminhas_docinho;
  return lista(f.cores);
}
