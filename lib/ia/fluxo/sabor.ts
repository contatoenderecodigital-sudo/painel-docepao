// ============================================================================
//  SABOR EM ABERTO E BURACO NO PEDIDO
//
//  Regra do dono, 23/08/2026: "nunca pode produto com sabor ser fechado sem
//  sabor escolhido, tanto trufa, docinho, cuca, tudo; isso e geral da padaria".
//
//  E ele completou o desenho: "tem itens que ja tem sabor e nao precisa
//  selecionar, so os que precisa selecionar tem a regra". E exatamente o que o
//  catalogo ja diz, com as palavras da dona:
//
//    "FRITO = sabor fixo, a IA NAO pergunta recheio (o recheio ja esta no
//     campo 'recheio'). ASSADO = se tiver 'recheios', a IA PERGUNTA qual o
//     cliente quer. Frito com 'recheios' (risolis, mini bolha) a IA PERGUNTA
//     igual ao assado."
//
//  QUEM DECIDE E A TABELA, NAO EU
//
//  A lista do que pede escolha sai do proprio catalogo, item por item: o que
//  tiver 'recheios' ou 'sabores' pergunta, o resto nao. No dia em que a dona
//  acrescentar um sabor de cuca na tela, a regra passa a valer pra ele sozinha,
//  sem ninguem mexer em codigo.
//
//  Hoje sao 21 produtos que pedem escolha: coxinha nao pede (recheio fixo),
//  risolis pede, esfirra pede, trufa pede, cuca recheada pede, franciscano
//  pede, empadao pede, torta pede, cupcake pede.
//
//  POR QUE ISSO E DE PRODUCAO, NAO DE CONVERSA
//
//  Comanda com "2 kg de empadao" sem dizer se e de frango ou de palmito para a
//  cozinha no meio da manha, e alguem tem que ligar pro cliente. O pedido nao
//  pode fechar assim.
// ============================================================================

import catalogo from "../dados/catalogo.json";
import { produtosDaCasa, produtoNoComeco, produtoPorNome } from "../dados/produtos";
import { semAcento, afirmouOuNegou, cercaDaPalavra } from "../texto";
import { identificarProduto } from "./produto";

/** Na observacao: sabor que a casa nao tem na lista, a equipe confirma. */
export const MARCA_SABOR_A_CONFIRMAR = "sabor a confirmar";

/** O sabor que ele pediu e um dos que o cardapio lista neste produto? */
export function saborCabeNaLista(produto: string, sabor: string): boolean {
  const p = produtoNoComeco(produto) ?? produtoPorNome(produto);
  if (!p?.sabores.length) return false;
  const pedido = semAcento(sabor);
  if (!pedido) return false;
  return p.sabores.some((s) => {
    const alvo = semAcento(s);
    return alvo === pedido || alvo.includes(pedido) || pedido.includes(alvo);
  });
}

/**
 * Todo produto do cardapio que tem lista de sabor ou recheio pra escolher.
 *
 * SAI DA LISTA UNICA, e nao mais de quatro leituras do catalogo cru.
 *
 * A lista unica ja resolveu, num lugar so, a regra que aqui era implicita: o
 * `recheio` no singular quer dizer "ja vem pronto, nao pergunta" e virou
 * `saborFixo`; o `recheios` no plural quer dizer "pergunte qual" e virou
 * `sabores[]`. Um "s" mudava o comportamento e isso nao estava escrito em
 * lugar nenhum.
 *
 * E de quebra a PIZZA entrou. Ela e chave de primeiro nivel no catalogo, entao
 * as quatro leituras aqui nunca a alcancavam: `pizza inteira` e `pizza meia`
 * tem 31 sabores cada e NENHUM era perguntado. A cozinha recebia pizza sem
 * sabor. Medido em 26/08/2026, comparando este arquivo com a lista unica.
 */
function comEscolha(): { nome: string; opcoes: string[] }[] {
  return produtosDaCasa()
    .filter((p) => !p.saborFixo && p.sabores.length > 0)
    .map((p) => ({ nome: p.nome, opcoes: p.sabores }));
}

