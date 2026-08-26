// ============================================================================
//  PERSISTÊNCIA DA CONVERSA — a memória do atendimento (Postgres puro).
//  O webhook é stateless: a cada mensagem, carrega o histórico do cliente,
//  a IA responde, salva o novo turno. Pedido confirmado vira linha em `pedidos`
//  (status 'confirmado') e cai na fila de aprovação do painel.
//
//  Isolamento multi-tenant: TODA query filtra por negocio_id.
// ============================================================================

import { query, queryUm, transacao } from "./db";
import type { Mensagem, PedidoParaGravar } from "./tipos-da-conversa";
export type { Mensagem } from "./tipos-da-conversa";

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
  // Pedido fechado esperando o cliente aceitar o valor que a equipe ajustou:
  // aí a conversa anterior AINDA está viva e o corte não vale.
  pedidoEmAberto = false,
): Promise<Mensagem[]> {
  const linhas = await query<{ papel: "user" | "assistant"; conteudo: string }>(
    `select papel, conteudo from mensagens
       where negocio_id = $1 and cliente_id = $2
       order by criado_em desc limit $3`,
    [negocioId, clienteId, LIMITE_HISTORICO],
  );
  const msgs = linhas.reverse().map((m) => ({ role: m.papel, content: m.conteudo }));
  return pedidoEmAberto ? msgs : cortarNoPedidoFechado(msgs);
}

// PEDIDO FECHADO VIRA RESUMO, NÃO CONTINUA SENDO CONVERSA.
//
// O cliente que já encomendou volta pra encomendar de novo, e a IA lia tudo
// como se fosse um pedido só: ele pediu comida pra festa de 20 pessoas e
// recebeu de volta os 500 salgados, o bolo do Batman e a forminha verde da
// encomenda anterior. Mesmo avisada de que aquilo estava fechado, ela anotava
// os itens velhos no pedido novo, porque o vaivém inteiro ainda estava ali.
//
// Aqui o que sobra do pedido fechado é a mensagem de fechamento, que já é o
// resumo dele. Ela continua podendo responder "o que eu pedi mesmo?" e repetir
// a encomenda se ele quiser a mesma coisa; o que sumiu é o rastro que fazia
// item velho reaparecer sozinho.
const MARCA_FECHADO = /^\*Pedido recebido\*/m;

// O resumo do último pedido fechado deste cliente, pra IA ter na mão quando ele
// perguntar o que pediu ou quiser a mesma coisa. Perguntado "o pedido que eu
// fechei era o quê?", ela respondia com o pedido que está sendo montado agora e
// ainda chamava ele de fechado: o resumo estava lá no alto do histórico, longe
// demais de onde ela decide o que responder.
export async function resumoPedidoFechado(
  negocioId: string,
  clienteId: string,
): Promise<string | null> {
  const l = await queryUm<{ conteudo: string }>(
    `select conteudo from mensagens
      where negocio_id = $1 and cliente_id = $2 and papel = 'assistant'
        and conteudo like '*Pedido recebido*%'
      order by criado_em desc limit 1`,
    [negocioId, clienteId],
  );
  return l?.conteudo ?? null;
}

function cortarNoPedidoFechado(msgs: Mensagem[]): Mensagem[] {
  let ultimo = -1;
  msgs.forEach((m, i) => {
    if (m.role === "assistant" && MARCA_FECHADO.test(m.content)) ultimo = i;
  });
  // Sem pedido fechado, ou fechado agora mesmo (o cliente ainda nem respondeu):
  // a conversa segue inteira.
  if (ultimo < 0 || ultimo === msgs.length - 1) return msgs;

  const aviso: Mensagem = {
    role: "user",
    content:
      "[ AVISO DO SISTEMA, nao e o cliente falando ] O pedido acima JA FOI FECHADO e esta com a equipe, e por isso a " +
      "conversa que o montou nao aparece mais aqui. Daqui pra baixo e uma encomenda NOVA, do zero: nao anote nada daquele " +
      "pedido por conta propria. Aquele resumo ali em cima serve pra duas coisas, so: responder se ele PERGUNTAR o que " +
      "pediu, e repetir os itens se ele PEDIR a mesma coisa de novo. Se ele quiser mexer no pedido que ja foi, chame a " +
      "equipe, porque a cozinha pode ja ter comecado.",
  };
  return [msgs[ultimo], aviso, ...msgs.slice(ultimo + 1)];
}

