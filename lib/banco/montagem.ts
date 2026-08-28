// ============================================================================
//  PEDIDO EM MONTAGEM — o estado do pedido durante a conversa.
//
//  A IA não remonta mais o pedido inteiro a cada mensagem: ela acrescenta um
//  item, corrige um sabor, informa a data. Cada operação mexe no que mudou e
//  deixa o resto quieto. Foi a remontagem que fez o bolo virar docinho, a data
//  virar hoje e o pedido inteiro ser apagado por uma chamada vazia.
//
//  A CATEGORIA vem junto de cada item e é obrigatória aqui, porque nome de
//  produto se repete: "brigadeiro" é docinho de R$ 1,25 e é sabor de bolo de
//  R$ 46,90 o quilo. Sem a categoria, quem lê depois tem que adivinhar.
// ============================================================================

import { query, queryUm } from "./db";
// A lista de sabores do cardapio separa pizza doce de salgada, e e ela que
// decide se duas pizzas anotadas sao a mesma ou duas.
//
// Isto lia o `catalogo.json` CRU, e era o ultimo leitor cru no caminho da
// conversa. Nao por preguica: a lista que o `produtos.ts` expunha juntava os
// dois tipos e perdia justamente a separacao. Faltava a porta, e agora ela
// existe (`saboresDaPizzaPorTipo`).
// Caminho relativo de proposito: os testes compilam este arquivo sozinho, e o
// atalho "@/" so existe dentro do build do Next.
import { coresDaForminha } from "../ia/fluxo/sabor";
import { ehNomeDeFamilia, familiaDaCategoria, familiaDoNome } from "../ia/fluxo/generico";
import { produtosDaCasa, saboresDaPizzaPorTipo } from "../ia/dados/produtos";
import { semAcento } from "../ia/texto";

export type CategoriaItem =
  | "bolo_festa"
  | "bolo_caseiro"
  | "docinho"
  | "salgado_frito"
  | "salgado_assado"
  | "pizza"
  | "por_quilo"
  | "por_unidade"
  | "cupcake"
  | "papel_de_arroz"
  | "outro";

export type ItemMontagem = {
  produto: string;
  categoria: CategoriaItem;
  qtd: number;
  unidade: "un" | "kg";
  obs?: string | null;
};

export type DadosMontagem = {
  cliente_nome?: string | null;
  retirada_data?: string | null;
  retirada_hora?: string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  // O que o cliente DISPENSOU nesta festa ("salgado", "docinho", "bolo"),
  // separado por virgula. Sem isso a etapa dele fica cobrando pra sempre.
  nao_quer?: string | null;

  // ------------------------------------------------------ memoria da conversa
  //
  // Campos do fluxo, nao do pedido: nao aparecem na tela da dona e nao entram
  // na comanda. Estao aqui porque no WhatsApp CADA MENSAGEM E UMA CHAMADA NOVA,
  // e sem isto a conversa esquecia tudo o que nao fosse item ou data.
  //
  // Era assim ate 23/08/2026: o cliente dizia "festa pra 20 pessoas", recebia a
  // proposta de R$ 418,80, tocava em "Pode ser", e a mensagem seguinte comecava
  // com ehFesta false e pessoas null. A base que ele acabara de aceitar nao
  // existia mais, e nada virava pedido. Nos testes nao aparecia porque la a
  // conversa inteira roda dentro de uma chamada so.
  fluxo_festa?: string | null; // "sim" quando a conversa e de festa
  fluxo_pessoas?: string | null; // quantas pessoas vao
  fluxo_base_aceita?: string | null; // "sim" depois que ele aceita a proposta
  fluxo_topo?: string | null; // "sim" ou "nao" (ausente = ainda nao perguntado)
  fluxo_papel?: string | null; // "sim" ou "nao" (ausente = ainda nao perguntado)
  fluxo_topo_nome?: string | null; // nome do aniversariante, pro topo
  fluxo_topo_idade?: string | null; // idade do aniversariante, pro topo
  fluxo_tema?: string | null; // tema da peca personalizada ("Minnie")
  fluxo_escrito?: string | null; // o que vai escrito na peca, ou "nada"
  fluxo_forminha?: string | null; // cor da forminha do docinho
  fluxo_prato?: string | null; // "aberto" ou "tampa"
  fluxo_ultima_fala?: string | null; // a ultima pergunta que a padaria fez
  fluxo_insistiu?: string | null; // quantas vezes ela repetiu essa pergunta
  fluxo_ofereceu?: string | null; // "sim" depois que ela ofereceu docinho/bolo
  fluxo_assunto?: string | null; // a etapa que ELE pos na mesa, ou "nenhum"
  fluxo_retomar?: string | null; // a etapa pra onde voltar depois do desvio
  // O que ele pediu fora da hora, guardado ate a conversa chegar na etapa
  // daquele item. JSON, ou "nenhum" quando nao ha nada guardado.
  fluxo_guardados?: string | null;
};

