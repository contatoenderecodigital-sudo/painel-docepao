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

export async function anotarItem(
  negocioId: string,
  clienteId: string,
  item: ItemMontagem,
): Promise<Montagem> {
  const m = await lerMontagem(negocioId, clienteId);
  const i = m.itens.findIndex((x) => mesmaLinha(x, item));
  if (i >= 0) {
    // Corrigir NÃO apaga o que já estava: a observação antiga sobrevive quando
    // a nova vem vazia. Senão "muda pra 200" limparia o recheio já combinado.
    m.itens[i] = { ...m.itens[i], ...item, obs: item.obs ?? m.itens[i].obs ?? null };
  } else {
    m.itens.push(item);
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

// Some quando o pedido vira pedido de verdade, ou quando a equipe zera pra
// recomeçar. A conversa continua; só a montagem recomeça do zero.
export async function limparMontagem(negocioId: string, clienteId: string): Promise<void> {
  await query("delete from pedido_montagem where negocio_id = $1 and cliente_id = $2", [negocioId, clienteId]);
}