// O mesmo normalizador de todo mundo. Esta era a sexta copia, e a unica sem
// `.trim()`: por isso o `recheioQueNaoExiste` la embaixo tinha que chamar trim
// por fora, e os outros nao.
const semAcMin = semAcento;

/**
 * ESTE ITEM PRECISA DE SABOR, E ELE JA FOI ESCOLHIDO?
 *
 * Devolve as opcoes que faltam escolher, ou null quando o item nao pede escolha
 * ou quando a escolha ja esta no pedido.
 *
 * A escolha vale escrita em QUALQUER lugar da linha: no nome do produto
 * ("esfirra de carne") ou na observacao ("carne"). O cliente escreve dos dois
 * jeitos e os dois chegam na cozinha igual.
 */
export function saborQueFalta(produto: string, obs?: string | null): { nome: string; opcoes: string[] } | null {
  const nome = semAcMin(produto);

  // LISTA ABERTA SO DEPOIS DE INSISTIR. Ate la a padaria mostra o cardapio.
  if (semAcMin(obs ?? "").includes(semAcMin(MARCA_SABOR_A_CONFIRMAR))) return null;

  // QUEM DIZ QUAL PRODUTO E ESTE E O CATALOGO, E NAO O COMECO DA STRING.
  //
  // Esta busca comparava letra por letra com o nome do cardapio, e por isso o
  // jeito que o CLIENTE escreve nao chegava nela. Medido em 28/08/2026:
  //
  //   saborQueFalta("risolis")  ->  pergunta o sabor
  //   saborQueFalta("risoles")  ->  NAO PERGUNTA
  //   saborQueFalta("esfiha")   ->  NAO PERGUNTA
  //
  // "risoles" e "esfiha" sao apelidos que a casa mantem em `apelidos.ts`
  // justamente porque e assim que o cliente escreve. Um item que entrasse no
  // pedido com esse nome atravessava a trava do fechamento em silencio, e a
  // comanda ia pra cozinha SEM RECHEIO -- que e a unica coisa que este arquivo
  // existe pra impedir.
  //
  // A funcao logo abaixo, `passouDoLimiteDeSabores`, ja perguntava ao catalogo.
  // Duas funcoes do mesmo arquivo respondendo "que produto e este?" de dois
  // jeitos diferentes so podia divergir, e divergia.
  // `produtoNoComeco` compara com o nome do CARDAPIO, e "risoles" nao e o nome
  // do cardapio: e o apelido que a casa mantem porque e assim que o cliente
  // escreve. Quem traduz apelido pro nome canonico e `identificarProduto`, e
  // perguntar a ele custa uma linha.
  const canonico = identificarProduto(produto).produto;
  const daCasa =
    produtoNoComeco(produto) ?? produtoPorNome(produto) ??
    produtoNoComeco(canonico) ?? produtoPorNome(canonico);
  const item = daCasa && !daCasa.saborFixo && daCasa.sabores.length
    ? { nome: daCasa.nome, opcoes: daCasa.sabores }
    : // Nome que o catalogo nao resolve: sobra o casamento pelo comeco, que
      // ainda pega "esfirra de carne" escrito por extenso.
      comEscolha()
        .filter((c) => nome.startsWith(semAcMin(c.nome)) || nome === semAcMin(c.nome))
        .sort((a, b) => b.nome.length - a.nome.length)[0];
  if (!item) return null;

  // O SABOR TEM QUE ESTAR FORA DO NOME DO PRODUTO.
  //
  // A busca olhava a linha inteira, e ai o nome do produto respondia por si:
  //
  //     "empadao com palmito"  tem sabores ["palmito", "frango com palmito"]
  //
  // A palavra "palmito" esta no NOME, entao o codigo achava que o sabor ja
  // tinha sido escolhido e nunca perguntava. So que sao duas coisas
  // diferentes na cozinha: palmito puro ou frango com palmito. O mesmo vale
  // pra torta fria com palmito.
  //
  // Medido em 26/08/2026, comparando o que este arquivo decide com o que a
  // lista unica sabe: 82 dos 86 produtos concordavam, e estes dois eram
  // divergencia de verdade.
  //
  // Tirando o nome do produto, sobra o que o CLIENTE escreveu.
  // O QUE SOBRA DEPOIS DO NOME QUEM SEPARA E O RESOLVEDOR, E NAO UMA CONTA DE
  // CARACTERES.
  //
  // Isto era `linha.slice(nomeCanonico.length)`, e so funcionava enquanto o
  // cliente escrevesse o nome do cardapio. Com apelido, o canonico tem outro
  // tamanho e o corte comia o recado:
  //
  //   "pastel carne"   canonico "mini bolha", 10 letras
  //   sobrava          "rne"      ->  nao acha "carne", pergunta de novo
  //
  // Treze jeitos de escrever davam isso, medidos em 28/08/2026. E o corte tinha
  // que existir mesmo: "empadao com palmito" tem "palmito" no NOME, e sem tirar
  // o nome o produto respondia por si e a padaria nunca perguntava se era
  // palmito puro ou frango com palmito.
  //
  // `identificarProduto` ja devolve as duas metades: o produto e o que veio
  // grudado nele. A segunda metade E o que sobra depois do nome, seja qual for
  // o jeito que ele escreveu.
  const grudado = identificarProduto(produto).recheio ?? "";
  const semONome = (semAcMin(grudado) + " " + semAcMin(obs ?? "")).trim();
  const escolhido = item.opcoes.some((o) => {
    const alvo = semAcMin(o);
    if (!semONome.includes(alvo)) return false;
    // O SABOR NEGADO NAO E O SABOR ESCOLHIDO.
    //
    // A conferida era so "a palavra esta na linha?". Medido em 28/08/2026:
    //
    //   esfirra, obs "sem carne"        ->  achava que ele ja tinha escolhido
    //   quiche, obs "sem frango"        ->  idem
    //   esfirra, obs "nao quero carne"  ->  idem
    //
    // A padaria parava de perguntar o recheio e a comanda ia pra cozinha com
    // uma esfirra sem recheio nenhum, carregando "sem carne" no recado.
    //
    // Quem sabe separar "carne" de "sem carne" e o leitor da frase, que ja faz
    // isso pelo topo, pelo papel de arroz e pelo sabor do bolo. Aqui era a
    // quarta pergunta do mesmo tipo, e a unica que nao usava ele.
    return afirmouOuNegou(semONome, cercaDaPalavra(alvo)) !== false;
  });
  return escolhido ? null : item;
}

