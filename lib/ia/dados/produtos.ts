// ============================================================================
//  A LISTA ÚNICA DE PRODUTOS DA CASA.
//
//  POR QUE ISTO EXISTE
//
//  Até 26/08/2026 havia DEZESSETE arquivos importando `catalogo.json` direto, e
//  cada um remontava a estrutura do seu jeito. O JSON é irregular por razões
//  históricas, então cada leitor precisava saber de todas as exceções:
//
//   - `recheio` (singular) quer dizer "já vem pronto, não pergunta" e `recheios`
//     (plural) quer dizer "pergunte qual". Um "s" muda o comportamento, e isso
//     não está escrito em lugar nenhum;
//   - salgado não tem preço no item, tem no grupo. Todo o resto tem no item;
//   - `sabores` ausente quer dizer "não tem sabor" na maioria e "ninguém
//     cadastrou" em alguns;
//   - o sabor de bolo vive sem o prefixo no catálogo ("4 leites") e o sistema
//     inteiro escreve com ele ("bolo 4 leites"), porque é o prefixo que separa
//     o bolo do docinho de mesmo nome.
//
//  Cada camada resolvia isso à sua maneira, e daí nasciam os defeitos que a
//  bateria vinha achando: o mesmo bolo com dois nomes, o item que sumia, o
//  quiche cotado como pizza.
//
//  Aqui o catálogo é lido UMA vez e vira uma lista onde todo produto responde
//  às mesmas perguntas. O JSON continua sendo a fonte do preço e não é tocado:
//  o que muda é que ninguém mais precisa interpretá-lo sozinho.
//
//  REGRA: nenhum preço pode mudar por causa deste arquivo. A prova está em
//  `testes/o-catalogo-nao-mudou-preco.cjs`, que compara a cotação de todos os
//  produtos contra a foto tirada antes (`testes/fotos/`).
// ============================================================================

import catalogo from "./catalogo.json";

/** Onde o pedido é produzido. Fala da dona, áudio de 29/07/2026. */
export type Bancada = "padeiro" | "confeitaria" | "salgadeiro";

export type ProdutoDaCasa = {
  /** O nome que o sistema inteiro escreve. Um só, sempre igual. */
  nome: string;
  preco: number;
  unidade: "un" | "kg";
  /** A categoria interna, usada pelo pedido e pelas guardas. */
  categoria: string;
  /**
   * O segmento, que é a peça de cardápio E a comanda.
   *
   * "Empadão é uma coisa, torta doce é outra coisa, torta recheada é outra
   * coisa. É tudo separado." (áudio de 29/07/2026). O motivo é de produção:
   * "os docinhos eu posso fazer cinco horas antes, mas o salgado eu tenho que
   * preparar no momento".
   */
  grupo: string;
  bancada: Bancada;
  /** Vazio quer dizer que o produto não tem sabor, e isso é diferente de nulo. */
  sabores: string[];
  /**
   * true = o sabor já vem pronto e a IA NÃO pergunta.
   *
   * É o que o catálogo escrevia como `recheio` no singular: a coxinha é sempre
   * de frango, o croquete sempre de carne com catupiry. Perguntar o sabor de um
   * produto de sabor fixo é fazer o cliente escolher o que não tem escolha.
   */
  saborFixo: boolean;
};

/**
 * A BANCADA DE CADA COISA, palavra da dona.
 *
 * "aqui o pedido fica de pão francês, pão de cachorro quente, fica pedido de
 * cuca, aqui com o padeiro. E o restante vai tudo lá embaixo pra confeitaria."
 *
 * E a exceção que ela mesma deu: "quando é o mini xis, é o salgadeiro que faz,
 * lá na parte da confeitaria".
 */
const DO_PADEIRO = /^(pao frances|pao de x|pao doce|cuca|cuca recheada|cachorro-quente)/;
const DO_SALGADEIRO = /^(mini x|mini sandu)/;

function bancadaDe(nome: string): Bancada {
  const t = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (DO_SALGADEIRO.test(t)) return "salgadeiro";
  if (DO_PADEIRO.test(t)) return "padeiro";
  return "confeitaria";
}

/**
 * O GRUPO DE CADA COISA.
 *
 * Sai da categoria que o próprio catálogo já usa, quando ela existe. O resto é
 * mapeado aqui, e cada linha veio de uma fala dela sobre comanda separada.
 */
const GRUPO_POR_CATEGORIA: Record<string, string> = {
  padaria: "pao",
  cupcake: "cupcake",
  franciscano: "franciscano",
  torta_fria: "torta-fria",
  torta_recheada: "torta-doce",
  empadao: "empadao",
  calzone: "calzone",
  pizza: "pizza",
};