export type Montagem = { itens: ItemMontagem[]; dados: DadosMontagem };

// PEDIDO VAZIO PRECISA SER NOVO A CADA CLIENTE.
//
// Isto era uma constante compartilhada, e lerMontagem devolvia vazia():
// a copia rasa leva o MESMO array de itens. Quem anotava o primeiro item
// empurrava dentro do array compartilhado, e o proximo cliente sem pedido ja
// nascia com o item do anterior. Com um cliente por vez ninguem via; com tres
// conversando junto, a cuca de um caiu no pedido do outro.
const vazia = (): Montagem => ({ itens: [], dados: {} });

export async function lerMontagem(negocioId: string, clienteId: string): Promise<Montagem> {
  const l = await queryUm<{ itens: ItemMontagem[]; dados: DadosMontagem }>(
    "select itens, dados from pedido_montagem where negocio_id = $1 and cliente_id = $2",
    [negocioId, clienteId],
  );
  return l ? { itens: l.itens ?? [], dados: l.dados ?? {} } : vazia();
}

async function gravar(negocioId: string, clienteId: string, m: Montagem): Promise<void> {
  await query(
    `insert into pedido_montagem (negocio_id, cliente_id, itens, dados)
     values ($1, $2, $3::jsonb, $4::jsonb)
     on conflict (negocio_id, cliente_id) do update
       set itens = excluded.itens, dados = excluded.dados, atualizado_em = now()`,
    [negocioId, clienteId, JSON.stringify(m.itens), JSON.stringify(m.dados)],
  );
}

// Mesmo produto + mesma categoria = mesma linha. É o que deixa "muda pra 150
// coxinhas" sobrescrever em vez de criar uma segunda linha de coxinha, e ao
// mesmo tempo permite brigadeiro docinho e bolo brigadeiro convivendo.
const mesmaLinha = (a: ItemMontagem, b: { produto: string; categoria: CategoriaItem }) =>
  a.categoria === b.categoria && a.produto.trim().toLowerCase() === b.produto.trim().toLowerCase();

const marca = (o?: string | null) => (o ?? "").trim().toLowerCase();

// Observacao que a IA escreve so pra nao deixar o campo vazio.
const ENFEITE = /^(sem\s+(sabor|recheio)|a\s+definir|nao\s+informad|n[ãa]o\s+especificad|indefinid|a\s+combinar)/i;

// A COR DA FORMINHA SAI DO CARDAPIO, E DE UM LUGAR SO.
//
// Aqui havia uma regex com as 21 cores copiadas a mao. Duas coisas erradas nela,
// e a segunda e a que importa:
//
//   1. o dia em que a dona cadastrasse uma cor nova na tela, esta copia nao
//      saberia, e o docinho pareceria estar sem cor;
//   2. `coresDaForminha` ja fazia exatamente este trabalho, lendo o catalogo,
//      resolvendo "azul bebe" antes de "azul" e devolvendo na ordem em que o
//      cliente falou. Duas implementacoes do mesmo assunto sempre divergem, e
//      este projeto ja levou esse prejuizo com o vocabulario da etapa.
//
// Regra do dono, 27/08/2026: "nada pode ser so uma lista tua, so o cardapio e
// valores, o que e fixo mesmo".
//
// De quebra, a leitura passou a ignorar acento: quem digita "azul bebe" no
// celular agora e entendido, e antes nao era.

