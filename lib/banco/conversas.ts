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
import { unidadeDoItem, horaDaRetirada } from "../tipos";
import { dataDeRetirada } from "../ia/fluxo/falas-do-cliente";
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

// A PADARIA JA FALOU COM ESTE CLIENTE NESTA CONVERSA?
//
// E a unica coisa que o cerebro pergunta sobre o passado da conversa: se ja
// falou, nao cumprimenta de novo.
//
// Aqui existia `carregarHistorico`, que trazia as 40 ultimas mensagens INTEIRAS
// pra responder esse sim ou nao. Ele era do tempo do cerebro antigo, que mandava
// o historico pro modelo; o novo manda UMA mensagem so. Sobrou o custo.
//
// E ele tinha um terceiro parametro, `pedidoEmAberto`, que a propria funcao
// jogava fora com um `void` -- mas o webhook, pra preencher esse parametro,
// consultava `temPedidoAguardandoCliente` em TODA mensagem. Uma consulta ao
// banco existindo so pra alimentar um argumento descartado, e ainda repetida
// logo em seguida dentro do `atender`.
//
// Parametro que nao faz nada e pior que codigo morto: quem le a assinatura
// acredita nele.
//
// A JANELA CONTINUA SENDO A MESMA: AS ULTIMAS `LIMITE_HISTORICO` MENSAGENS.
//
// A pergunta e a mesma de antes, feita direto no banco em vez de trazer o texto
// de 40 mensagens pro Node so pra rodar um `.some()`. A janela e igual de
// proposito: trocar por "nas ultimas N horas" seria eu escolhendo um numero que
// ninguem me deu, e o comportamento na tela do cliente mudaria sem medida
// nenhuma pra sustentar.
//
// Fica anotado como pergunta pra dona, nao como decisao minha: hoje, se a
// conversa passar de 40 mensagens, a padaria cumprimenta de novo no meio dela.
export async function padariaJaFalouNaConversa(
  negocioId: string,
  clienteId: string,
): Promise<boolean> {
  const linha = await queryUm<{ existe: boolean }>(
    `select 1 as existe from (
       select papel from mensagens
        where negocio_id = $1 and cliente_id = $2
        order by criado_em desc limit $3
     ) ultimas where papel = 'assistant' limit 1`,
    [negocioId, clienteId, LIMITE_HISTORICO],
  );
  return !!linha;
}

// AQUI FICAVAM O CORTE DO PEDIDO FECHADO E O RESUMO DELE, E OS DOIS ERAM DO
// CEREBRO ANTIGO.
//
// O QUE ELES FAZIAM
//
// `cortarNoPedidoFechado` procurava no historico uma mensagem comecando com
// "*Pedido recebido*" e cortava tudo o que viesse antes, pra a IA nao anotar num
// pedido novo os itens do pedido velho. `resumoPedidoFechado` buscava a mesma
// marca no banco pra dar o resumo de contexto.
//
// POR QUE ELES NAO PODIAM FUNCIONAR
//
// Nenhuma mensagem do sistema comeca com "*Pedido recebido*" desde que o cerebro
// antigo foi apagado, em 26/08/2026. A fala de fechamento hoje e "Pronto, seu
// pedido foi pra fila da equipe da padaria" -- e ela passa pela REESCRITA da IA
// (`podeReescrever: true`), entao o texto que chega no cliente muda a cada
// conversa. Marca fixa nenhuma casa com texto que o modelo reescreve.
//
// O corte era um `if` que nunca era verdadeiro, e o resumo uma consulta que
// nunca achava nada. Achados lendo o arquivo em 28/08/2026.
//
// E POR QUE O DEFEITO QUE ELES IMPEDIAM NAO VOLTA
//
// Aquele defeito -- item do pedido velho reaparecendo no novo -- existia porque
// o cerebro antigo recebia A CONVERSA INTEIRA e decidia tudo em cima dela. O
// fluxo novo manda pro modelo UMA mensagem: `pensar({ instrucao, mensagem })`.
// Ele nao ve historico, entao nao ha o que reaproveitar por engano.
//
// O historico deixou de ser carregado por inteiro na mesma leitura: as duas
// coisas que ainda dependiam dele nao precisam do texto de 40 mensagens. Saber
// se a padaria ja cumprimentou virou `padariaJaFalouNaConversa`, aqui em cima, e
// achar a mensagem citada e o `mensagemPorWamid`, que busca UMA linha pelo id.
//
// O `resumoPedidoFechado` tambem ja estava na lista de orfaos do
// `nada-de-codigo-fantasma`, e escondido: a unica "segunda aparicao" dele era
// uma MENCAO num comentario que eu mesmo escrevi contando que a chamada tinha
// sido removida. O comentario que narra a morte de uma funcao a mantinha viva
// aos olhos do detector, e isso virou conserto la.

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
//
// A hora chega da conversa como o cliente falou: 16h, 16, 16:00, as 16h30. No
// banco tem que ser um formato so, senao o cupom, o painel e a tela do dia
// mostram a mesma hora de tres jeitos -- e tem pedido gravado como '16h'. Quem
// arruma e o `horaDaRetirada`, em lib/tipos.ts, que e o mesmo pra todo mundo.
//
// Aqui existia um `horaPadrao` proprio, ANCORADO no comeco da string, e o
// comentario dele prometia entender "as 16h30". Nao entendia: a string comeca
// com "a", a regex exigia digito, e o pedido era gravado SEM HORA.

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
    unidade: unidadeDoItem(l.unidade),
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
          horaDaRetirada(pedido.retiradaHora),
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
          horaDaRetirada(pedido.retiradaHora),
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

// A DATA DA RETIRADA JA FOI RESOLVIDA UMA VEZ; AQUI SO SE TRADUZ O FORMATO.
//
// Existia aqui um segundo interpretador de data, escrito do zero, e ele era
// mais fraco que o primeiro num ponto que custa caro: quando o cliente diz
// "05/01" sem o ano, ele carimbava `new Date().getFullYear()`. Pedido feito em
// dezembro pra 05 de janeiro nascia com a data do janeiro que JA PASSOU -- e
// numa padaria dezembro e justamente quando se encomenda bolo pro ano novo.
//
// O `dataDeRetirada`, no `falas-do-cliente.ts`, ja resolve isso (e resolve
// tambem "sexta", "sabado que vem", e o 31 de fevereiro que o JavaScript vira
// 3 de marco). Ele veio de um teste do dono em 23/08/2026, em que o pedido foi
// anotado pra 2024. Ter um segundo parser aqui era desfazer aquele conserto na
// ultima linha do caminho.
//
// Achado na leitura da camada de banco, 28/08/2026.
function parseDataRetirada(texto: string): string | null {
  const br = dataDeRetirada(texto); // "DD/MM/AAAA", sempre no futuro, ou null
  if (!br) return null;
  const [dd, mm, aaaa] = br.split("/");
  return `${aaaa}-${mm}-${dd}`;
}
