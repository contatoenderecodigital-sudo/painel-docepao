// ============================================================================
//  UM NOME SÓ POR PRODUTO.
//
//  POR QUE ISTO EXISTE
//
//  Até 26/08/2026 o nome de um produto era decidido em quatro lugares
//  diferentes: o modelo escrevia do jeito dele, `separarProdutoERecheio`
//  resolvia de um jeito, o motor de preço de outro, e o item guardado de outro.
//  Quatro caminhos escrevendo o nome da mesma coisa.
//
//  O preço disso foi medido: na bateria dos cinco jeitos, as execuções que
//  passavam gravavam `bolo 4 leites` e as que falhavam gravavam `4 leites`, o
//  mesmo bolo com dois nomes. A comparação falhava, o item entrava duas vezes,
//  e o cupom da cozinha saiu com "misto: bolo 4 leites e 4 leites".
//
//  O PREFIXO "bolo" NÃO É ENFEITE. É ELE QUE SEPARA DOCINHO DE BOLO:
//
//      brigadeiro        -> docinho,  R$ 1,25   a unidade
//      bolo brigadeiro   -> bolo,     R$ 46,90  o quilo
//
//  Um sabor sem o prefixo vira o docinho de mesmo nome, e o pedido sai com
//  R$ 2,50 no lugar de R$ 93,80. Por isso o nome canônico do bolo carrega o
//  "bolo" na frente, que é como a tabela de preço guarda.
//
//  Todo mundo que precisa saber o que é um item passa por aqui.
// ============================================================================

import { APELIDOS } from "../dados/apelidos";
import {
  produtosDaCasa,
  ehCategoriaDeBolo,
  unidadeDoPedido as unidadeDoProduto,
  produtoPorNome,
  palavrasDaFamilia,
  palavrasDeFamiliaDoCatalogo,
  desempatarPorFamilia,
  paresDeNomeCurtoColidindo,
} from "../dados/produtos";
// O MESMO normalizador de todo mundo. Aqui era a quinta copia dele, e esta
// trocava a ordem do toLowerCase com o normalize.
import { semAcento as semAcMin, formasDoCliente } from "../texto";
import { chavesDeFamilia } from "./generico";

export type Identidade = {
  /** O nome como o resto do sistema tem que escrever, sempre igual. */
  produto: string;
  /** O que veio grudado no nome e não é o produto: "frango" em "quiche de frango". */
  recheio: string | null;
  /** kg ou un, tirado do cardápio. */
  unidade: "kg" | "un";
  /** true quando o nome só existe num lugar do cardápio. */
  unico: boolean;
};

function familiaNoComeco(t: string): string | null {
  const chaves = chavesDeFamilia()
    .map((k) => ({ k, n: semAcMin(k) }))
    .sort((a, b) => b.n.length - a.n.length);
  const formas = formasDoCliente(t);
  const perto = (n: string, s: string) => {
    if (!n || !s) return false;
    if (s === n || s.startsWith(n + " ")) return true;
    const miolo = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^a-z])" + miolo + "s?(?![a-z])").test(s);
  };
  for (const { k, n } of chaves) {
    if (!(perto(n, t) || formas.some((f) => perto(n, f)))) continue;
    // Mini pizza e salgado. A palavra pizza no meio dela nao e a familia da
    // pizza de forma: no pedido misturado virava a pizza cara (R$ 120), sumia
    // o salgado e pulava a conversa da festa.
    if (n === "pizza") {
      const eMini = [t, ...formas].some(
        (f) => f === "mini pizza" || f.startsWith("mini pizza ") || f.startsWith("mini pizza,"),
      );
      if (eMini) continue;
    }
    return k;
  }
  return null;
}

type Candidato = { canonico: string; casa: string; categoria: string; apelido: boolean };

/**
 * O QUE A FRASE E A ETAPA DIZEM DESTE NOME.
 *
 * Nao e lista de produto. Sao as palavras que o PROPRIO CATALOGO ja usa pra
 * classificar: o prefixo `bolo`, o `caseiro` que entra no nome de todo bolo
 * caseiro, `festa` no grupo, `kg` na unidade, `docinho` na categoria. Quem
 * resolve o sabor e o cardapio; isto so diz EM QUAL FAMILIA procurar.
 */
function palavraDeFamiliaNaFrase(texto: string, palavra: string): boolean {
  const n = semAcMin(palavra);
  if (!n) return false;
  const t = " " + semAcMin(texto) + " ";
  return t.includes(" " + n + " ") || t.includes(" " + n + "s ");
}