// O bolo da festa é UM só: o cliente vai refinando a observação (o pão de ló, o
// tema, o nome, a foto) e cada refinamento é a mesma linha. Tratar a observação
// como identidade aqui criava dois bolos de 2 kg no mesmo pedido, e a conta
// dobrava. Nos salgados é o contrário: frango e calabresa são linhas separadas.
const UMA_LINHA_SO: CategoriaItem[] = ["bolo_festa", "bolo_caseiro", "papel_de_arroz", "pizza"];

// Nomes que o cliente usa quando ainda não escolheu o tipo. Quando ele detalha
// depois ("desses 300, metade frango"), o detalhe sai de dentro do genérico.
// A LISTA MORA NO `generico.ts`, E SO LA. Aqui havia a terceira copia dela.
const ehGenerico = (produto: string) => ehNomeDeFamilia(produto);

// Bolo com dois sabores: o nome do item precisa dizer os dois, senao a cozinha
// produz so o primeiro. A observacao ja traz o segundo sabor.
/**
 * O SEGUNDO SABOR TEM QUE SER UM SABOR DO CARDAPIO.
 *
 * A regex pega QUALQUER par de palavras ligado por "e" ou "com", e o que ela
 * pega vai parar no NOME DO PRODUTO, que e o que a cozinha le e o que o motor
 * cota. Medido em 28/08/2026, com o que ela devolve de verdade:
 *
 *   "pao de lo branco e tema Frozen"  ->  a="pao de lo branco"  b="tema frozen"
 *   "prato aberto e papel de arroz"   ->  a="prato aberto"      b="papel de arroz"
 *   "massa branca com recheio ninho"  ->  a="massa branca"      b="recheio ninho"
 *
 * O caso caro e o que casa: item "bolo prestigio", observacao "prestigio com
 * ganache". O nome vira "bolo prestigio com ganache", que EXISTE no cardapio
 * como bolo CASEIRO -- R$ 33,90 a unidade no lugar de R$ 46,90 o quilo. Uma
 * palavra na observacao trocava o produto e o preco.
 *
 * A regex fica: ela e o jeito de achar o par na frase. O que muda e que o
 * segundo so vale quando o CARDAPIO diz que ele e sabor de bolo.
 */
const saboresDeBolo = (): Set<string> => {
  if (!saboresCache) {
    saboresCache = new Set(
      produtosDaCasa()
        .filter((p) => p.categoria === "bolo_festa" || p.categoria === "bolo_caseiro")
        .map((p) => semAcento(p.nomeCurto)),
    );
  }
  return saboresCache;
};
let saboresCache: Set<string> | null = null;

// Exportada pra o teste rodar ESTA funcao, e nao uma reconstrucao dela. A
// primeira versao do teste extraia o corpo da fonte e executava com `new
// Function`, o que quebra no primeiro tipo de TypeScript que sobrar dentro.
export function nomeComOsDoisSabores(item: ItemMontagem): ItemMontagem {
  if (!String(item.categoria ?? "").startsWith("bolo")) return item;
  const nome = semAcento(item.produto);
  const obs = semAcento(item.obs ?? "");
  if (!obs) return item;

  // QUEM ACHA O SABOR E O CARDAPIO, E NAO O FORMATO DA FRASE.
  //
  // Aqui havia uma regex que pegava qualquer par de palavras ligado por "e" ou
  // "com" -- `([a-za-u ]{3,20}) (e|com) ([a-za-u ]{3,20})` -- e o segundo pedaco
  // ia direto pro NOME DO PRODUTO. Ela errava dos dois lados.
  //
  // Deixava passar o que nao e sabor:
  //
  //   "prestigio com ganache" no bolo prestigio  ->  "bolo prestigio com
  //   ganache", que existe no cardapio como bolo CASEIRO: R$ 33,90 a unidade no
  //   lugar de R$ 46,90 o quilo. Uma palavra na observacao trocava o produto.
  //
  // E barrava SETE dos trinta sabores da casa, medidos em 28/08/2026, porque o
  // formato da regex nao cabia neles: "4 leites" e "0% lactose" tem digito,
  // "frutas (pessego e abacaxi)" tem parentese, e "fuba com goiabada",
  // "chocolate preto com leite ninho", "brigadeiro com maracuja" e "prestigio
  // com ganache" ja tem "com" dentro do proprio nome. Quem pedisse bolo
  // brigadeiro com 4 leites levava so o brigadeiro.
  //
  // Agora procura pelo NOME do sabor, do mais longo pro mais curto, e exige o
  // conector na frente: "com <sabor>" ou "e <sabor>". O conector e o que separa
  // "brigadeiro com morango" (dois sabores) de "tema morango" (decoracao).
  const conector = (sabor: string) =>
    new RegExp("(^|[^a-z])(e|com)[ ]+" + sabor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z])", "i");

  const outro = [...saboresDeBolo()]
    // O mais longo primeiro: "prestigio com ganache" tem que ganhar de
    // "prestigio", senao o nome fica pela metade.
    .sort((a, b) => b.length - a.length)
    .find((sabor) => !nome.includes(sabor) && conector(sabor).test(obs));

  return outro ? { ...item, produto: item.produto + " com " + outro } : item;
}