// Grava um turno da conversa. Retorna o id da mensagem.
//
// `papel` continua sendo o que a IA enxerga no histórico ('user'/'assistant').
// `extra.autor` distingue quem falou na TELA ('cliente'|'ia'|'equipe'): a
// mensagem que a DONA digita entra papel='assistant' + autor='equipe'. Mídia
// recebida entra com tipo/mime/dados (base64) pra aparecer no chat.
export type ExtraMensagem = {
  autor?: "cliente" | "ia" | "equipe" | "cobranca";
  tipo?: "texto" | "imagem" | "audio" | "documento" | "video";
  mime?: string | null;
  dados?: string | null; // base64, sem prefixo data:
  url?: string | null; // imagem ja publicada (cardapio): guarda o link, nao o base64
  nome?: string | null; // nome do arquivo (documento)
  wamid?: string | null;
  lida?: boolean;
};
// O que aconteceu com a mensagem depois de enviada: entregue, lida ou falhou.
// Sem isso a equipe nao tem como saber que o resumo do pedido nao chegou.
export async function marcarStatusMensagem(
  wamid: string,
  status: "delivered" | "read" | "failed",
  erro?: string | null,
): Promise<void> {
  if (status === "delivered") {
    await query("update mensagens set entregue_em = coalesce(entregue_em, now()) where wamid = $1", [wamid]);
    return;
  }
  if (status === "read") {
    await query(
      "update mensagens set lida_em = coalesce(lida_em, now()), entregue_em = coalesce(entregue_em, now()) where wamid = $1",
      [wamid],
    );
    return;
  }
  await query("update mensagens set falha = $2 where wamid = $1", [wamid, erro ?? "falha no envio"]);
}

// De qual anuncio o cliente veio. So grava na primeira vez: a Meta manda o
// referral na mensagem que abriu a conversa, e depois nunca mais.
export async function guardarOrigemAnuncio(
  negocioId: string,
  clienteId: string,
  origem: Record<string, unknown>,
): Promise<void> {
  await query(
    "update clientes set origem_anuncio = coalesce(origem_anuncio, $3::jsonb) where negocio_id = $1 and id = $2",
    [negocioId, clienteId, JSON.stringify(origem)],
  );
}