/**
 * ENTRE OS QUE CASARAM, QUAL O CONTEXTO PEDE.
 *
 * Ordem de quem ganha, a mesma que uma atendente usa:
 *
 *   1. palavra de familia UNICA na frase (sai da categoria e do grupo)
 *   2. a ETAPA (o que a padaria acabou de perguntar)
 *   3. sem etapa e sem palavra de familia: o produto de unidade
 *
 * Nunca escolhe o de quilo calado. Se ele disse bolo e o cardapio tem o
 * mesmo nome curto em duas categorias de bolo, devolve "perguntar".
 */
function escolherPeloContexto(
  empatados: Candidato[],
  dica: string,
  texto: string,
): Candidato | "perguntar" {
  const dicaN = semAcMin(dica);
  const t = semAcMin(texto);
  const kg = /\bkg\b/.test(t) || /\bquilos?\b/.test(t);
  const naoSalgado = empatados.filter((c) => !String(c.categoria).startsWith("salgado"));
  const pool = naoSalgado.length && naoSalgado.length < empatados.length ? naoSalgado : empatados;
  const daCasaDe = (c: Candidato) => produtoPorNome(c.canonico);

  for (const c of pool) {
    const p = daCasaDe(c);
    if (!p) continue;
    const unicas = palavrasDaFamilia(p).filter((w) =>
      pool.every((o) => {
        if (o.canonico === c.canonico) return true;
        const q = daCasaDe(o);
        return !q || !palavrasDaFamilia(q).includes(w);
      }),
    );
    for (const w of unicas) {
      if (palavraDeFamiliaNaFrase(texto, w)) return c;
    }
  }

  if (kg) {
    const porKg = pool.filter((c) => daCasaDe(c)?.unidade === "kg");
    if (porKg.length) return porKg[0];
  }

  const exata = pool.filter((c) => semAcMin(c.categoria) === dicaN);
  if (exata.length) return exata[0];

  const deBolo = pool.filter((c) => ehCategoriaDeBolo(c.categoria));
  const etapaDeBolo =
    dicaN === "bolo" || dicaN.startsWith("bolo") || palavraDeFamiliaNaFrase(texto, "bolo");
  const catsBolo = new Set(deBolo.map((c) => c.categoria));
  if (
    (etapaDeBolo || palavraDeFamiliaNaFrase(texto, "bolo")) &&
    catsBolo.size > 1 &&
    !palavraDeFamiliaNaFrase(texto, "caseiro") &&
    !palavraDeFamiliaNaFrase(texto, "festa") &&
    !kg
  ) {
    return "perguntar";
  }

  const produtos = pool.map(daCasaDe).filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (produtos.length) {
    const g = desempatarPorFamilia(produtos, dica || undefined, texto);
    const c = pool.find((x) => x.canonico === g.nome);
    if (c && (dicaN || palavraDeFamiliaNaFrase(texto, "bolo") || kg)) return c;
    if (c && dicaN) return c;
  }

  if (etapaDeBolo && deBolo.length) return deBolo[0];

  const canonicos = [...new Set(pool.map((c) => c.canonico))];
  if (canonicos.length === 1) return pool.find((c) => c.canonico === canonicos[0]) ?? pool[0];

  const porUnidade = pool.filter((c) => daCasaDe(c)?.unidade === "un");
  if (porUnidade.length === 1) return porUnidade[0];

  return pool[0];
}

/**
 * O QUE É ESTE ITEM, RESOLVIDO CONTRA O CARDÁPIO.
 *
 * `categoria` é a dica de onde a conversa está. Ela decide o desempate quando o
 * nome existe em mais de um lugar: na etapa do bolo o sabor e bolo, na do
 * docinho e docinho. `frase` e o que ele acabou de escrever: a palavra bolo,
 * caseiro ou kg vale igual a etapa, e sem elas o sabor pelado e o produto
 * de unidade. Sem dica e sem a palavra bolo, um nome ambiguo nao vira o de
 * quilo calado.
 */
