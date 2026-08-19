// ============================================================================
//  ORÇAMENTO PARADO: o cliente montou o pedido com a Dora e sumiu.
//
//  A tela de Recuperar prometia desde o começo que "o sistema cobra sozinho".
//  Não cobrava. Nada no código marcava um pedido como 'orcado', nada
//  incrementava a coluna 'cobrancas', e 'cobrado_em' nunca era escrita. Com
//  banco real a tela ficava vazia pra sempre e o card de recuperado no mês
//  ficava em R$ 0,00 pra sempre. Era uma tela bonita em cima de nada.
//
//  O orçamento parado não mora na tabela de pedidos: mora em pedido_montagem,
//  onde a Dora anota item por item enquanto conversa. Cliente que montou e
//  sumiu tem itens ali e nenhuma linha em pedidos. É esse o dinheiro em risco,
//  e é o que esta tela precisa mostrar.
//
//  A cobrança enviada fica guardada como MENSAGEM da conversa, com autor
//  'cobranca'. Não é economia de tabela: é o desenho certo. A dona precisa ver
//  no chat o que foi mandado pro cliente em nome dela, e um histórico que vive
//  na conversa não se perde quando a montagem é reescrita pela próxima
//  mensagem.
// ============================================================================

import { query, queryUm } from "./db";
import { cotarPorItens } from "@/lib/ia/orcamento";
import type { ItemPedido, Pedido } from "@/lib/tipos";

// Dois relógios, de propósito.
//
// A LISTA só mostra depois de DEZ HORAS de silêncio. Uma hora era cedo
// demais: quem parou de responder ao meio-dia pode estar almoçando ou
// trabalhando, e a tela enchia de conversa viva. Tela cheia de ruído é tela
// que a dona para de abrir. Dez horas quer dizer que ele recebeu a resposta e
// passou o resto do dia sem voltar.
//
// A COBRANÇA vem logo atrás por causa de uma janela curta, não por pressa: a
// Meta só aceita texto livre até 24h depois da última mensagem do cliente.
// Passou disso, só template aprovado, que a padaria ainda não tem. Então o
// robô tem de 12h a 24h pra agir, e esperar mais só perde a janela.
export const HORAS_PARA_LISTAR = 10;
export const HORAS_PARA_COBRAR = 12;

export const AUTOR_COBRANCA = "cobranca";

type LinhaParado = {
  cliente_id: string;
  nome: string | null;
  telefone: string;
  itens: unknown;
  dados: Record<string, string> | null;
  atualizado_em: string;
  ultima_mensagem_em: string | null;
  ultima_do_cliente_em: string | null;
  cobrancas: string | null;
  cobrado_em: string | null;
  cliente_viu_em: string | null;
};

type ItemMontado = {
  produto?: string;
  categoria?: string;
  qtd?: number;
  obs?: string | null;
  unidade?: "un" | "kg";
};

// A montagem guarda o que o cliente pediu, não o preço: quem dá preço é o
// cardápio. Passar pelo mesmo motor da conversa garante que o valor mostrado
// aqui é o mesmo que a Dora falou pro cliente, até no arredondamento.
function precificar(itens: ItemMontado[]): { linhas: ItemPedido[]; totalCentavos: number } {
  const pedido = itens
    .filter((i) => i.produto && Number(i.qtd) > 0)
    .map((i) => ({ item: String(i.produto), qtd: Number(i.qtd), obs: i.obs ?? undefined }));
  if (!pedido.length) return { linhas: [], totalCentavos: 0 };

  let cotacao;
  try {
    cotacao = cotarPorItens(pedido);
  } catch {
    // Item fora do cardápio não pode derrubar a tela inteira: melhor mostrar o
    // orçamento sem valor do que esconder o cliente que sumiu.
    return {
      linhas: itens.map((i) => ({
        produto: String(i.produto ?? ""),
        categoria: String(i.categoria ?? ""),
        qtd: Number(i.qtd) || 0,
        unitCentavos: 0,
        subtotalCentavos: 0,
        obs: i.obs ?? null,
        unidade: i.unidade ?? "un",
      })),
      totalCentavos: 0,
    };
  }

  const linhas: ItemPedido[] = cotacao.linhas.map((l, n) => ({
    produto: l.item,
    categoria: l.categoria || String(itens[n]?.categoria ?? ""),
    qtd: l.qtd,
    unitCentavos: Math.round(l.unit * 100),
    subtotalCentavos: Math.round(l.subtotal * 100),
    obs: l.obs ?? itens[n]?.obs ?? null,
    unidade: l.unidade ?? itens[n]?.unidade ?? "un",
  }));
  // O total sai da soma das linhas em centavos, nunca do total em reais: é o
  // mesmo cuidado do pedido fechado, senão a tela diverge do cupom por um
  // centavo de arredondamento.
  return { linhas, totalCentavos: linhas.reduce((s, l) => s + l.subtotalCentavos, 0) };
}