// A observacao do jeito que a cozinha precisa ler: sem pedaco repetido e sem
// recado interno sobre o que ainda falta perguntar.
function observacaoLimpa(obs?: string | null): string | null {
  const bruto = String(obs ?? "").trim();
  if (!bruto) return null;
  const pedacos = bruto
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    // Recado interno nao e observacao de produto: sai do ticket.
    .filter((t) => !/(faltando|falta[rm]? (o|a|os|as)\b|nao informad|sem informar|a confirmar com o cliente)/i.test(t));
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const t of pedacos) {
    const chave = semAcento(t);
    if (vistos.has(chave)) continue;
    // Pedaco que ja esta contido em outro maior tambem e repeticao.
    if ([...vistos].some((v) => v.includes(chave) || chave.includes(v))) continue;
    vistos.add(chave);
    unicos.push(t);
  }
  const limpo = unicos.join(", ").trim();
  return limpo || null;
}

/**
 * DE QUE FAMILIA E ESTE ITEM: salgado, docinho, bolo.
 *
 * Serve pra achar a LINHA GENERICA de onde subtrair. O cliente pede "300
 * assados" e depois diz quais sao; sem isto o pedido fecha com 450 salgados, e
 * ja sobrou um "salgado 200" fantasma no pedido de verdade.
 *
 * Olha a categoria E o nome, porque a linha generica costuma vir com a
 * categoria errada ("salgado" anotado como `outro`).
 *
 * Estava escrita aqui dentro do `anotarItem`, com regex, e e a tabela
 * `FAMILIAS` do `generico.ts` escrita de novo e ao contrario. Foi exportada
 * primeiro pra ganhar teste, que e a ordem certa: prende o comportamento de
 * hoje, depois troca a implementacao.
 */
export function familiaDoItem(categoria: string, produto: string): string {
  // A CATEGORIA MANDA; O NOME SO ENTRA QUANDO ELA NAO SABE.
  //
  // A linha generica costuma vir com a categoria errada ("salgado" anotado
  // como `outro`), e ai quem responde e a palavra que o cliente escreveu.
  return familiaDaCategoria(categoria) ?? familiaDoNome(produto) ?? String(categoria ?? "");
}

