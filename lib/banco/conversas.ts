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

const LIMITE_HISTORICO = 40; // ultimas N mensagens que a IA enxerga. 20 truncava conversa
                              // de pedido de festa e ela reperguntava o que ja tinha sido dito.

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

// Grava um turno da conversa. Retorna o id da mensagem.
//
// `papel` continua sendo o que a IA enxerga no histórico ('user'/'assistant').
// `extra.autor` distingue quem falou na TELA ('cliente'|'ia'|'equipe'): a
// mensagem que a DONA digita entra papel='assistant' + autor='equipe'. Mídia
// recebida entra com tipo/mime/dados (base64) pra aparecer no chat.
export type ExtraMensagem = {
  autor?: "cliente" | "ia" | "equipe";
  tipo?: "texto" | "imagem" | "audio" | "documento";
  mime?: string | null;
  dados?: string | null; // base64, sem prefixo data:
  nome?: string | null; // nome do arquivo (documento)
  wamid?: string | null;
  lida?: boolean;
};
export async function salvarMensagem(
  negocioId: string,
  clienteId: string,
  papel: "user" | "assistant",
  conteudo: string,
  extra?: ExtraMensagem,
): Promise<string> {
  const autor = extra?.autor ?? (papel === "user" ? "cliente" : "ia");
  const linha = await queryUm<{ id: string }>(
    `insert into mensagens
       (negocio_id, cliente_id, papel, conteudo, autor, tipo, midia_mime, midia_dados, midia_nome, wamid, lida)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id`,
    [
      negocioId,
      clienteId,
      papel,
      conteudo,
      autor,
      extra?.tipo ?? "texto",
      extra?.mime ?? null,
      extra?.dados ?? null,
      extra?.nome ?? null,
      extra?.wamid ?? null,
      // não-lida só faz sentido pra mensagem do cliente; o resto já entra lido.
      extra?.lida ?? autor !== "cliente",
    ],
  );
  return linha?.id ?? "";
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

  // O nome do cliente vinha do perfil do WhatsApp — que a pessoa escolhe e
  // costuma ter apelido, emoji ou só o primeiro nome. Quando ela DIZ o nome
  // para o pedido, esse é o que vale: é o que a equipe vai chamar no balcão.
  const nomeDito = (pedido.clienteNome || "").trim();
  if (nomeDito.length >= 2) {
    try {
      await query("update clientes set nome = $1 where id = $2", [nomeDito, clienteId]);
    } catch (e) {
      console.error("[pedido] nao consegui atualizar o nome do cliente:", e);
    }
  }

  // Um pedido POR CONVERSA, não por chamada da ferramenta.
  //
  // A IA chama registrar_pedido toda vez que o cliente acrescenta ou corrige
  // algo. Inserindo a cada chamada, uma conversa só virava três pedidos na fila
  // da dona — e cada um com um pedaço dos itens. Aqui, se já existe um pedido
  // desta conversa ainda esperando aprovação, ele é ATUALIZADO: os itens são
  // trocados pela lista completa que a IA mandou agora.
  //
  // O corte é por status: assim que a equipe aprova, o pedido sai do caminho e
  // um novo pedido do mesmo cliente nasce separado, como tem que ser.
  const aberto = await queryUm<{ id: string }>(
    `select id from pedidos
       where negocio_id = $1 and cliente_id = $2 and status = 'confirmado'
       order by criado_em desc limit 1`,
    [negocioId, clienteId],
  );

  // Cabeçalho + itens numa TRANSAÇÃO: ou grava tudo, ou nada. Sem pedido pela metade.
  return transacao(async (q) => {
    let pedidoId: string | undefined;
    if (aberto?.id) {
      await q(
        `update pedidos set retirada_data = $2, retirada_hora = $3, total_centavos = $4,
                observacoes = $5, precisa_confirmacao = $6, motivo_humano = $7,
                forma_pagamento = coalesce($8, forma_pagamento), confirmado_em = now()
           where id = $1`,
        [
          aberto.id,
          parseDataRetirada(pedido.retiradaData),
          pedido.retiradaHora ?? null,
          totalCentavos,
          pedido.observacoes ?? null,
          pedido.precisaConfirmacao ?? false,
          pedido.precisaConfirmacao ? pedido.motivoHumano ?? null : null,
          pedido.formaPagamento ?? null,
        ],
      );
      // itens são substituídos pela lista completa (a IA sempre reenvia tudo)
      await q("delete from pedido_itens where pedido_id = $1", [aberto.id]);
      pedidoId = aberto.id;
    } else {
      const ped = await q<{ id: string }>(
        `insert into pedidos
           (negocio_id, cliente_id, status, retirada_data, retirada_hora, total_centavos, observacoes, precisa_confirmacao, motivo_humano, forma_pagamento, confirmado_em)
         values ($1, $2, 'confirmado', $3, $4, $5, $6, $7, $8, $9, now())
         returning id`,
        [
          negocioId,
          clienteId,
          parseDataRetirada(pedido.retiradaData),
          pedido.retiradaHora ?? null,
          totalCentavos,
          pedido.observacoes ?? null,
          pedido.precisaConfirmacao ?? false,
          pedido.precisaConfirmacao ? pedido.motivoHumano ?? null : null,
          pedido.formaPagamento ?? null,
        ],
      );
      pedidoId = ped[0]?.id;
    }
    if (!pedidoId) throw new Error("Falha ao registrar pedido");

    for (const it of itens) {
      await q(
        `insert into pedido_itens (pedido_id, produto, categoria, qtd, unit_centavos, subtotal_centavos, obs, unidade)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [pedidoId, it.produto, it.categoria, it.qtd, it.unitCentavos, it.subtotalCentavos, it.obs, it.unidade],
      );
    }

    // Foto(s) de referência que o cliente mandou ANTES do pedido fechar ficam
    // "pendentes" (pedido_id null) presas ao cliente. Ao registrar, ligamos ao
    // pedido — assim a foto do bolo aparece no card da aprovação e na produção.
    await q(
      `update pedido_fotos set pedido_id = $1
         where negocio_id = $2 and cliente_id = $3 and pedido_id is null`,
      [pedidoId, negocioId, clienteId],
    );
    return pedidoId;
  });
}

// ----------------------------------------------------------------------------
//  FOTOS DE REFERÊNCIA DO PEDIDO (Postgres). A imagem é guardada em base64 no
//  banco (não no filesystem: o container é efêmero e some entre deploys). Uma
//  foto entra "pendente" quando o cliente manda antes do pedido fechar, e é
//  ligada ao pedido no registrarPedido; ou já entra ligada (fluxo do /testar).
// ----------------------------------------------------------------------------

// Foto que chegou na conversa antes do pedido existir: fica pendente pro cliente.
export async function salvarFotoPendente(
  negocioId: string,
  clienteId: string,
  dadosBase64: string,
  mime: string,
): Promise<void> {
  await query(
    `insert into pedido_fotos (negocio_id, cliente_id, pedido_id, dados, mime)
     values ($1, $2, null, $3, $4)`,
    [negocioId, clienteId, dadosBase64, mime || "image/jpeg"],
  );
}

// Foto já ligada a um pedido específico (ex: teste no /testar, que registra o
// pedido e anexa a imagem na mesma requisição).
export async function anexarFotoAoPedido(
  negocioId: string,
  pedidoId: string,
  clienteId: string | null,
  dadosBase64: string,
  mime: string,
): Promise<void> {
  await query(
    `insert into pedido_fotos (negocio_id, cliente_id, pedido_id, dados, mime)
     values ($1, $2, $3, $4, $5)`,
    [negocioId, clienteId, pedidoId, dadosBase64, mime || "image/jpeg"],
  );
}

// A imagem de um pedido pra rota que serve a foto (escopada por negócio).
// Pega a mais recente caso haja mais de uma.
export async function buscarFotoPedido(
  negocioId: string,
  pedidoId: string,
): Promise<{ dados: string; mime: string } | null> {
  const linha = await queryUm<{ dados: string; mime: string }>(
    `select dados, mime from pedido_fotos
       where negocio_id = $1 and pedido_id = $2
       order by criado_em desc limit 1`,
    [negocioId, pedidoId],
  );
  return linha;
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