// dd/mm/aaaa da conversa vira ISO pra tela; o que não casar vira nulo em vez
// de virar uma data inventada.
function dataISO(br?: string | null): string | null {
  if (!br) return null;
  const m = br.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const ano = a.length === 2 ? "20" + a : a;
  return `${ano}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function horaLimpa(h?: string | null): string | null {
  if (!h) return null;
  const m = h.trim().match(/^(\d{1,2})(?:[h:](\d{2}))?/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
}

// ---------------------------------------------------------------------------
// A LISTA.
//
// Fica de fora quem: já fechou pedido (tem linha viva em pedidos), não tem
// nenhum item montado, ainda está conversando (parou faz pouco tempo), ou foi
// dispensado pela dona.
// ---------------------------------------------------------------------------
export async function listarParados(negocioId: string, horas = HORAS_PARA_LISTAR): Promise<Pedido[]> {
  const dispensados = await carregarDispensados(negocioId);

  const linhas = await query<LinhaParado>(
    `select m.cliente_id,
            c.nome, c.telefone,
            m.itens, m.dados, m.atualizado_em,
            (select max(x.criado_em) from mensagens x
              where x.negocio_id = m.negocio_id and x.cliente_id = m.cliente_id) as ultima_mensagem_em,
            (select max(x.criado_em) from mensagens x
              where x.negocio_id = m.negocio_id and x.cliente_id = m.cliente_id
                and x.papel = 'user') as ultima_do_cliente_em,
            (select count(*) from mensagens x
              where x.negocio_id = m.negocio_id and x.cliente_id = m.cliente_id
                and x.autor = $3) as cobrancas,
            (select max(x.criado_em) from mensagens x
              where x.negocio_id = m.negocio_id and x.cliente_id = m.cliente_id
                and x.autor = $3) as cobrado_em,
            -- Só existe 'o cliente viu a cobrança' se cobrança existir. Com o
            -- começo dos tempos como referência, qualquer cliente que já tinha
            -- falado alguma vez virava 'visualizou', e a tela mostrava dez
            -- clientes avisados sem uma única mensagem ter saído.
            (select max(x.criado_em) from mensagens x
              where x.negocio_id = m.negocio_id and x.cliente_id = m.cliente_id
                and x.papel = 'user'
                and x.criado_em > (select max(y.criado_em) from mensagens y
                     where y.negocio_id = m.negocio_id and y.cliente_id = m.cliente_id
                       and y.autor = $3)) as cliente_viu_em
       from pedido_montagem m
       join clientes c on c.id = m.cliente_id
      where m.negocio_id = $1
        and jsonb_array_length(coalesce(m.itens, '[]'::jsonb)) > 0
        -- Fechou pedido: saiu do risco, não é orçamento parado.
        and not exists (
          select 1 from pedidos p
           where p.negocio_id = m.negocio_id
             and p.cliente_id = m.cliente_id
             and p.status in ('confirmado', 'aprovado', 'impresso')
        )
        -- Ainda está conversando: cobrar agora é atropelar o cliente.
        and m.atualizado_em < now() - ($2 || ' hours')::interval
        -- A BOLA TEM QUE ESTAR COM O CLIENTE.
        --
        -- A última palavra foi nossa e ele não respondeu: aí sim é orçamento
        -- parado. Se a última foi dele, quem deve uma resposta é a padaria, e
        -- esse caso é da fila de 'precisa de você', não de cobrança. Mandar
        -- 'seu orçamento ainda está de pé' pra quem fez uma pergunta sem
        -- resposta é o pior que esta tela pode fazer.
        and coalesce((
          select x.papel from mensagens x
           where x.negocio_id = m.negocio_id and x.cliente_id = m.cliente_id
           order by x.criado_em desc limit 1
        ), 'user') <> 'user'
        -- Equipe assumiu a conversa: quem fala com ele agora é gente, e
        -- cobrança automática por cima disso atropela quem está atendendo.
        and coalesce(c.ia_pausada, false) = false
      order by m.atualizado_em asc`,
    [negocioId, String(horas), AUTOR_COBRANCA],
  );

  return linhas
    .filter((l) => !dispensados.includes(l.cliente_id))
    .map((l) => {
      const brutos: ItemMontado[] = Array.isArray(l.itens) ? (l.itens as ItemMontado[]) : [];
      const { linhas: itens, totalCentavos } = precificar(brutos);
      const d = l.dados ?? {};
      return {
        id: l.cliente_id,
        clienteNome: d.cliente_nome || l.nome || "Cliente",
        clienteTelefone: l.telefone,
        status: "orcado" as const,
        retiradaData: dataISO(d.retirada_data),
        retiradaHora: horaLimpa(d.retirada_hora),
        pessoas: d.pessoas ? Number(d.pessoas) || null : null,
        totalCentavos,
        observacoes: null,
        itens,
        // O que importa pra urgência é desde quando ele está parado, não desde
        // quando a conversa começou.
        criadoEm: l.atualizado_em,
        formaPagamento: (d.forma_pagamento as Pedido["formaPagamento"]) ?? null,
        cobrancaEm: l.cobrado_em,
        clienteViuEm: l.cliente_viu_em,
      } satisfies Pedido;
    });
}

// ---------------------------------------------------------------------------
// DISPENSAR: some da lista e nunca mais é cobrado.
//
// Mora na configuração do negócio porque é decisão da dona sobre uma conversa,
// não um fato da conversa. É uma lista curta por natureza: quando o cliente
// volta e fecha, ele sai da lista de parados sozinho.
// ---------------------------------------------------------------------------
export async function carregarDispensados(negocioId: string): Promise<string[]> {
  const l = await queryUm<{ lista: string[] | null }>(
    `select coalesce(config->'orcamentos_dispensados', '[]'::jsonb) as lista
       from negocios where id = $1`,
    [negocioId],
  );
  return Array.isArray(l?.lista) ? l.lista : [];
}

export async function dispensarOrcamento(negocioId: string, clienteId: string): Promise<void> {
  await query(
    `update negocios
        set config = coalesce(config, '{}'::jsonb)
          || jsonb_build_object('orcamentos_dispensados',
               (coalesce(config->'orcamentos_dispensados', '[]'::jsonb) - $2::text) || to_jsonb($2::text))
      where id = $1`,
    [negocioId, clienteId],
  );
}

export async function reativarOrcamento(negocioId: string, clienteId: string): Promise<void> {
  await query(
    `update negocios
        set config = coalesce(config, '{}'::jsonb)
          || jsonb_build_object('orcamentos_dispensados',
               coalesce(config->'orcamentos_dispensados', '[]'::jsonb) - $2::text)
      where id = $1`,
    [negocioId, clienteId],
  );
}

// ---------------------------------------------------------------------------
// QUANTAS COBRANÇAS ESTE CLIENTE JÁ RECEBEU.
//
// Serve pra duas coisas: não cobrar a mesma pessoa sem parar, e carimbar o
// pedido quando ele finalmente fechar, que é o que faz o card de "recuperado
// no mês" existir.
// ---------------------------------------------------------------------------
export async function cobrancasDoCliente(negocioId: string, clienteId: string): Promise<number> {
  const l = await queryUm<{ n: string }>(
    `select count(*) as n from mensagens
      where negocio_id = $1 and cliente_id = $2 and autor = $3`,
    [negocioId, clienteId, AUTOR_COBRANCA],
  );
  return Number(l?.n) || 0;
}
