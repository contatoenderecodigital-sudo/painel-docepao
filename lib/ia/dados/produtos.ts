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
import { semAcento } from "../texto";
import { unidadeDoItem } from "../../tipos";

/** Onde o pedido é produzido. Fala da dona, áudio de 29/07/2026. */
export type Bancada = "padeiro" | "confeitaria" | "salgadeiro";

export type ProdutoDaCasa = {
  /** O nome que o sistema inteiro escreve. Um só, sempre igual. */
  nome: string;
  /**
   * O NOME QUE O CLIENTE FALA, sem o prefixo de família.
   *
   *     nome        "bolo 4 leites"      o que a comanda e a tabela usam
   *     nomeCurto   "4 leites"           o que o cliente escreve
   *
   * O prefixo existe porque "brigadeiro" é docinho de R$ 1,25 E bolo de
   * R$ 46,90 o quilo, e sem ele um bolo de 2 kg virava R$ 2,50. Mas ninguém
   * pede "bolo 4 leites": pede "4 leites".
   *
   * Até 27/08/2026 cada arquivo que precisava do nome curto o derivava sozinho,
   * lendo o catálogo cru e remontando os grupos do seu jeito. Era a origem da
   * família de defeitos mais cara deste projeto, e o dono cortou pela raiz:
   * "nada pode ser só uma lista tua, só o cardápio e valores".
   *
   * Agora a lista única responde os dois nomes, e ninguém precisa derivar.
   */
  nomeCurto: string;
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
  /**
   * QUANTOS SABORES CABEM NUM DESTE PRODUTO.
   *
   * A pizza de forma aceita 4, a meia aceita 2, a redonda aceita 2. Áudio da
   * dona, 19/08/2026: *"só dois sabores por pizza redonda"*.
   *
   * Isso estava no catálogo em `sabores_ate` desde sempre e **nenhuma linha de
   * código lia**. Medido em 26/08/2026: uma redonda de 30 cm fechava com CINCO
   * sabores e a de forma com SEIS. A cozinha recebia um pedido que não consegue
   * produzir, e alguém teria que ligar pro cliente.
   *
   * `undefined` quer dizer "um só", que é o caso de quase tudo: a esfirra é de
   * um recheio, o empadão é de um sabor.
   */
  saboresAte?: number;
  /**
   * FAIXA QUE A CASA COBRA NA PRATICA, quando o preco de tabela e por quilo e
   * o cliente nao tem como saber o peso de antemao.
   *
   * A pizza redonda sai entre R$ 35 e R$ 45. Estava no catalogo em
   * `valor_tipico` e ninguem lia: quem perguntava o preco ouvia so o quilo.
   */
  valorTipico?: [number, number];
  /**
   * QUANTAS PESSOAS ESTE PRODUTO SERVE, quando o cardapio imprime isso.
   *
   * A pizza de forma (inteira e meia) traz a faixa no PDF. Sem este campo, o
   * `fatos.ts` lia o JSON cru so pra montar a frase autorizada.
   */
  servePessoas?: number[];
  /**
   * PESO QUE COSTUMA SAIR, quando o produto e por quilo e nao tem peso minimo.
   *
   * A pizza redonda costuma dar de 0,8 a 1,2 kg. Estava no catalogo em
   * `peso_tipico_kg` e so o `fatos.ts` lia, pelo JSON cru.
   */
  pesoTipicoKg?: number[];
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
// A EXCECAO QUE SO A DONA SABE, e por isso ela e lista mesmo.
//
// "quando e o mini xis, e o salgadeiro que faz, la na parte da confeitaria".
// Os dois sao `salgado_assado` no catalogo, igual aos outros nove daquela
// categoria, e nada no cardapio distingue um do outro. Isto nao e derivavel: e
// uma regra de quem produz.
const DO_SALGADEIRO = /^(mini x|mini sandu)/;

/**
 * ONDE ESTE PRODUTO E PRODUZIDO.
 *
 * "aqui o pedido fica de pao frances, pao de cachorro quente, fica pedido de
 * cuca, aqui com o padeiro. E o restante vai tudo la embaixo pra confeitaria."
 *
 * O PADEIRO SAI DA CATEGORIA, E NAO DE UMA LISTA DE NOMES.
 *
 * Aqui havia seis nomes escritos a mao (pao frances, pao de x, pao doce, cuca,
 * cuca recheada, cachorro-quente). Medido em 28/08/2026: a categoria `padaria`
 * do catalogo tem exatamente esses sete produtos e mais nenhum, e nenhuma outra
 * categoria vai pro padeiro.
 *
 * A lista funcionava HOJE e quebrava no dia seguinte: o pao de milho que a dona
 * cadastrar amanha entra como `padaria`, nao casa com nenhum dos seis padroes,
 * e a comanda dele sai na CONFEITARIA. Ninguem descobre olhando codigo, porque
 * o papel sai -- so que no setor errado.
 */
function bancadaDe(nome: string, categoria: string): Bancada {
  if (DO_SALGADEIRO.test(limpo(nome))) return "salgadeiro";
  if (String(categoria) === "padaria") return "padeiro";
  return "confeitaria";
}

/**
 * AS CATEGORIAS QUE SAO SABOR DE BOLO.
 *
 * Exportada porque QUEM DESEMPATA precisa dela. "brigadeiro" e docinho de
 * R$ 1,25 e e bolo de R$ 46,90 o quilo, e quem resolve isso e saber se o
 * candidato e de bolo. `bolo_salgado` fica de fora de proposito: e um produto
 * so, com nome proprio, que nao disputa nome com docinho nenhum.
 */
export const CATEGORIAS_DE_BOLO = ["bolo_festa", "bolo_caseiro"] as const;

/** Este produto e sabor de bolo? */
export function ehCategoriaDeBolo(categoria: string): boolean {
  return (CATEGORIAS_DE_BOLO as readonly string[]).includes(String(categoria || ""));
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

// O mesmo normalizador de todo mundo. Era a decima primeira copia, identica.
const limpo = semAcento;

type ItemBruto = {
  nome?: string;
  preco?: number;
  categoria?: string;
  unidade?: string;
  recheio?: string;
  recheios?: string[];
  sabores?: string[];
  valor_tipico?: number[];
  peso_tipico_kg?: number[];
  sabores_ate?: number;
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
/** Quantos sabores cabem num bolo de festa. Sai do catalogo; 0 = sem teto. */
let boloMistoAte = 0;
/** Os mesmos sabores, separados por tipo: quem junta pizza precisa saber. */
let saboresPorTipo: { doces: string[]; salgados: string[] } = { doces: [], salgados: [] };

/** Todo produto da casa, no mesmo formato. Calculado uma vez. */
export function produtosDaCasa(): ProdutoDaCasa[] {
  if (cache) return cache;
  const lista: ProdutoDaCasa[] = [];

  // `nomeCurto` cai no `nome` quando ninguém passa: a maioria dos produtos não
  // tem prefixo, e repetir o nome em toda chamada seria ruído.
  const põe = (p: Omit<ProdutoDaCasa, "nomeCurto" | "bancada"> & { nomeCurto?: string }) =>
    // A BANCADA E DECIDIDA AQUI, E SO AQUI.
    //
    // Cada chamada passava `bancada: "confeitaria"` na mao, e o spread jogava
    // fora: quem lesse acharia que aquela linha decide alguma coisa, e trocar
    // ela pra "padeiro" nao teria efeito nenhum. Sairam todas.
    lista.push({ ...p, nomeCurto: p.nomeCurto ?? p.nome, bancada: bancadaDe(p.nome, p.categoria) });

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
      sabores: d.sabores ?? [],
      saborFixo: !d.sabores?.length,
    });
  }

  // --------------------------------------------------------- bolo de festa
  //
  // O prefixo "bolo" entra aqui e vale para o sistema inteiro. Sem ele,
  // "brigadeiro" é o docinho de R$ 1,25 e um bolo de 2 kg sai por R$ 2,50.
  const bolos = (catalogo as unknown as {
    bolos_recheados: { faixas: { faixa: string; preco: number; sabores: string[] }[]; sabores_ate?: number };
  }).bolos_recheados;
  // QUANTOS SABORES CABEM NUM BOLO DE FESTA.
  //
  // Decisao dele em 02/09/2026: dois no maximo, e o preco e o do mais caro. O
  // numero mora no catalogo, e nao aqui, pelo mesmo motivo de sempre: o dia em
  // que a dona mudar, muda num lugar so.
  boloMistoAte = Number(bolos.sabores_ate) > 0 ? Number(bolos.sabores_ate) : 0;

  for (const f of bolos.faixas) {
    for (const s of f.sabores) {
      põe({
        nome: "bolo " + s,
        nomeCurto: s,
        preco: f.preco,
        unidade: "kg",
        categoria: "bolo_festa",
        grupo: "bolo-festa",
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
      nomeCurto: b.nome,
      preco: Number(b.preco),
      unidade: "un",
      categoria: "bolo_caseiro",
      grupo: "bolo-caseiro",
      sabores: [],
      saborFixo: true,
    });
  }

  // ---------------------------------------------------------------- pizza
  const pz = (catalogo as unknown as {
    pizza: {
      inteira: { preco: number; sabores_ate?: number; serve?: number[] };
      meia: { preco: number; sabores_ate?: number; serve?: number[] };
      sabores_salgados?: string[];
      sabores_doces?: string[];
    };
  }).pizza;
  const saboresPizza = [...(pz.sabores_salgados ?? []), ...(pz.sabores_doces ?? [])];
  // A redonda e o calzone usam esta mesma lista. O catalogo diz isso em prosa,
  // na nota de cada um, e prosa nao e dado que camada nenhuma consegue ler.
  saboresDaPizza = saboresPizza;
  saboresPorTipo = { doces: pz.sabores_doces ?? [], salgados: pz.sabores_salgados ?? [] };

  const faixaNumerica = (v?: number[]) =>
    Array.isArray(v) && v.length
      ? v.map(Number).filter((n) => Number.isFinite(n))
      : undefined;

  for (const [nome, bloco] of [
    ["pizza inteira", pz.inteira],
    ["pizza meia", pz.meia],
  ] as const) {
    const serve = faixaNumerica(bloco.serve);
    põe({
      nome,
      preco: bloco.preco,
      unidade: "un",
      categoria: "pizza",
      grupo: "pizza",
      sabores: saboresPizza,
      saborFixo: false,
      saboresAte: Number(bloco.sabores_ate) > 0 ? Number(bloco.sabores_ate) : undefined,
      servePessoas: serve && serve.length ? serve : undefined,
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
    // `recheio` NO SINGULAR VALE AQUI TAMBEM, e nao so nos salgados.
    //
    // O cabecalho deste arquivo ja declarava a regra ("`recheio` no singular
    // quer dizer 'ja vem pronto, nao pergunta'"), mas so o leitor dos salgados
    // a cumpria. Aqui embaixo o campo era ignorado, e o produto virava sabor
    // fixo com a lista VAZIA: a padaria parava de perguntar, certo, mas o
    // recheio sumia da comanda, e a cozinha recebia o nome pelado.
    //
    // Achado em 02/09/2026, marcando a "mini bolha doce" como fixa de banana a
    // pedido dele. Dois leitores respondendo diferente a mesma pergunta e o
    // defeito que mais se repetiu neste projeto.
    const sabores = o.recheio
      ? [o.recheio]
      : o.sabores?.length
        ? o.sabores
        : usaOsDaPizza
          ? saboresDaPizza
          : [];

    põe({
      nome: o.nome,
      preco: Number(o.preco),
      unidade: unidadeDoItem(o.unidade),
      categoria: String(o.categoria ?? "outro"),
      grupo: grupoDeOutros(o),
      sabores,
      saborFixo: Boolean(o.recheio) || !sabores.length,
      saboresAte: Number(o.sabores_ate) > 0 ? Number(o.sabores_ate) : undefined,
      valorTipico:
        Array.isArray(o.valor_tipico) && o.valor_tipico.length === 2
          ? [Number(o.valor_tipico[0]), Number(o.valor_tipico[1])]
          : undefined,
      pesoTipicoKg: faixaNumerica(o.peso_tipico_kg),
    });
  }

  cache = lista;
  return lista;
}

/** O produto pelo nome canônico, ou null. */
export function produtoPorNome(nome: string): ProdutoDaCasa | null {
  const alvo = limpo(nome);
  return produtosDaCasa().find((p) => limpo(p.nome) === alvo) ?? null;
}

/**
 * PEDACOS DE FAMILIA QUE SAEM DA CATEGORIA E DO GRUPO.
 *
 * Nao e lista de produto. "bolo", "caseiro", "docinho", "pizza" aparecem aqui
 * porque o catalogo chama as coisas assim. Cadastrar "bolo_vegano" amanha
 * coloca "vegano" sozinho.
 */
function pedacosDaChave(s: string): string[] {
  return limpo(s)
    .split(/[-_\s]+/)
    .filter((p) => p.length >= 4);
}

/**
 * AS PALAVRAS QUE DIZEM DE QUAL FAMILIA E ESTE PRODUTO.
 *
 * Sai da categoria, do grupo e do prefixo do nome canonico (o que sobra quando
 * se tira o `nomeCurto`). "brigadeiro" nao entra: e o nome, nao a familia.
 */
export function palavrasDaFamilia(
  p: Pick<ProdutoDaCasa, "categoria" | "grupo" | "nome" | "nomeCurto">,
): string[] {
  const s = new Set<string>([
    ...pedacosDaChave(p.categoria),
    ...pedacosDaChave(p.grupo),
  ]);
  const nome = limpo(p.nome);
  const curto = limpo(p.nomeCurto);
  if (curto && nome !== curto && (nome === curto || nome.endsWith(" " + curto) || nome.endsWith(curto))) {
    const prefixo = nome.endsWith(" " + curto)
      ? nome.slice(0, nome.length - curto.length).trim()
      : nome.slice(0, Math.max(0, nome.length - curto.length)).trim();
    for (const w of pedacosDaChave(prefixo)) s.add(w);
  }
  return [...s];
}

/** Uniao das palavras de familia de todo o catalogo, pra achar prefixo na frase. */
export function palavrasDeFamiliaDoCatalogo(): Set<string> {
  const s = new Set<string>();
  for (const p of produtosDaCasa()) {
    for (const w of palavrasDaFamilia(p)) s.add(w);
  }
  return s;
}

/**
 * COLISAO DE NOME CURTO: mesmo jeito que o cliente fala, categorias diferentes.
 *
 * Nao e a lista do brigadeiro. E o que o catalogo produz hoje, e o que ele
 * produzir amanha quando a dona cadastrar "maracuja" no docinho e no bolo.
 */
export function paresDeNomeCurtoColidindo(): { nomeCurto: string; produtos: ProdutoDaCasa[] }[] {
  const por = new Map<string, ProdutoDaCasa[]>();
  for (const p of produtosDaCasa()) {
    const k = limpo(p.nomeCurto);
    if (!k) continue;
    const arr = por.get(k) ?? [];
    arr.push(p);
    por.set(k, arr);
  }
  const pares: { nomeCurto: string; produtos: ProdutoDaCasa[] }[] = [];
  for (const [nomeCurto, produtos] of por) {
    const cats = new Set(produtos.map((p) => p.categoria));
    if (cats.size > 1) pares.push({ nomeCurto, produtos });
  }
  return pares;
}

/**
 * ENTRE CANDIDATOS DO MESMO NOME, GANHA A FAMILIA DA ETAPA E DA FRASE.
 *
 * A dica e a categoria (ou o nome da etapa: "bolo", "docinho"). As palavras da
 * frase que tambem sao familia (bolo, caseiro, docinho, pizza) votam. Empate
 * de nota deixa o primeiro: quem resolve de verdade, nesse caso, e a pergunta.
 */
export function desempatarPorFamilia(
  candidatos: ProdutoDaCasa[],
  dica?: string,
  frase?: string,
): ProdutoDaCasa {
  if (!candidatos.length) {
    throw new Error("desempatarPorFamilia sem candidato");
  }
  if (candidatos.length === 1) return candidatos[0];
  const toksFrase = new Set(pedacosDaChave(frase ?? ""));
  const d = limpo(dica ?? "");
  const nota = (p: ProdutoDaCasa) => {
    const fam = new Set(palavrasDaFamilia(p));
    let n = 0;
    if (d && d === limpo(p.categoria)) n += 8;
    if (d) {
      for (const tok of new Set([...pedacosDaChave(d), ...(d.length >= 4 ? [d] : [])])) {
        if (fam.has(tok) || limpo(p.categoria).split(/[-_]/).includes(tok)) n += 3;
      }
    }
    for (const w of toksFrase) {
      if (fam.has(w)) n += 5;
    }
    return n;
  };
  let melhor = candidatos[0];
  let melhorNota = nota(melhor);
  for (const p of candidatos.slice(1)) {
    const n = nota(p);
    if (n > melhorNota) {
      melhor = p;
      melhorNota = n;
    }
  }
  return melhor;
}

/**
 * ESTE PRODUTO PEDE O CLIENTE ESCOLHER O SABOR?
 *
 * Sai da tabela: tem `sabores[]` e nao tem `saborFixo`. Coxinha nao pede
 * (recheio ja vem). Pizza redonda pede. Empadao pede. Cuca recheada pede.
 * Pao frances nao pede.
 *
 * Quem fecha o pedido e quem pergunta le isto. Nao existe uma lista paralela
 * de "salgado que pede recheio".
 */
/**
 * QUANTOS SABORES CABEM NUM BOLO DE FESTA, pelo catalogo.
 *
 * Chama `produtosDaCasa()` antes de responder porque o numero e preenchido na
 * leitura: perguntar sem a lista carregada devolveria zero e o teto sumiria em
 * silencio, que e o jeito mais caro de uma regra desaparecer.
 */
export function saboresPorBoloDeFesta(): number {
  produtosDaCasa();
  return boloMistoAte;
}


/**
 * EM QUE GRUPOS DO CARDAPIO ESTA PALAVRA APARECE.
 *
 * "morango" e bolo, docinho E torta. "cafe" e bolo e docinho. "prestigio" e
 * bolo, torta, pizza e calzone. Sao sabores compartilhados, e o preco entre um
 * e outro muda dezenas de vezes:
 *
 *   docinho de morango      R$ 1,25 a unidade
 *   bolo de morango         R$ 49,90 o QUILO
 *
 * POR QUE ISTO EXISTE
 *
 * Medido conversando com a producao em 02/09/2026. O cliente escreveu "quero 50
 * de morango" e a padaria anotou 50 x bolo, na categoria de festa, que e por
 * quilo: cinquenta QUILOS de bolo, R$ 2.345,00. Depois perguntou "E o bolo,
 * qual sabor?", que ele ja tinha respondido.
 *
 * Ela decidiu duas coisas sozinha (que era bolo, e que eram quilos) e perguntou
 * a unica que ele ja tinha dito. Palavra dele: *"nesse momento ela tinha que ter
 * pedido: quer o que de morango?"*.
 *
 * SAI DO CARDAPIO, E NAO DE UMA LISTA DE PALAVRAS. Nao e sobre morango: e sobre
 * qualquer nome que a casa use em mais de um grupo, hoje e no dia em que a dona
 * cadastrar um sabor novo nos dois lugares.
 *
 * Devolve os grupos em ordem, ou lista vazia quando a palavra so existe num.
 */
let ondeCadaPalavraCache: Map<string, string[]> | null = null;
export function gruposComEstaPalavra(palavra: unknown): string[] {
  const alvo = limpo(String(palavra ?? ""));
  if (!alvo) return [];
  if (!ondeCadaPalavraCache) {
    // palavra -> familia -> produtos daquela familia que tem a palavra.
    //
    // A familia no meio existe pra COLAPSAR: "brigadeiro" e sabor das tres
    // pizzas e dos quatro cupcakes, e listar os sete pelo nome daria uma
    // pergunta de onze opcoes. Com mais de um produto da mesma familia, a
    // resposta e o nome da familia ("pizza", "cupcake"); com um so, e o nome
    // dele ("trufa", "cuca recheada"), que e mais util pro cliente.
    const cru = new Map<string, Map<string, Set<string>>>();
    const guardar = (palavra: string, familia: string, produto: string) => {
      const k = limpo(palavra);
      if (!k) return;
      if (!cru.has(k)) cru.set(k, new Map());
      const porFam = cru.get(k)!;
      if (!porFam.has(familia)) porFam.set(familia, new Set());
      porFam.get(familia)!.add(limpo(produto));
    };
    for (const p of produtosDaCasa()) {
      // A ETIQUETA E A COISA QUE O CLIENTE DIRIA, e nao o nome interno.
      //
      // Duas situacoes diferentes:
      //
      //   a palavra e o NOME CURTO do produto ("bolo morango" -> "morango"),
      //   e ai a coisa e o grupo: "bolo".
      //
      //   a palavra e um SABOR dele (a trufa tem morango), e ai a coisa e o
      //   proprio produto: "trufa".
      //
      // Sem isso a pergunta saia "voce quer bolo, docinho ou PADARIA de limao?",
      // porque limao e sabor da cuca recheada e a categoria dela e "padaria".
      // Ninguem pede padaria de limao; pede cuca de limao.
      const grupo = familiaDaCategoriaDoProduto(p.categoria);
      const curto = limpo(p.nomeCurto);
      // O NOME CURTO responde pela familia: "bolo morango" e um bolo.
      if (curto) guardar(curto, grupo, grupo);
      // O SABOR responde pelo produto: morango na trufa e "trufa".
      for (const sabor of p.sabores) {
        if (limpo(sabor) === curto) continue;
        guardar(sabor, grupo, p.nome);
      }
    }
    ondeCadaPalavraCache = new Map(
      [...cru].map(([palavra, porFam]) => [
        palavra,
        [...porFam]
          .map(([familia, produtos]) => (produtos.size > 1 ? familia : [...produtos][0]))
          .sort(),
      ]),
    );
  }
  const grupos = ondeCadaPalavraCache.get(alvo) ?? [];
  return grupos.length > 1 ? grupos : [];
}

/**
 * O NOME DO GRUPO DESTA CATEGORIA, pra falar com o cliente.
 *
 * Escrito aqui, e nao importado de `generico.ts`, porque aquele arquivo importa
 * este: importar de volta faria um ciclo. E a mesma conta, e ela e simples: a
 * categoria sem o sufixo, que e como o cliente chama ("bolo festa" -> "bolo").
 */
function familiaDaCategoriaDoProduto(categoria: string): string {
  const c = String(categoria || "");
  if (c.startsWith("bolo_") && c !== "bolo_salgado") return "bolo";
  if (c.startsWith("salgado_")) return "salgado";
  if (c.startsWith("torta_")) return "torta";
  return c.replace(/_/g, " ");
}

export function pedeEscolhaDeSabor(
  p: Pick<ProdutoDaCasa, "saborFixo" | "sabores"> | null | undefined,
): boolean {
  // ESCOLHA PRECISA DE MAIS DE UMA OPCAO. Uma opcao so nao e escolha.
  //
  // Regra dele, em 02/09/2026, lendo o CARDAPIO.md: *"todos que nao tem mais de
  // 1 opcao de sabor pra escolher nao precisa pedir, pq ja tem o sabor
  // predefinido. Somente os q tem mais de 1 sabor precisa pedir qual a pessoa
  // quer... eh uma regra geral"*.
  //
  // Ate aqui a conta era `sabores.length > 0`, e dependia de o catalogo ter
  // usado o campo certo: `recheio` no singular pra fixo, `sabores` no plural
  // pra escolher. Um "s" mudava o comportamento, e um produto cadastrado com
  // lista de UM item fazia a padaria perguntar uma coisa que tem uma resposta
  // so. Com a contagem, cadastrar errado deixa de virar pergunta boba.
  return Boolean(p && !p.saborFixo && p.sabores.length > 1);
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
/**
 * AS CATEGORIAS QUE O PEDIDO CHAMA PELO MESMO NOME QUE O CATALOGO.
 *
 * Sao as que o `departamentos.ts` sabe rotear pra uma bancada. Acrescentar uma
 * categoria no catalogo e nao acrescentar aqui faz o produto perder a bancada e
 * cair no generico, que e o defeito que isto conserta.
 */
const CATEGORIAS_DO_PEDIDO = new Set([
  "salgado_frito", "salgado_assado", "docinho", "bolo_festa", "bolo_caseiro",
  "pizza", "cupcake",
  "torta_fria", "torta_recheada", "empadao", "calzone", "bolo_salgado",
  "franciscano", "padaria",
]);

export function categoriaDoPedido(nome: string): string {
  const t = limpo(nome);
  if (!t) return "outro";
  if (t.includes("papel de arroz")) return "papel_de_arroz";

  const p = produtoNoComeco(t);
  if (p) {
    // A CATEGORIA DO CATALOGO PASSA INTEIRA, e nao so sete dela.
    //
    // Eram sete, e as outras SETE eram achatadas em `por_quilo` ou
    // `por_unidade`. Medido em 29/08/2026: dezesseis produtos perdiam a bancada
    // no caminho do catalogo pro pedido.
    //
    //     padaria        -> por_quilo    7 produtos
    //     torta_fria     -> por_quilo    2
    //     empadao        -> por_quilo    2
    //     torta_recheada -> por_quilo    2
    //     calzone        -> por_quilo    1
    //     bolo_salgado   -> por_quilo    1
    //     franciscano    -> por_unidade  1
    //
    // O `departamentos.ts` conhece as catorze desde sempre, e o proprio
    // comentario dele dizia o preco disso: "por_quilo e por_unidade nao dizem
    // QUAL produto e: quem decide ali e o nome". A comanda adivinhava pelo nome
    // o que o catalogo ja sabia.
    //
    // O que mais doia era `padaria`. Audio da dona: "so o padeiro que e outra
    // sala", e sao os sete produtos dele que perdiam a marca.
    if (CATEGORIAS_DO_PEDIDO.has(p.categoria)) return p.categoria;
    // A `mini bolha doce` é a mesma bolha FRITA, só que doce. O catálogo dizia
    // "salgado" nela e foi consertado na raiz em 29/08/2026; esta linha fica
    // como borda, pro dia em que a dona cadastrar outro produto assim.
    if (p.categoria === "salgado") return "salgado_frito";
    // Só o que a comanda NAO conhece vira peso ou peça.
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
  // A LISTA UNICA SE PERGUNTA, EM VEZ DE RELER O JSON.
  //
  // Aqui, dentro do proprio arquivo que existe pra ninguem mais ler o catalogo
  // cru, havia uma leitura crua de `bolos_caseiros`. O `nomeCurto` do bolo
  // caseiro E o nome do catalogo, entao a resposta ja estava na lista.
  const caseiros = produtosDaCasa()
    .filter((p) => p.categoria === "bolo_caseiro")
    .map((p) => limpo(p.nomeCurto));
  if (caseiros.some((n) => n && (t === n || t.startsWith(n + " ")))) {
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

/**
 * OS SABORES DA PIZZA SEPARADOS POR TIPO.
 *
 * Existe porque juntar duas pizzas anotadas depende disso: somar sabor da
 * mesma pizza esta certo, somar uma doce com uma salgada nao (ninguem come
 * calabresa com brigadeiro em cima).
 *
 * O `montagem.ts` respondia essa pergunta lendo o `catalogo.json` CRU, e era o
 * unico leitor cru que sobrava no caminho da conversa. Ele nao estava sendo
 * preguicoso: a lista unica que este arquivo expunha (`saboresDaPizza`) junta
 * os dois tipos e perde justamente a informacao que ele precisava. Faltava a
 * porta, entao ele foi na fonte por fora.
 *
 * Aberta na leitura da camada de banco, 28/08/2026.
 */
export function saboresDaPizzaPorTipo(): { doces: string[]; salgados: string[] } {
  produtosDaCasa(); // garante que a lista foi montada (e o cache preenchido)
  return saboresPorTipo;
}

/**
 * AS CORES DE FORMINHA DO CARDAPIO.
 *
 * Morava no `sabor.ts` lendo o JSON cru. A lista unica e o dono do catalogo, e
 * a cor e dado da dona igual ao preco: cadastrar uma cor nova na tela tem que
 * valer em todo lugar sozinha.
 */
export function coresDoCardapio(): string[] {
  const cores = (catalogo as unknown as { forminhas_docinho?: { cores?: string[] } })
    .forminhas_docinho?.cores;
  return (cores ?? []).map(String).filter(Boolean);
}

/**
 * OS DEGRAUS DE PRECO DO BOLO DE FESTA.
 *
 * No catalogo se chamam A, B e C. Nao sao produto: nenhum cliente pede
 * "bolo recheado b". O motor de orcamento precisa cotar pelo degrau quando o
 * pedido vem da equipe pelo preco, nao pelo sabor.
 */
export function faixasDoBoloFesta(): { faixa: string; preco: number }[] {
  const faixas = (catalogo as unknown as {
    bolos_recheados?: { faixas?: { faixa: string; preco: number }[] };
  }).bolos_recheados?.faixas ?? [];
  return faixas
    .map((f) => ({ faixa: String(f.faixa), preco: Number(f.preco) }))
    .filter((f) => f.faixa && Number.isFinite(f.preco));
}

/**
 * O MINIMO POR SABOR QUE A DONA DITOU.
 *
 * `sugerir: 20` e `sabores_por_cento_sugeridos: 5`, e `recusar: false`. O no
 * estava no catalogo e o `base.ts` lia o JSON cru so pra isto.
 */
export function minimoPorSaborDoCatalogo(): { sugerir: number; saboresNoCento: number } {
  const m = (catalogo as unknown as {
    _minimo_por_sabor?: { sugerir?: number; sabores_por_cento_sugeridos?: number };
  })._minimo_por_sabor;
  return {
    sugerir: Number(m?.sugerir) > 0 ? Number(m?.sugerir) : 0,
    saboresNoCento: Number(m?.sabores_por_cento_sugeridos) > 0 ? Number(m?.sabores_por_cento_sugeridos) : 0,
  };
}