/**
 * ELE PEDIU MAIS SABORES DO QUE CABEM?
 *
 * A pizza de forma aceita 4, a meia aceita 2, a redonda aceita 2. Audio da
 * dona, 19/08/2026: "so dois sabores por pizza redonda".
 *
 * Isso estava no catalogo em `sabores_ate` desde sempre e NENHUMA LINHA DE
 * CODIGO LIA. Medido em 26/08/2026: uma redonda de 30 cm fechava com CINCO
 * sabores e a de forma com SEIS. A cozinha recebia um pedido que nao consegue
 * produzir, e alguem teria que ligar pro cliente.
 *
 * Devolve o limite E os sabores que ele falou, ou null quando cabe.
 *
 * Os sabores voltam junto porque a pergunta precisa deles. "Escolhe menos
 * sabores" nao e pergunta, e uma reclamacao: o cliente teria que rolar a
 * conversa pra lembrar o que disse. Com a lista na mao, a padaria devolve os
 * seis que ele falou pra ele marcar quatro.
 */
export function passouDoLimiteDeSabores(
  produto: string,
  obs?: string | null,
): { limite: number; escolhidos: string[] } | null {
  const p = produtoNoComeco(produto) ?? produtoPorNome(produto);
  const limite = p?.saboresAte;
  if (!limite || !p) return null;

  // CONTA CONSUMINDO O TEXTO, DO NOME MAIS LONGO PRO MAIS CURTO.
  //
  // Nao conta virgula: "frango com catupiry" tem uma virgula a menos e dois
  // "com", e contar separador erraria nos dois sentidos.
  //
  // E nao descarta o sabor curto so por ele caber dentro de um longo. Foi o que
  // eu tinha feito primeiro, e a trava nao pegava NADA:
  //
  //     "bacon, bacon com milho, bacon com brocolis"   ->  contava 2, e sao 3
  //
  // O "bacon" era jogado fora por estar contido nos outros dois, e a pizza meia
  // fechava com tres sabores dentro de um limite de dois. O cliente pediu os
  // tres, e os tres estao escritos ali.
  //
  // Consumir resolve os dois casos com uma regra so: o pedaco de texto que ja
  // virou um sabor sai da linha e nao pode virar outro. Assim "frango com
  // catupiry" nao vira tambem "frango", e "bacon" dito de novo, separado, conta
  // de novo.
  const linha = semAcMin(produto) + " " + semAcMin(obs ?? "");
  let resto = linha;
  const achados: { sabor: string; onde: number }[] = [];
  for (const s of [...p.sabores].sort((a, b) => semAcMin(b).length - semAcMin(a).length)) {
    const alvo = semAcMin(s);
    if (alvo.length <= 2) continue;
    let i = resto.indexOf(alvo);
    if (i < 0) continue;
    // O mesmo sabor dito duas vezes e um sabor so: quem manda e a lista de
    // sabores distintos, nao quantas vezes ele repetiu.
    achados.push({ sabor: s, onde: linha.indexOf(alvo) });
    while (i >= 0) {
      resto = resto.slice(0, i) + " ".repeat(alvo.length) + resto.slice(i + alvo.length);
      i = resto.indexOf(alvo);
    }
  }
  // Na ordem em que ele falou, que e a ordem em que ele pensou. A pergunta
  // devolve essa lista pra ele marcar, entao a ordem importa.
  const escolhidos = achados.sort((a, b) => a.onde - b.onde).map((a) => a.sabor);
  return escolhidos.length > limite ? { limite, escolhidos } : null;
}