function limpo(t: string): string {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type ItemBruto = {
  nome?: string;
  preco?: number;
  categoria?: string;
  unidade?: string;
  recheio?: string;
  recheios?: string[];
  sabores?: string[];
};

/** A cuca é do padeiro mas não é pão: grupo próprio, como o cardápio mostra. */
function grupoDeOutros(o: ItemBruto): string {
  const n = limpo(o.nome ?? "");
  if (n.startsWith("cuca")) return "cuca";
  if (n === "papel de arroz") return "extra-do-bolo";
  return GRUPO_POR_CATEGORIA[String(o.categoria)] ?? String(o.categoria ?? "outros");
}

let cache: ProdutoDaCasa[] | null = null;

/** Os sabores da pizza, preenchidos ao montar a lista e usados pela redonda e pelo calzone. */
let saboresDaPizza: string[] = [];

/** Todo produto da casa, no mesmo formato. Calculado uma vez. */
export function produtosDaCasa(): ProdutoDaCasa[] {
  if (cache) return cache;
  const c = catalogo as unknown as Record<string, never>;
  const lista: ProdutoDaCasa[] = [];

  const põe = (p: ProdutoDaCasa) => lista.push({ ...p, bancada: bancadaDe(p.nome) });

  // ------------------------------------------------------------- salgados
  //
  // O preço mora no grupo, não no item: frito R$ 1,00, assado R$ 1,25. O sabor
  // não muda o valor, e por isso o catálogo nunca precisou de preço por item.
  const sal = (catalogo as unknown as {
    salgados: {
      frito: { preco: number; itens: ItemBruto[] };
      assado: { preco: number; itens: ItemBruto[] };
    };
  }).salgados;

  for (const [tipo, bloco] of [
    ["frito", sal.frito],
    ["assado", sal.assado],
  ] as const) {
    for (const it of bloco.itens) {
      if (!it.nome) continue;
      põe({
        nome: it.nome,
        preco: bloco.preco,
        unidade: "un",
        categoria: "salgado_" + tipo,
        grupo: "salgado-festa",
        bancada: "confeitaria",
        // `recheio` no singular vira sabor fixo; `recheios` no plural vira
        // lista para perguntar. É a mesma informação, escrita de dois jeitos.
        sabores: it.recheio ? [it.recheio] : (it.recheios ?? []),
        saborFixo: Boolean(it.recheio),
      });
    }
  }

  // -------------------------------------------------------------- docinhos
  for (const d of (catalogo as unknown as { doces: { itens: ItemBruto[] } }).doces.itens) {
    if (!d.nome) continue;
    põe({
      nome: d.nome,
      preco: Number(d.preco),
      unidade: "un",
      categoria: "docinho",
      grupo: "docinho-festa",
      bancada: "confeitaria",
      sabores: d.sabores ?? [],
      saborFixo: !d.sabores?.length,
    });
  }

  // --------------------------------------------------------- bolo de festa
  //
  // O prefixo "bolo" entra aqui e vale para o sistema inteiro. Sem ele,
  // "brigadeiro" é o docinho de R$ 1,25 e um bolo de 2 kg sai por R$ 2,50.
  const bolos = (catalogo as unknown as {
    bolos_recheados: { faixas: { faixa: string; preco: number; sabores: string[] }[] };
  }).bolos_recheados;

  for (const f of bolos.faixas) {
    for (const s of f.sabores) {
      põe({
        nome: "bolo " + s,
        preco: f.preco,
        unidade: "kg",
        categoria: "bolo_festa",
        grupo: "bolo-festa",
        bancada: "confeitaria",
        sabores: [],
        saborFixo: true,
      });
    }
  }

  // -------------------------------------------------------- bolo caseiro
  for (const b of (catalogo as unknown as { bolos_caseiros: { itens: ItemBruto[] } }).bolos_caseiros.itens) {
    if (!b.nome) continue;
    põe({
      nome: "bolo caseiro " + b.nome,
      preco: Number(b.preco),
      unidade: "un",
      categoria: "bolo_caseiro",
      grupo: "bolo-caseiro",
      bancada: "confeitaria",
      sabores: [],
      saborFixo: true,
    });
  }

  // ---------------------------------------------------------------- pizza
  const pz = (catalogo as unknown as {
    pizza: {
      inteira: { preco: number };
      meia: { preco: number };
      sabores_salgados?: string[];
      sabores_doces?: string[];
    };
  }).pizza;
  const saboresPizza = [...(pz.sabores_salgados ?? []), ...(pz.sabores_doces ?? [])];
  // A redonda e o calzone usam esta mesma lista. O catalogo diz isso em prosa,
  // na nota de cada um, e prosa nao e dado que camada nenhuma consegue ler.
  saboresDaPizza = saboresPizza;

  for (const [nome, preco] of [
    ["pizza inteira", pz.inteira.preco],
    ["pizza meia", pz.meia.preco],
  ] as const) {
    põe({
      nome,
      preco,
      unidade: "un",
      categoria: "pizza",
      grupo: "pizza",
      bancada: "confeitaria",
      sabores: saboresPizza,
      saborFixo: false,
    });
  }

  // ------------------------------------------------------ outros produtos
  for (const o of (catalogo as unknown as { outros_produtos: ItemBruto[] }).outros_produtos) {
    if (!o.nome) continue;

    // A REDONDA E O CALZONE USAM OS SABORES DA PIZZA, e não têm lista própria.
    //
    // O catálogo diz isso em prosa, na nota de cada um: a redonda "aceita SÓ
    // DOIS sabores (a de forma aceita 4)" e o calzone é "sabores da pizza".
    // Prosa não é dado, e nenhuma camada conseguia ler.
    //
    // O efeito, medido em 26/08/2026: os dois entravam como sabor FIXO e a
    // padaria nunca perguntava o sabor. A cozinha recebia pizza redonda e
    // calzone sem saber de quê.
    const n = limpo(o.nome);
    const usaOsDaPizza = n === "pizza redonda" || n.startsWith("calzone");
    const sabores = o.sabores?.length ? o.sabores : usaOsDaPizza ? saboresDaPizza : [];

    põe({
      nome: o.nome,
      preco: Number(o.preco),
      unidade: (o.unidade === "kg" ? "kg" : "un") as "un" | "kg",
      categoria: String(o.categoria ?? "outro"),
      grupo: grupoDeOutros(o),
      bancada: "confeitaria",
      sabores,
      saborFixo: !sabores.length,
    });
  }

  void c;
  cache = lista;
  return lista;
}

/** O produto pelo nome canônico, ou null. */
export function produtoPorNome(nome: string): ProdutoDaCasa | null {
  const alvo = limpo(nome);
  return produtosDaCasa().find((p) => limpo(p.nome) === alvo) ?? null;
}

/**
 * O PRODUTO QUE ESTÁ NO COMEÇO DESTE TEXTO.
 *
 * O nome que chega do atendimento quase nunca é só o produto: vem com o
 * recheio colado ("esfirra de carne"), com o segundo sabor ("bolo brigadeiro
 * com morango") ou com uma observação atrás da vírgula.
 *
 * O nome mais longo ganha, e isso não é detalhe: "cuca recheada" tem que
 * ganhar de "cuca", senão a casa cobra R$ 4 a menos por quilo, e "bolo caseiro
 * prestígio com ganache" tem que ganhar de "bolo caseiro prestígio", que nem
 * existe mas quase casou uma vez.
 *
 * Devolve null quando o texto não começa em produto nenhum. Null é resposta
 * honesta: melhor a dona ver que o sistema não reconheceu do que ele chutar a
 * família e a comanda sair no setor errado da cozinha.
 */
export function produtoNoComeco(texto: string): ProdutoDaCasa | null {
  const t = limpo(texto);
  if (!t) return null;
  let melhor: ProdutoDaCasa | null = null;
  let tamanho = 0;
  for (const p of produtosDaCasa()) {
    const n = limpo(p.nome);
    if (!n) continue;
    // Vírgula e espaço marcam onde o produto acaba e o resto começa. Sem essa
    // fronteira "cuca" casaria dentro de "cucaracha".
    if (t !== n && !t.startsWith(n + " ") && !t.startsWith(n + ",")) continue;
    if (n.length > tamanho) {
      melhor = p;
      tamanho = n.length;
    }
  }
  return melhor;
}

/** Os grupos existentes, na ordem em que aparecem. */
export function gruposDaCasa(): string[] {
  return [...new Set(produtosDaCasa().map((p) => p.grupo))];
}

// ============================================================================
//  A CATEGORIA E A UNIDADE DE QUALQUER NOME
//
//  As duas moravam em `lib/ia/cerebro.ts`, o cérebro antigo, e cada uma
//  remontava o catálogo à mão, grupo por grupo. Mudaram de casa em 26/08/2026,
//  quando o cérebro antigo foi apagado.
//
//  Aqui elas são derivadas da lista única, então nunca mais podem discordar do
//  preço: é o mesmo produto respondendo as duas perguntas.
// ============================================================================

/**
 * A CATEGORIA DO PEDIDO, que é a mesma que decide a comanda de cozinha.
 *
 * O vocabulário é o de `CategoriaItem`, em `lib/banco/montagem.ts`. Ele não é
 * igual ao do catálogo: o catálogo diz `torta_fria`, `empadao`, `calzone`, e o
 * pedido junta todos esses em `por_quilo` ou `por_unidade`, porque o que muda
 * na comanda é como se pesa, não o nome da família.
 *
 * Está escrito aqui, e não em três lugares, porque errar isto manda o pedido
 * pro setor errado da cozinha.
 */
export function categoriaDoPedido(nome: string): string {
  const t = limpo(nome);
  if (!t) return "outro";
  if (t.includes("papel de arroz")) return "papel_de_arroz";

  const p = produtoNoComeco(t);
  if (p) {
    // Estas cinco o pedido chama pelo mesmo nome que o catálogo.
    if (
      p.categoria === "salgado_frito" ||
      p.categoria === "salgado_assado" ||
      p.categoria === "docinho" ||
      p.categoria === "bolo_festa" ||
      p.categoria === "bolo_caseiro" ||
      p.categoria === "pizza" ||
      p.categoria === "cupcake"
    ) {
      return p.categoria;
    }
    // A `mini bolha doce` é a mesma bolha FRITA, só que doce, e o catálogo diz
    // isso na categoria dele. Sem esta linha ela virava "por_unidade" e saía da
    // comanda dos salgados, que é onde ela é produzida.
    if (p.categoria === "salgado") return "salgado_frito";
    // O resto vira peso ou peça, que é o que a comanda precisa saber.
    return p.unidade === "kg" ? "por_quilo" : "por_unidade";
  }

  // O SABOR DE BOLO CASEIRO DITO SOZINHO.
  //
  // No catálogo o bolo caseiro é "cenoura" e o nome do sistema é "bolo caseiro
  // cenoura", então o sabor puro não casa com nome canônico nenhum. O fluxo já
  // resolve isso antes de chegar aqui, mas esta função também é chamada com o
  // pedido corrigido na mão, e ali o nome vem como a dona escreveu.
  //
  // Depois do `produtoNoComeco` de propósito: "café" é docinho E bolo caseiro,
  // e o docinho ganha, que é o que o cliente quer dizer quando fala só "café".
  const caseiros = (catalogo as unknown as { bolos_caseiros?: { itens?: { nome?: string }[] } })
    .bolos_caseiros?.itens ?? [];
  if (caseiros.some((i) => { const n = limpo(i?.nome ?? ""); return n && (t === n || t.startsWith(n + " ")); })) {
    return "bolo_caseiro";
  }

  // O sabor de bolo de festa vive no catálogo SEM o prefixo, e o cliente pode
  // dizer só o sabor. Quem escreve "bolo" alguma coisa está falando de bolo.
  if (t === "bolo" || t.startsWith("bolo ")) return "bolo_festa";
  if (t.startsWith("pizza")) return "pizza";
  if (t.startsWith("cupcake")) return "cupcake";

  // "outro" é resposta honesta: melhor a dona ver isso na tela e corrigir do
  // que o sistema chutar família e a comanda sair na bancada errada.
  return "outro";
}

/**
 * PESO OU PEÇA.
 *
 * Errar isto já transformou 3 kg de bolo em três bolos na bancada, e já fez um
 * bolo de 2,5 kg sair cobrado por unidade.
 *
 * A CATEGORIA GANHA DO NOME quando ela diz bolo de festa, e o motivo é que no
 * bolo de festa o nome do item é o SABOR ("4 leites"), então nenhuma regra de
 * nome alcança. Na conversa de 25/08/2026 o resumo saiu "2.5 kg de bolo
 * R$ 30,90 cada", cobrando por unidade um produto vendido por quilo.
 */
export function unidadeDoPedido(nome: string, categoria?: string): "kg" | "un" {
  if (categoria === "bolo_festa") return "kg";

  const p = produtoNoComeco(nome);
  if (p) return p.unidade;

  // Sabor de bolo de festa dito sem o prefixo, ou sabor que a casa ainda não
  // cadastrou. Bolo de festa é por quilo por definição: as faixas do catálogo
  // são preço por kg.
  const t = limpo(nome);
  if ((t === "bolo" || t.startsWith("bolo ")) && categoria !== "bolo_caseiro") return "kg";
  return "un";
}