export function identificarProduto(nomeBruto: string, categoria?: string, frase?: string): Identidade {
  const bruto = String(nomeBruto || "").trim();
  // "bolo DE cenoura" e "bolo cenoura" são o mesmo bolo, e antes viravam dois
  // nomes diferentes no pedido: o "de" fazia o nome não casar com candidato
  // nenhum, e o fluxo devolvia o texto cru. Era exatamente a doença que este
  // arquivo foi criado pra curar, sobrevivendo numa preposição.
  const t0 = semAcMin(bruto)
    .replace(/^bolo (de |do |da ) */, "bolo ")
    .replace(/^bolo caseiro (de |do |da ) */, "bolo caseiro ");
  if (!t0) return { produto: bruto, recheio: null, unidade: "un", unico: false };

  const textoDoContexto = [bruto, frase].filter(Boolean).join(" ");

  // ------------------------------------------------------------ candidatos
  // Cada candidato sabe o nome que o sistema deve escrever (o canônico) e a
  // forma pela qual o cliente pode ter escrito.
  // `apelido` marca o candidato que veio da lista de sinonimos. Ele so vale
  // quando o que o cliente escreveu NAO e um produto do cardapio: ver o porque
  // logo abaixo, na escolha.
  const cand: Candidato[] = [];

  // O CANDIDATO SAI DA LISTA UNICA, E NAO DO catalogo.json.
  //
  // Este arquivo lia o JSON cru e remontava os grupos do jeito dele, com uma
  // lista escrita a mao de QUATRO baldes: salgados.frito, salgados.assado,
  // doces e outros_produtos. O catalogo tem quinze chaves.
  //
  // O que ficou de fora foi a chave `pizza`. Medido em 28/08/2026:
  //
  //   "pizza meia de frango"        -> produto "pizza meia de frango", sem recheio
  //   "pizza redonda de calabresa"  -> produto "pizza redonda", recheio calabresa
  //
  // A redonda mora em `outros_produtos` e por isso funcionava; a meia e a
  // inteira moram em `pizza` e sairam com o sabor colado no nome. Comanda com
  // nome que nao existe na tabela, e a cozinha lendo "pizza meia de frango"
  // como se fosse um produto.
  //
  // E o defeito que o `nomeCurto` do `produtos.ts` diz, no comentario dele, ter
  // acabado: "cada arquivo que precisava do nome curto o derivava sozinho,
  // lendo o catalogo cru e remontando os grupos do seu jeito". Este arquivo
  // continuava fazendo isso, e ele e justamente o que se chama "um nome so por
  // produto".
  for (const p of produtosDaCasa()) {
    const deBolo = ehCategoriaDeBolo(p.categoria);
    // Os jeitos pelos quais o cliente pode ter escrito ESTE produto.
    const casas = new Set<string>([p.nome, p.nomeCurto]);
    // "bolo cenoura" tem que alcancar "bolo caseiro cenoura": o cliente nao
    // diz "caseiro", isso e classificacao da casa.
    if (deBolo) casas.add("bolo " + p.nomeCurto);
    // O NOME QUE CARREGA A FAMILIA TAMBEM ATENDE PELO NOME CURTO.
    //
    // Onze dos doze docinhos se chamam pelo sabor puro ("brigadeiro", "cafe").
    // UM se chama "docinho de churros". Essa diferenca de uma palavra tinha
    // preco: a palavra "churros" sozinha nao alcancava o docinho, e o unico
    // candidato que sobrava era `bolo caseiro churros`.
    //
    //     "churros" na etapa do docinho  ->  bolo caseiro churros, R$ 34,90
    //     o certo                        ->  docinho de churros,   R$  1,75
    //
    // Vinte vezes o preco, num item que a festa pede em dezenas. O "cafe" nao
    // sofria disso porque o docinho dele se chama so "cafe": os dois candidatos
    // existem, a escolha fica ambigua e a ETAPA desempata. Era esse desempate
    // que o nome comprido impedia de acontecer.
    const semFamilia = semAcMin(p.nome).replace(/^(docinho|salgado|doce|bolo|torta|mini) (de|da|do) +/, "");
    if (semFamilia) casas.add(semFamilia);
    for (const casa of casas) {
      const c = semAcMin(casa);
      if (c) cand.push({ canonico: p.nome, casa: c, categoria: p.categoria, apelido: false });
    }
  }
  for (const [canonico, lista] of Object.entries(APELIDOS)) {
    const categoriaDoApelido = produtosDaCasa().find((x) => x.nome === canonico)?.categoria ?? "";
    for (const a of lista) {
      cand.push({ canonico, casa: semAcMin(a), categoria: categoriaDoApelido, apelido: true });
    }
  }

  // Artigo na frente: "uma mini pizza" tem que achar o salgado, nao a familia
  // pizza. A dica da etapa do salgado tambem NAO promove "pizza" a mini pizza.
  let t = t0;
  let servem: Candidato[] = [];
  for (const forma of [...new Set([t0, ...formasDoCliente(bruto), ...formasDoCliente(t0)])]) {
    const desta = cand
      .filter((c) => {
        const familia = palavrasDeFamiliaDoCatalogo();
        const partes = forma.split(/ +/).filter(Boolean);
        while (partes.length > 1 && (familia.has(partes[0]) || /^(de|da|do|com)$/.test(partes[0]))) {
          partes.shift();
        }
        const miolo = partes.join(" ");
        return Boolean(c.casa) && (forma === c.casa || forma.startsWith(c.casa + " ") || miolo === c.casa || miolo.startsWith(c.casa + " "));
      })
      .sort((a, b) => b.casa.length - a.casa.length);
    if (desta.length) {
      t = forma;
      servem = desta;
      break;
    }
  }

  if (servem.length) {
    const fam = familiaNoComeco(t0);
    const eMini = [t0, ...formasDoCliente(bruto)].some(
      (f) => f === "mini pizza" || f.startsWith("mini pizza ") || f.startsWith("mini pizza,"),
    );
    if (fam === "pizza" && !eMini) {
      servem = servem.filter((c) => {
        const p = produtosDaCasa().find((x) => x.nome === c.canonico);
        return !p || !String(p.categoria).startsWith("salgado");
      });
    }
  }

  if (!servem.length) {
    // NOME DE FAMILIA NAO VIRA O PRODUTO MAIS COMPRIDO.
    //
    // "uma pizza" nao e pizza inteira (R$ 120). "2 pizzas" nao e o file ao molho
    // madeira. Sem isto o apelido ou o casamento por pedaco escolhia o preco.
    // A padaria pergunta qual: forma, meia ou redonda. Mini pizza e outro
    // produto, e a etapa do salgado nao troca uma pela outra.
    const fam = familiaNoComeco(t0);
    if (fam) {
      const n = semAcMin(fam);
      const onde = t0.indexOf(n);
      const resto = t0
        .slice(onde >= 0 ? onde + n.length : n.length)
        .replace(/^ *(de|da|do|com) +/, "")
        .trim();
      return {
        produto: fam,
        recheio: resto || null,
        unidade: "un",
        unico: true,
      };
    }
    return {
      produto: bruto,
      recheio: null,
      unidade: unidadeDoProduto(bruto, categoria),
      unico: false,
    };
  }

  // O NOME DO CARDAPIO GANHA DO APELIDO. SEMPRE.
  //
  // A lista de apelidos mistura duas coisas. Sinonimo de verdade ("esfiha" e
  // "esfirra", "chique" e "quiche") tem o mesmo preco e pode virar nome
  // canonico. Mas ela tambem tem "cuca" apontando pra "cuca recheada", que a
  // casa usa pra NAO RECUSAR o pedido, e essas mudam o preco:
  //
  //     cuca        R$ 22,90  ->  cuca recheada           +R$ 4,00
  //     empadao     R$ 34,90  ->  empadao com palmito     +R$ 5,00
  //     torta fria  R$ 36,90  ->  torta fria com palmito  +R$ 3,00
  //
  // Usar a lista inteira pra renomear cobraria a mais de quem pediu o simples.
  // Entao: se o que ele escreveu JA E um produto do cardapio, e ele mesmo.
  const tamanhoDoMelhor = servem[0].casa.length;
  const noTamanho = servem.filter((c) => c.casa.length === tamanhoDoMelhor);
  const proprios = noTamanho.filter((c) => !c.apelido);
  const empatados = proprios.length ? proprios : noTamanho;
  const familias = new Set(empatados.map((c) => c.categoria));
  const ambiguo = familias.size > 1;

  const escolhido = escolherPeloContexto(empatados, String(categoria || ""), textoDoContexto);
  if (escolhido === "perguntar") {
    const sabor = t.replace(/^bolo (caseiro )?(de |do |da )?/, "").trim();
    return { produto: "bolo", recheio: sabor || null, unidade: "un", unico: false };
  }

  const resto = t
    .slice(escolhido.casa.length)
    .replace(/^ *(de|da|do|com) +/, "")
    .trim();

  const colideNoCatalogo = paresDeNomeCurtoColidindo().some((par) =>
    par.produtos.some((p) => p.nome === escolhido.canonico),
  );

  return {
    produto: escolhido.canonico,
    recheio: resto || null,
    unidade: unidadeDoProduto(escolhido.canonico, escolhido.categoria),
    unico: !ambiguo && !colideNoCatalogo,
  };
}