/**
 * O QUE PASSOU DO LIMITE NO PEDIDO INTEIRO.
 *
 * Espelha o `saboresQueFaltam`: o fechamento cobra por aqui e a pergunta se faz
 * pela mesma lista, entao a trava e a fala nunca discordam sobre o que falta.
 */
export function saboresAlemDoLimite(
  itens: { produto: string; obs?: string | null }[],
): { produto: string; limite: number; escolhidos: string[] }[] {
  const passou: { produto: string; limite: number; escolhidos: string[] }[] = [];
  for (const i of itens) {
    const x = passouDoLimiteDeSabores(i.produto, i.obs);
    if (x && !passou.some((y) => y.produto === i.produto)) {
      passou.push({ produto: i.produto, limite: x.limite, escolhidos: x.escolhidos });
    }
  }
  return passou;
}

/** O que falta escolher no pedido inteiro, em portugues, pra cobrar do cliente. */
export function saboresQueFaltam(
  itens: { produto: string; obs?: string | null }[],
): { produto: string; opcoes: string[] }[] {
  const falta: { produto: string; opcoes: string[] }[] = [];
  for (const i of itens) {
    const f = saborQueFalta(i.produto, i.obs);
    if (f && !falta.some((x) => x.produto === i.produto)) {
      falta.push({ produto: i.produto, opcoes: f.opcoes });
    }
  }
  return falta;
}

/**
 * AS CORES DE FORMINHA QUE ELE FALOU.
 *
 * Teste da Kemilly, 23/08/2026: ela pediu "quero azul e rosa" com dois docinhos
 * na mesa, e o sistema guardou UMA cor e escreveu "forminha azul e rosa" na
 * observacao dos dois. O painel marcou o chip azul e a producao ficaria sem
 * saber qual e qual.
 *
 * Duas cores para dois docinhos e a coisa mais natural do mundo, e uma
 * atendente resolveria sozinha: a primeira cor pro primeiro, a segunda pro
 * segundo. E o que o codigo faz aqui.
 *
 * Sai da lista do catalogo, entao "verde tiffany" e cor e "verde limao" nao e,
 * e quando ele pede o que a casa nao tem, da pra dizer o que a casa tem.
 */