// A mensagem que o cliente marcou pra responder, pelo id do WhatsApp.
export async function mensagemPorWamid(
  negocioId: string,
  clienteId: string,
  wamid: string,
): Promise<{ conteudo: string; papel: string } | null> {
  const l = await queryUm<{ conteudo: string; papel: string }>(
    `select conteudo, papel from mensagens
      where negocio_id = $1 and cliente_id = $2 and wamid = $3
      limit 1`,
    [negocioId, clienteId, wamid],
  );
  return l ?? null;
}

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
       (negocio_id, cliente_id, papel, conteudo, autor, tipo, midia_mime, midia_dados, midia_nome, midia_url, wamid, lida)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      extra?.url ?? null,
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
// A hora chega da conversa como o cliente falou: 16h, 16, 16:00, as 16h30.
// No banco tem que ser um formato so, senao o cupom, o painel e a tela do dia
// mostram a mesma hora de tres jeitos. Tem pedido gravado como '16h'.
function horaPadrao(h?: string | null): string | null {
  if (!h) return null;
  const m = String(h).trim().match(/^(\d{1,2})(?:[h:.](\d{1,2}))?/);
  if (!m) return null;
  const hora = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (hora > 23 || min > 59) return null;
  return String(hora).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

export async function registrarPedido(
  negocioId: string,
  clienteId: string,
  pedido: PedidoParaGravar,
): Promise<string> {
  // NUNCA gravar pedido sem item. Como um pedido por conversa é ATUALIZADO, uma
  // chamada vazia apagava as linhas do pedido real e zerava o total: o cliente
  // via a encomenda dele virar R$ 0,00 e a fila mostrava um pedido fantasma.
  // Aconteceu quando ele respondeu "Ok" pra aceitar o orçamento.
  if (!pedido.linhas || pedido.linhas.length === 0) {
    throw new Error("registrarPedido: lista de itens vazia, nao gravo (protege o pedido existente)");
  }
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
  // SEM DATA DE RETIRADA O PEDIDO NAO ENTRA NA FILA.
  //
  // A cozinha produz por dia. Um pedido com hora e sem data e um pedido que
  // ninguem sabe pra quando fazer, e na tela ele aparecia como um tracinho
  // discreto do lado de uma hora que parecia certa. Para na mesa da equipe,
  // com o motivo escrito, ate alguem perguntar pro cliente.
  const semData = !pedido.retiradaData;
  const precisaConfirmacao = (pedido.precisaConfirmacao ?? false) || semData;
  const motivoHumano = semData
    ? [pedido.motivoHumano, "O cliente não disse o dia da retirada."].filter(Boolean).join(" ")
    : pedido.motivoHumano ?? null;

  const aberto = await queryUm<{ id: string; equipe_ajustou: boolean }>(
    `select id, coalesce(equipe_ajustou, false) as equipe_ajustou from pedidos
       where negocio_id = $1 and cliente_id = $2 and status = 'confirmado'
       order by criado_em desc limit 1`,
    [negocioId, clienteId],
  );

  // A equipe já lançou valor neste pedido (o topo de bolo, por exemplo). A IA
  // registrando de novo apagaria esse item e reabriria a pendência, que foi
  // exatamente o que aconteceu num teste: o topo de R$ 33 sumiu e o pedido
  // voltou pra Aguardando depois de o cliente já ter aceitado. O trabalho da
  // equipe vale mais que a última tentativa do modelo.
  if (aberto?.equipe_ajustou) {
    throw new Error("registrarPedido: a equipe ja ajustou este pedido, nao sobrescrevo");
  }

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
          horaPadrao(pedido.retiradaHora),
          totalCentavos,
          pedido.observacoes ?? null,
          precisaConfirmacao,
          precisaConfirmacao ? motivoHumano : null,
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
          horaPadrao(pedido.retiradaHora),
          totalCentavos,
          pedido.observacoes ?? null,
          precisaConfirmacao,
          precisaConfirmacao ? motivoHumano : null,
          pedido.formaPagamento ?? null,
        ],
      );
      pedidoId = ped[0]?.id;
    }
    if (!pedidoId) throw new Error("Falha ao registrar pedido");

    // Fechou depois de cobranca: carimba quantas foram. E esse numero que
    // faz o card de recuperado no mes existir; sem ele a agregacao procurava
    // cobrancas > 0 numa coluna que nada no sistema escrevia.
    await q(
      `update pedidos set cobrancas = (
         select count(*) from mensagens x
          where x.negocio_id = $2 and x.cliente_id = $3 and x.autor = 'cobranca'
       ), cobrado_em = (
         select max(x.criado_em) from mensagens x
          where x.negocio_id = $2 and x.cliente_id = $3 and x.autor = 'cobranca'
       ) where id = $1`,
      [pedidoId, negocioId, clienteId],
    );

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
/**
 * AS FOTOS QUE O CLIENTE MANDOU PASSAM A SER DO PEDIDO.
 *
 * Toda imagem que chega no WhatsApp ja era salva, mas ficava com o pedido em
 * branco. Quando o pedido fechava, ninguem fazia essa ligacao: a foto aparecia
 * na tela do pedido em montagem e sumia das abas de aprovacao e de pedidos,
 * justamente onde a equipe confere o bolo antes de produzir.
 *
 * Gruda TODAS as pendentes, nao so a ultima: o cliente manda duas ou tres fotos
 * de referencia e todas valem pra quem vai fazer a peca.
 */
/**
 * O QUE O CLIENTE FALOU E AINDA NAO FOI RESPONDIDO.
 *
 * Tudo que ele escreveu depois da ultima resposta da padaria, na ordem. Serve
 * pra Dora responder as mensagens JUNTAS em vez de uma por uma.
 *
 * Ninguem escreve no WhatsApp em paragrafo unico: manda "Bom dia!", manda "Tudo
 * bem?", manda o pedido. Respondendo uma por uma ela responde tres vezes, e as
 * duas primeiras respostas nao dizem nada porque o pedido ainda nao tinha
 * chegado.
 */
export async function falasSemResposta(negocioId: string, clienteId: string): Promise<string[]> {
  const linhas = await query<{ conteudo: string }>(
    `select conteudo from mensagens
      where negocio_id = $1 and cliente_id = $2
        and coalesce(autor, case when papel = 'user' then 'cliente' else 'ia' end) = 'cliente'
        and criado_em > coalesce(
          (select max(criado_em) from mensagens
            where negocio_id = $1 and cliente_id = $2 and papel = 'assistant'),
          to_timestamp(0))
      order by criado_em asc
      limit 10`,
    [negocioId, clienteId],
  );
  return linhas.map((l) => String(l.conteudo || "").trim()).filter(Boolean);
}

export async function grudarFotosNoPedido(
  negocioId: string,
  clienteId: string,
  pedidoId: string,
): Promise<number> {
  const r = await query<{ id: string }>(
    `update pedido_fotos set pedido_id = $3
      where negocio_id = $1 and cliente_id = $2 and pedido_id is null
      returning id`,
    [negocioId, clienteId, pedidoId],
  );
  return r.length;
}

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
