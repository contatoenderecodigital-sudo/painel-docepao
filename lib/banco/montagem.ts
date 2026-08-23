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
// Caminho relativo de proposito: os testes compilam este arquivo sozinho, e o
// atalho "@/" so existe dentro do build do Next.
import catalogo from "../ia/dados/catalogo.json";

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
  fluxo_forminha?: string | null; // cor da forminha do docinho
  fluxo_prato?: string | null; // "aberto" ou "tampa"
  fluxo_ultima_fala?: string | null; // a ultima pergunta que a padaria fez
  fluxo_insistiu?: string | null; // quantas vezes ela repetiu essa pergunta
  fluxo_assunto?: string | null; // a etapa que ELE pos na mesa, ou "nenhum"
  fluxo_retomar?: string | null; // a etapa pra onde voltar depois do desvio
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

// As cores de forminha do cardapio, pra saber se um docinho ja tem a dele.
const COR_FORMINHA =
  /(amarel\w*|azul(?:\s+(?:bebê|bebe|royal))?|branc\w*|dourad\w*|laranja\w*|lil[áa]s|marrom|pink|prata|pret\w*|ros[ae]\w*|roxo\w*|verde(?:\s+(?:bandeira|tiffany))?|vermelh\w*)(?:\s+neon|\s+claro)?/i;

// O bolo da festa é UM só: o cliente vai refinando a observação (o pão de ló, o
// tema, o nome, a foto) e cada refinamento é a mesma linha. Tratar a observação
// como identidade aqui criava dois bolos de 2 kg no mesmo pedido, e a conta
// dobrava. Nos salgados é o contrário: frango e calabresa são linhas separadas.
const UMA_LINHA_SO: CategoriaItem[] = ["bolo_festa", "bolo_caseiro", "papel_de_arroz", "pizza"];

// Nomes que o cliente usa quando ainda não escolheu o tipo. Quando ele detalha
// depois ("desses 300, metade frango"), o detalhe sai de dentro do genérico.
const GENERICOS = ["salgado", "salgado assado", "salgado frito", "docinho", "doce", "bolo recheado", "bolo"];
const ehGenerico = (produto: string) => GENERICOS.includes(produto.trim().toLowerCase());

// Bolo com dois sabores: o nome do item precisa dizer os dois, senao a cozinha
// produz so o primeiro. A observacao ja traz o segundo sabor.
function nomeComOsDoisSabores(item: ItemMontagem): ItemMontagem {
  if (!String(item.categoria ?? "").startsWith("bolo")) return item;
  const nome = String(item.produto ?? "").toLowerCase();
  const obs = String(item.obs ?? "").toLowerCase();
  // "brigadeiro e morango" / "brigadeiro com morango" na observacao
  const par = obs.match(/([a-zà-ú ]{3,20})\s+(?:e|com)\s+([a-zà-ú ]{3,20})/);
  if (!par) return item;
  const a = par[1].trim();
  const b = par[2].trim();
  const temA = nome.includes(a);
  const temB = nome.includes(b);
  if (temA && !temB && b.length > 3) {
    return { ...item, produto: item.produto + " com " + b };
  }
  return item;
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
    const chave = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (vistos.has(chave)) continue;
    // Pedaco que ja esta contido em outro maior tambem e repeticao.
    if ([...vistos].some((v) => v.includes(chave) || chave.includes(v))) continue;
    vistos.add(chave);
    unicos.push(t);
  }
  const limpo = unicos.join(", ").trim();
  return limpo || null;
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
    const p = catalogo.pizza as { sabores_salgados?: string[]; sabores_doces?: string[] };
    const maior = (lista: string[] = []) =>
      lista.reduce((m, s) => {
        const x = marca(s);
        return t.includes(x) && x.length > m ? x.length : m;
      }, 0);
    const doce = maior(p?.sabores_doces);
    const salgada = maior(p?.sabores_salgados);
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
      const familia = (c: string, p: string) =>
        /^salgado/.test(c) || /^salgado/.test(p.trim().toLowerCase())
          ? "salgado"
          : c === "docinho" || /^(docinho|doce)s?$/.test(p.trim().toLowerCase())
            ? "docinho"
            : /^bolo/.test(c) || /^bolos?$/.test(p.trim().toLowerCase())
              ? "bolo"
              : c;
      const fam = familia(item.categoria, item.produto);
      const g = m.itens.find((x) => ehGenerico(x.produto) && familia(x.categoria, x.produto) === fam);
      if (g) {
        g.qtd = Math.max(0, Number(g.qtd) - Number(item.qtd));
        if (g.qtd <= 0) m.itens = m.itens.filter((x) => x !== g);
      }
    }
  }
  // A COR DA FORMINHA E DO LOTE, NAO DE UM DOCINHO SO.
  //
  // O cliente disse "azul royal pra todos" e ela anotou so no brigadeiro e no
  // beijinho: a trufa ficava sem cor, a pendencia nunca fechava e ela perguntava
  // a cor de novo a cada mensagem. Cor dita num docinho preenche os que ainda
  // estao sem; quem ja tem a sua nao e tocado, pra quem quer uma cor por sabor
  // continuar podendo.
  if (item.categoria === "docinho") {
    const achou = String(item.obs ?? "").match(COR_FORMINHA);
    if (achou) {
      const cor = achou[0].trim();
      for (const x of m.itens) {
        if (x.categoria !== "docinho") continue;
        if (COR_FORMINHA.test(String(x.obs ?? ""))) continue;
        const base = (x.obs ?? "").trim();
        x.obs = base ? base + ", forminha " + cor : "forminha " + cor;
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
