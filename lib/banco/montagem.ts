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
};

export type Montagem = { itens: ItemMontagem[]; dados: DadosMontagem };

const VAZIA: Montagem = { itens: [], dados: {} };

export async function lerMontagem(negocioId: string, clienteId: string): Promise<Montagem> {
  const l = await queryUm<{ itens: ItemMontagem[]; dados: DadosMontagem }>(
    "select itens, dados from pedido_montagem where negocio_id = $1 and cliente_id = $2",
    [negocioId, clienteId],
  );
  return l ? { itens: l.itens ?? [], dados: l.dados ?? {} } : { ...VAZIA };
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

// O bolo da festa é UM só: o cliente vai refinando a observação (o pão de ló, o
// tema, o nome, a foto) e cada refinamento é a mesma linha. Tratar a observação
// como identidade aqui criava dois bolos de 2 kg no mesmo pedido, e a conta
// dobrava. Nos salgados é o contrário: frango e calabresa são linhas separadas.
const UMA_LINHA_SO: CategoriaItem[] = ["bolo_festa", "bolo_caseiro", "papel_de_arroz"];

// Nomes que o cliente usa quando ainda não escolheu o tipo. Quando ele detalha
// depois ("desses 300, metade frango"), o detalhe sai de dentro do genérico.
const GENERICOS = ["salgado", "salgado assado", "salgado frito", "docinho", "doce", "bolo recheado", "bolo"];
const ehGenerico = (produto: string) => GENERICOS.includes(produto.trim().toLowerCase());

export async function anotarItem(
  negocioId: string,
  clienteId: string,
  item: ItemMontagem,
): Promise<Montagem> {
  const m = await lerMontagem(negocioId, clienteId);
  const mesmoNome = m.itens.filter((x) => mesmaLinha(x, item));

  // MESMO PRODUTO COM RECHEIOS DIFERENTES SÃO DUAS LINHAS.
  //
  // "metade frango e metade calabresa" virava uma linha só: o calabresa
  // entrava por cima do frango e sumiam 150 salgados do pedido. Agora a
  // observação faz parte da identidade da linha.
  let i = UMA_LINHA_SO.includes(item.categoria)
    ? m.itens.findIndex((x) => mesmaLinha(x, item))
    : m.itens.findIndex((x) => mesmaLinha(x, item) && marca(x.obs) === marca(item.obs));

  // Só existe uma linha desse produto: é correção dela, não linha nova. Cobre
  // "muda pra 150 coxinhas" (sem recheio), "as coxinhas são de frango"
  // (acrescentando o recheio numa linha que ainda estava sem) e o caso que
  // duplicou a trufa: a linha tinha "forminha azul royal" e o sabor chegou
  // depois como "morango, forminha azul royal". Uma observação que CONTÉM a
  // outra é a mesma linha ficando mais completa, não um item novo.
  if (i < 0 && mesmoNome.length === 1) {
    const antiga = marca(mesmoNome[0].obs);
    const nova = marca(item.obs);
    const refinamento = !antiga || !nova || nova.includes(antiga) || antiga.includes(nova);
    if (refinamento) i = m.itens.indexOf(mesmoNome[0]);
  }

  if (i >= 0) {
    // Corrigir NÃO apaga o que já estava: a observação antiga sobrevive quando
    // a nova vem vazia. Senão "muda pra 200" limparia o recheio já combinado.
    // E quando a nova é só um pedaço da antiga (ela reescreve o recheio do bolo
    // pela metade), fica a antiga, que é a completa.
    const antiga = m.itens[i].obs ?? null;
    const nova = item.obs ?? null;
    const obs = !marca(nova) ? antiga : marca(antiga).includes(marca(nova)) ? antiga : nova;
    m.itens[i] = { ...m.itens[i], ...item, obs };
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