export function coresDaForminha(texto: string): string[] {
  const t = semAcMin(texto);
  // A lista sai de quem ja e dono dela, e nao de uma segunda leitura do JSON.
  const cores = coresDoCardapio();

  // Do nome mais longo pro mais curto: "azul bebe" antes de "azul", senao a
  // primeira acha "azul" e sobra "bebe" perdido.
  const achadas: { cor: string; onde: number }[] = [];
  for (const cor of [...cores].sort((a, b) => b.length - a.length)) {
    const onde = t.indexOf(semAcMin(cor));
    if (onde < 0) continue;
    // Ja achei uma cor que contem esta? "azul bebe" ja cobre "azul".
    if (achadas.some((a) => semAcMin(a.cor).includes(semAcMin(cor)) && a.onde <= onde)) continue;
    achadas.push({ cor, onde });
  }
  // Na ordem em que ele falou, que e a ordem em que ele pensou.
  return achadas.sort((a, b) => a.onde - b.onde).map((a) => a.cor);
}

/** Todas as cores do cardapio, pra oferecer quando ele pedir uma que nao existe. */
export function coresDoCardapio(): string[] {
  return ((catalogo.forminhas_docinho?.cores ?? []) as string[]).map(String);
}

/**
 * ELE PEDIU UM RECHEIO QUE ESTE PRODUTO NAO TEM.
 *
 * Sete produtos da casa tem recheio FIXO: a coxinha e de frango, a bolinha e de
 * queijo, o croquete e de carne com catupiry. Nesses o catalogo diz que a IA
 * NAO pergunta, e por isso ninguem conferia o que o cliente escrevia junto:
 *
 *     "100 coxinha de camarao"  ->  comanda: 100 coxinha ~ camarao
 *
 * Medido em 27/08/2026. O produto estava certo, o preco estava certo, e a
 * COMANDA PROMETIA o que a cozinha nao faz. Quem tem lista de sabor (esfirra,
 * quiche, empadao) ja estava protegido: o sabor de fora nao casa com a lista e
 * a padaria pergunta. So os de recheio fixo passavam calado.
 *
 * Devolve o recheio de verdade quando o cliente pediu outro, ou null.
 *
 * NAO E RECUSA. A padaria diz o que a coxinha e, como uma atendente diria, e o
 * pedido segue com a coxinha. Quem quiser insistir no camarao fala de novo e a
 * equipe resolve, que e o caminho de sempre.
 */
export function recheioQueNaoExiste(produto: string, recheio?: string | null): string | null {
  const pedido = semAcMin(recheio ?? "").trim();
  if (!pedido) return null;

  // AQUI SO CHEGA SABOR, E ISSO NAO E LISTA MINHA.
  //
  // A primeira versao recebia a observacao inteira, e eu tinha escrito uma
  // lista de palavras pra separar recado de recheio ("sem", "bem", "pouco",
  // "capricha"). O dono cortou, com a regua de sempre: nada pode ser lista
  // minha, so o cardapio e os precos sao fixos.
  //
  // A lista sumiu porque o problema sumiu: quem separa recado de sabor e a IA,
  // que tem o contexto, e ela devolve os dois em campos diferentes. O que chega
  // nesta funcao ja e sabor declarado, e o que ela confere e o CATALOGO, que e
  // lista legitima porque e a tabela da casa.

  const p = produtoNoComeco(produto) ?? produtoPorNome(produto);
  if (!p?.saborFixo || !p.sabores.length) return null;

  // O que ele escreveu bate com o recheio da casa? Vale por pedaco, porque
  // "presunto e queijo" pode vir como "queijo" ou "presunto".
  const daCasa = p.sabores.map(semAcMin);
  const bate = daCasa.some(
    (s) => s === pedido || s.includes(pedido) || pedido.includes(s) ||
      s.split(/[ e]+/).filter((x) => x.length > 2).some((parte) => pedido.includes(parte)),
  );
  return bate ? null : p.sabores.join(" e ");
}
