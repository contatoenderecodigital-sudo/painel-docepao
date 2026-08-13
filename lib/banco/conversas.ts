// ============================================================================
//  PERSISTÊNCIA DA CONVERSA — a memória do atendimento (Postgres puro).
//  O webhook é stateless: a cada mensagem, carrega o histórico do cliente,
//  a IA responde, salva o novo turno. Pedido confirmado vira linha em `pedidos`
//  (status 'confirmado') e cai na fila de aprovação do painel.
//
//  Isolamento multi-tenant: TODA query filtra por negocio_id.
// ============================================================================

import { query, queryUm, transacao } from "./db";
import type { Mensagem, RespostaIA } from "../ia/cerebro";

const LIMITE_HISTORICO = 20; // últimas N mensagens que a IA enxerga

// Acha o cliente pelo telefone; cria se for a primeira vez.
// Upsert ATÔMICO: duas mensagens quase simultâneas de um cliente novo não criam
// dois cadastros (nem quebram no unique). Depende do índice único
// (negocio_id, telefone) em clientes. O "do update" garante o returning do id.
export async function acharOuCriarCliente(
  negocioId: string,
  telefone: string,
  nome?: string,
): Promise<string> {
  const linha = await queryUm<{ id: string }>(
    `insert into clientes (negocio_id, telefone, nome)
       values ($1, $2, $3)
     on conflict (negocio_id, telefone)
       do update set nome = coalesce(clientes.nome, excluded.nome)
     returning id`,
    [negocioId, telefone, nome ?? null],
  );
  if (!linha) throw new Error("Falha ao achar ou criar cliente");
  return linha.id;
}

// Últimas mensagens do cliente, no formato que a IA espera (ordem cronológica).
export async function carregarHistorico(
  negocioId: string,
  clienteId: string,
): Promise<Mensagem[]> {
  const linhas = await query<{ papel: "user" | "assistant"; conteudo: string }>(
    `select papel, conteudo from mensagens
       where negocio_id = $1 and cliente_id = $2
       order by criado_em desc limit $3`,
    [negocioId, clienteId, LIMITE_HISTORICO],
  );
  return linhas.reverse().map((m) => ({ role: m.papel, content: m.conteudo }));
}

// Grava um turno da conversa.
export async function salvarMensagem(
  negocioId: string,
  clienteId: string,
  papel: "user" | "assistant",
  conteudo: string,
): Promise<void> {
  await query(
    "insert into mensagens (negocio_id, cliente_id, papel, conteudo) values ($1, $2, $3, $4)",
    [negocioId, clienteId, papel, conteudo],
  );
}

// Idempotência: registra o wamid; retorna false se já tinha sido processado.
export async function marcarWebhookNovo(wamid: string): Promise<boolean> {
  const linhas = await query<{ wamid: string }>(
    "insert into webhook_recebidos (wamid) values ($1) on conflict (wamid) do nothing returning wamid",
    [wamid],
  );
  return linhas.length > 0; // 0 = já existia (mensagem repetida do Meta)
}

// Registra o pedido que a IA fechou: cabeçalho em `pedidos` + itens.
// Entra como 'confirmado' → aparece na fila de APROVAÇÃO da equipe no painel.
export async function registrarPedido(
  negocioId: string,
  clienteId: string,
  pedido: NonNullable<RespostaIA["pedidoRegistrado"]>,
): Promise<string> {
  // Usa as linhas já calculadas pelo motor do tenant (não recalcula com cardápio errado).
  // Converte cada linha pra centavos ANTES, e deriva o total da SOMA dos subtotais
  // em centavos (inteiros), pra o total nunca divergir das linhas por arredondamento.
  const itens = pedido.linhas.map((l) => ({
    produto: l.item,
    categoria: l.categoria,
    qtd: l.qtd,
    unitCentavos: Math.round(l.unit * 100),
    subtotalCentavos: Math.round(l.subtotal * 100),
    obs: l.obs ?? null,
    unidade: l.unidade ?? "un",
  }));
  const totalCentavos = itens.length
    ? itens.reduce((s, i) => s + i.subtotalCentavos, 0)
    : pedido.totalCentavos;

  // Cabeçalho + itens numa TRANSAÇÃO: ou grava tudo, ou nada. Sem pedido pela metade.
  return transacao(async (q) => {
    const ped = await q<{ id: string }>(
      `insert into pedidos
         (negocio_id, cliente_id, status, retirada_data, retirada_hora, total_centavos, observacoes, confirmado_em)
       values ($1, $2, 'confirmado', $3, $4, $5, $6, now())
       returning id`,
      [
        negocioId,
        clienteId,
        parseDataRetirada(pedido.retiradaData),
        pedido.retiradaHora ?? null,
        totalCentavos,
        pedido.observacoes ?? null,
      ],
    );
    const pedidoId = ped[0]?.id;
    if (!pedidoId) throw new Error("Falha ao registrar pedido");

    for (const it of itens) {
      await q(
        `insert into pedido_itens (pedido_id, produto, categoria, qtd, unit_centavos, subtotal_centavos, obs, unidade)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [pedidoId, it.produto, it.categoria, it.qtd, it.unitCentavos, it.subtotalCentavos, it.obs, it.unidade],
      );
    }
    return pedidoId;
  });
}

// A IA guarda a data como texto livre ("sábado 25/07"). Tenta virar YYYY-MM-DD;
// se não der (ou a data não existir no calendário), deixa null e a equipe
// confirma o dia na aprovação, em vez de quebrar o registro do pedido.
function parseDataRetirada(texto: string): string | null {
  const m = texto.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
  // Valida o calendário de verdade: 31/04, 30/02, 29/02 em ano não bissexto, etc.
  // Monta em UTC pra não sofrer com fuso e confere se os componentes bateram
  // (se der overflow, ex: 31/04 vira 01/05, os campos não batem e cai fora).
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null; // data impossível: equipe confirma na aprovação
  }
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}