export async function anotarItem(
  negocioId: string,
  clienteId: string,
  itemBruto: ItemMontagem,
): Promise<Montagem> {
  const m = await lerMontagem(negocioId, clienteId);
  const item = nomeComOsDoisSabores({ ...itemBruto, obs: observacaoLimpa(itemBruto.obs) });
  const mesmoNome = m.itens.filter((x) => mesmaLinha(x, item));

  // MESMO PRODUTO COM RECHEIOS DIFERENTES SÃO DUAS LINHAS.
  //
  // "metade frango e metade calabresa" virava uma linha só: o calabresa
  // entrava por cima do frango e sumiam 150 salgados do pedido. Agora a
  // observação faz parte da identidade da linha.
  // No bolo o nome muda enquanto o cliente decide ("bolo bombom" vira "bolo
  // bombom com morango"): nome que contem o outro e a mesma linha ficando
  // completa, senao a festa fica com dois bolos e o dobro do preco.
  const nomeCresceu = (a: string, b: string) => {
    const x = a.trim().toLowerCase();
    const y = b.trim().toLowerCase();
    return x.includes(y) || y.includes(x);
  };
  // PIZZA DOCE E PIZZA SALGADA SAO DUAS PIZZAS, NAO UMA.
  //
  // O rastro de 20/08/2026 mostrou o cliente pedindo uma de forma salgada com
  // tres sabores E uma doce de brigadeiro. A Dora anotou as duas certinho, e a
  // montagem juntou numa linha so, porque pizza esta em UMA_LINHA_SO pra os
  // sabores SOMAREM (sao ate 4 na mesma pizza). O pedido foi pra cozinha com
  // UMA pizza de "brigadeiro" e o cliente pagou por uma.
  //
  // Somar sabor da mesma pizza esta certo. Somar uma doce com uma salgada nao:
  // ninguem come pizza de calabresa com brigadeiro em cima. A lista do cardapio
  // separa as duas, entao o codigo pergunta de qual lista o sabor veio.
  // VENCE O CASAMENTO MAIS LONGO, nao a ordem da checagem.
  //
  // "crocante" e sabor de pizza DOCE, entao "bacon crocante" casava com doce
  // so porque a lista doce era olhada primeiro. Comparando o tamanho, "bacon
  // com brocolis" ganha de um "banana" que apareceu de raspao.
  const doceOuSalgada = (obs: string | null | undefined): "doce" | "salgada" | null => {
    const t = marca(obs);
    if (!t) return null;
    const p = saboresDaPizzaPorTipo();
    const maior = (lista: string[] = []) =>
      lista.reduce((m, s) => {
        const x = marca(s);
        return t.includes(x) && x.length > m ? x.length : m;
      }, 0);
    const doce = maior(p.doces);
    const salgada = maior(p.salgados);
    if (!doce && !salgada) return null;
    return doce > salgada ? "doce" : "salgada";
  };
  const tipoNovo = item.categoria === "pizza" ? doceOuSalgada(item.obs) : null;

  let i = UMA_LINHA_SO.includes(item.categoria)
    ? m.itens.findIndex(
        (x) =>
          x.categoria === item.categoria &&
          nomeCresceu(x.produto, item.produto) &&
          // So junta pizza com pizza do MESMO tipo. Sem tipo definido nos dois
          // lados, segue a regra antiga.
          (!tipoNovo || !doceOuSalgada(x.obs) || doceOuSalgada(x.obs) === tipoNovo),
      )
    : m.itens.findIndex((x) => mesmaLinha(x, item) && marca(x.obs) === marca(item.obs));

  // Só existe uma linha desse produto: é correção dela, não linha nova. Cobre
  // "muda pra 150 coxinhas" (sem recheio), "as coxinhas são de frango"
  // (acrescentando o recheio numa linha que ainda estava sem) e o caso que
  // duplicou a trufa: a linha tinha "forminha azul royal" e o sabor chegou
  // depois como "morango, forminha azul royal". Uma observação que CONTÉM a
  // outra é a mesma linha ficando mais completa, não um item novo.
  // VALE PRA QUALQUER NUMERO DE LINHAS, NAO SO PRA UMA.
  //
  // Isto exigia `mesmoNome.length === 1`, e por isso desistia assim que
  // existiam DUAS linhas do mesmo produto: dali em diante cada detalhe
  // confirmado virava linha nova. No teste de 19/08/2026 o pedido terminou com
  // QUATRO linhas de trufa, 100 unidades onde a cliente pediu 25, e num laco
  // eterno: a Dora perguntava o sabor, a cliente respondia, e em vez de
  // completar a linha nascia outra, entao o sabor nunca ficava preenchido.
  //
  // Agora procura entre TODAS as linhas do mesmo produto a que esta sendo
  // completada. Uma observacao que CONTEM a outra e a mesma linha ficando mais
  // completa, nao um item novo.
  if (i < 0 && mesmoNome.length > 0) {
    // "sem sabor especificado" e observacao de enfeite: vale como vazia, senao
    // o sabor que chega depois vira uma SEGUNDA linha do mesmo produto e o
    // pedido fica com duas trufas, uma delas sem sabor pra sempre.
    const limpar = (t: string) => (ENFEITE.test(t) ? "" : t);
    // COMPARA POR PEDACO, NAO POR TEXTO CORRIDO.
    //
    // "forminha branca, morango" e "morango, forminha branca" sao a MESMA
    // coisa, e comparando texto corrido nao casam. Foi assim que nasceu a
    // quarta linha de trufa: a Dora reescreveu a observacao em outra ordem.
    const pedacos = (t: string) =>
      new Set(t.split(",").map((x) => x.trim()).filter(Boolean));
    // PEDACO QUE CRESCE E O MESMO PEDACO, NAO OUTRO.
    //
    // A cliente disse "forminha azul", a Dora corrigiu pra "forminha azul
    // bebe", e como os dois textos nao sao iguais nascia uma LINHA NOVA. O
    // pedido da festa fechou com 150 brigadeiros onde ela pediu 75, R$ 187 a
    // mais, e so nao foi cobrado porque a cliente conferiu e cobrou tres vezes.
    const contem = (maior: Set<string>, menor: Set<string>) =>
      [...menor].every((p) => [...maior].some((q) => q === p || q.includes(p) || p.includes(q)));
    const nova = limpar(marca(item.obs));
    const setNova = pedacos(nova);
    // A linha MAIS parecida primeiro: entre varias, completa a que ja tem mais
    // coisa em comum, senao o recheio cai na linha errada.
    const candidata = mesmoNome
      .map((x) => ({ x, antiga: limpar(marca(x.obs)) }))
      .filter(({ antiga }) => {
        if (!antiga || !nova) return true;
        const setAntiga = pedacos(antiga);
        return contem(setNova, setAntiga) || contem(setAntiga, setNova);
      })
      .sort((a, b) => b.antiga.length - a.antiga.length)[0];
    if (candidata) i = m.itens.indexOf(candidata.x);
  }

  if (i >= 0) {
    // Corrigir NÃO apaga o que já estava: a observação antiga sobrevive quando
    // a nova vem vazia. Senão "muda pra 200" limparia o recheio já combinado.
    // E quando a nova é só um pedaço da antiga (ela reescreve o recheio do bolo
    // pela metade), fica a antiga, que é a completa.
    const antiga = m.itens[i].obs ?? null;
    const nova = item.obs ?? null;
    // Na pizza o sabor SOMA: sao ate 4 na mesma pizza, e trocar um pelo outro
    // faz a cozinha montar metade do que o cliente pediu.
    const somaSabor = item.categoria === "pizza" && !!marca(antiga) && !!marca(nova) && !marca(antiga).includes(marca(nova));
    const obs = somaSabor
      ? String(antiga).trim() + ", " + String(nova).trim()
      : !marca(nova)
        ? antiga
        : marca(antiga).includes(marca(nova))
          ? antiga
          : nova;
    m.itens[i] = { ...m.itens[i], ...item, obs: observacaoLimpa(obs) };
  } else {
    m.itens.push(item);
    // O detalhe sai de dentro do genérico: o cliente pediu 300 assados e agora
    // está dizendo quais são. Sem isso o pedido fecha com 450 salgados.
    if (!ehGenerico(item.produto)) {
      // A linha genérica costuma vir com a categoria errada ("salgado" anotado
      // como outro), então o que casa é a FAMÍLIA: salgado com salgado, docinho
      // com docinho, bolo com bolo. Sem isso sobrou um "salgado 200" fantasma
      // no pedido, junto dos salgados de verdade.
      const fam = familiaDoItem(item.categoria, item.produto);
      const g = m.itens.find((x) => ehGenerico(x.produto) && familiaDoItem(x.categoria, x.produto) === fam);
      if (g) {
        g.qtd = Math.max(0, Number(g.qtd) - Number(item.qtd));
        if (g.qtd <= 0) m.itens = m.itens.filter((x) => x !== g);
      }
    }
  }
  // A COR DA FORMINHA E INFORMACAO DO PEDIDO, NAO ATRIBUTO DO DOCINHO.
  //
  // Tinha dois defeitos aqui, os dois vistos na conversa de 25/08:
  //
  // 1. `achou[0]` pegava UMA cor so. O cliente disse "azul e amarelo" e o
  //    pedido gravou "forminha azul". O amarelo sumiu sem ninguem avisar.
  // 2. quem ja tinha cor era pulado (`continue`), entao corrigir a cor depois
  //    nao funcionava: o docinho antigo ficava com a cor velha pra sempre.
  //
  // E o desenho estava errado na raiz: a cor ficava colada em cada docinho,
  // como se fosse sabor. Ela e uma informacao do lote, igual a data ou o nome.
  // Agora mora em dados.fluxo_forminha, e os itens so espelham pra cozinha ler
  // no cupom sem ter que olhar o cabecalho.
  if (item.categoria === "docinho") {
    const ditas = coresDaForminha(String(item.obs ?? ""));
    if (ditas.length) {
      // LEMBRAR DE UMA COR NAO APAGA A OUTRA.
      //
      // Medido numa conversa de verdade em 28/08/2026, com o pedido ja montado
      // com duas cores:
      //
      //     cliente >> sim, mas nao esquece da forminha rosa
      //     antes   >> forminha rosa e azul
      //     depois  >> forminha rosa          (o azul sumiu)
      //
      // Ele estava LEMBRANDO de uma cor que ja tinha escolhido, e o codigo leu
      // como troca. E o mesmo defeito que ja tinha custado o amarelo da Kemilly,
      // por outra porta.
      //
      // A regra separa os dois sem adivinhar intencao: cor que JA ESTA na lista
      // e lembranca, e lembranca nao muda nada. Cor NOVA e troca, e ai a lista
      // passa a ser a que ele acabou de dizer.
      const jaEscolhidas = String(m.dados.fluxo_forminha ?? "")
        .split(/\s+e\s+|,/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      const novas = ditas.map((x) => x.trim().toLowerCase());
      const soLembrou = jaEscolhidas.length > 0 && novas.every((c) => jaEscolhidas.includes(c));
      const cores = soLembrou
        ? jaEscolhidas.join(" e ")
        : [...new Set(novas)].join(" e ");
      m.dados.fluxo_forminha = cores;
      for (const x of m.itens) {
        if (x.categoria !== "docinho") continue;
        // Tira a cor antiga antes de escrever a nova, senao trocar de cor
        // deixava as duas na mesma linha ("forminha azul, forminha rosa").
        const base = String(x.obs ?? "")
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p && !/^forminha($|[^a-z])/i.test(p))
          .join(", ");
        x.obs = base ? base + ", forminha " + cores : "forminha " + cores;
      }
    }
  }

  await gravar(negocioId, clienteId, m);
  return m;
}

export async function removerItem(
  negocioId: string,
  clienteId: string,
  produto: string,
  categoria: CategoriaItem,
): Promise<Montagem> {
  const m = await lerMontagem(negocioId, clienteId);
  m.itens = m.itens.filter((x) => !mesmaLinha(x, { produto, categoria }));
  await gravar(negocioId, clienteId, m);
  return m;
}

// Só os campos informados mudam. Mandar {forma_pagamento} não zera a data.
export async function anotarDados(
  negocioId: string,
  clienteId: string,
  dados: DadosMontagem,
): Promise<Montagem> {
  const m = await lerMontagem(negocioId, clienteId);
  for (const [k, v] of Object.entries(dados)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      (m.dados as Record<string, unknown>)[k] = v;
    }
  }
  await gravar(negocioId, clienteId, m);
  return m;
}

// A equipe editando a montagem inteira pela tela. Grava no mesmo lugar que a IA
// lê, então a correção passa a valer pra conversa: se a dona arruma o sabor do
// bolo, a IA já conversa com o sabor certo daí pra frente.
export async function salvarMontagemInteira(
  negocioId: string,
  clienteId: string,
  m: Montagem,
): Promise<void> {
  await gravar(negocioId, clienteId, { itens: m.itens ?? [], dados: m.dados ?? {} });
}

// Some quando o pedido vira pedido de verdade, ou quando a equipe zera pra
// recomeçar. A conversa continua; só a montagem recomeça do zero.
export async function limparMontagem(negocioId: string, clienteId: string): Promise<void> {
  await query("delete from pedido_montagem where negocio_id = $1 and cliente_id = $2", [negocioId, clienteId]);
}
