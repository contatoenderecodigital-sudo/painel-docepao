// ============================================================================
//  WEBHOOK DO WHATSAPP — a porta de entrada do atendimento.
//   GET  -> validação do webhook (o Meta chama uma vez pra confirmar o token).
//   POST -> chega mensagem do cliente. Fluxo:
//            1. identifica o negócio (multi-tenant) e o cliente
//            2. se for áudio, transcreve (a dona pediu: ouve áudio, responde texto)
//            3. carrega histórico -> IA responde -> envia de volta
//            4. salva a conversa; se fechou pedido, cai na fila de aprovação
//
//  Responde 200 rápido pro Meta e processa; erros não derrubam o webhook
//  (senão o Meta fica reenviando). O Meta REENVIA quando não recebe 200 a
//  tempo — por isso deduplicamos pelo id da mensagem (idempotência).
// ============================================================================

import { NextRequest, after } from "next/server";
import { responder, pecaDaEtapa, ehFestaNaFala, unidadeDoProduto, categoriaDoProduto } from "@/lib/ia/cerebro";
import { carregarTenant } from "@/lib/ia/tenant";
import { enviarTexto, enviarImagemPorLink, urlDoCardapio, RECADOS_CARDAPIO, baixarMidia, marcarLidaEDigitando, type CredsEnvio } from "@/lib/whatsapp/api";
import { avisarDono } from "@/lib/alertas";
import { transcrever } from "@/lib/whatsapp/transcrever";
import {
  acharOuCriarCliente,
  carregarHistorico,
  salvarMensagem,
  registrarPedido,
  marcarWebhookNovo,
  salvarFotoPendente,
  resumoPedidoFechado,
  mensagemPorWamid,
  marcarStatusMensagem,
  guardarOrigemAnuncio,
} from "@/lib/banco/conversas";
import { definirHandoff, iaPausada, ultimaMsgClienteMs } from "@/lib/banco/atendimentos";
import { registrarAceiteCliente, temPedidoAguardandoCliente, pedidoEmAberto } from "@/lib/banco/pedidos";
import { anotarItem, removerItem, anotarDados, limparMontagem, lerMontagem } from "@/lib/banco/montagem";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { queryUm } from "@/lib/banco/db";
import crypto from "node:crypto";

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Quanto tempo a gente segura antes de responder, esperando o cliente terminar
// de falar. Mora aqui em cima porque o aviso de áudio não transcrito espera o
// mesmo tanto: os dois caminhos correm o mesmo risco de falar por cima dele.
// 12s: é o tempo de terminar a segunda frase ou gravar um áudio curto. Com 7s
// ela cortava a pessoa no meio do raciocínio.
const ESPERA_MS = 12000;

// Começo do texto que a reação vira no histórico (montarEntrada monta ele).
// Serve pra reconhecer a reação de volta na hora de decidir se o cliente
// realmente falou de novo.
const MARCA_REACAO = "[o cliente reagiu com";

// Recado do próprio Meta chegando pelo webhook (aviso de configuração da conta,
// sempre em inglês e sempre sobre a conta, nunca sobre padaria). Cliente da
// Doce Pão escreve em português e fala de comida; o corte é por essas frases,
// pra não engolir mensagem de gente de verdade.
const FRASES_META = [
  /continue setting up/i,
  /finish setting up/i,
  /your (whatsapp )?business (account|profile)/i,
  /verify your business/i,
  /this message is from meta/i,
  /you're all set/i,
];
function recadoDoMeta(msg: WhatsAppMessage): boolean {
  const t = msg.text?.body ?? "";
  if (!t) return false;
  return FRASES_META.some((r) => r.test(t));
}

// Quanto a Glorinha "demora pra digitar". Uma pessoa lê, pensa e escreve; a IA
// responde em 700ms e isso sozinho denuncia que não é gente. Base de leitura +
// ritmo de digitação, entre 1,5s e 4s.
//
// O teto era 7s e não cabe mais no turno: a espera de 12s entrou depois dele, e
// o turno inteiro roda dentro do maxDuration de 60s (12s de espera + até 30s de
// IA + cardápio + envio). Com 7s aqui, o turno pesado passava de 60s e o Vercel
// matava a função DEPOIS da IA ter rodado e cobrado, sem o cliente receber nada.
function tempoDeDigitar(texto: string): number {
  const ms = 1500 + texto.length * 28;
  return Math.min(4000, Math.max(1500, ms));
}

// O cliente falou de novo depois deste marco?
//
// REAÇÃO NÃO CONTA. Ela entra no histórico como mensagem do cliente e, sozinha,
// bastava pra a resposta pronta ser descartada: o cliente perguntava o preço e
// mandava um joinha na mensagem anterior enquanto esperava. A execução da
// pergunta desistia por causa do joinha, a execução do joinha não responde nada
// por natureza, e a pergunta ficava sem resposta nenhuma.
async function clienteFalouDepois(
  negocioId: string,
  clienteId: string,
  marcoMs: number | null,
): Promise<boolean> {
  if (!marcoMs) return false;
  const l = await queryUm<{ x: number }>(
    `select 1 as x from mensagens
      where negocio_id = $1 and cliente_id = $2
        and coalesce(autor, case when papel = 'user' then 'cliente' else 'ia' end) = 'cliente'
        and extract(epoch from criado_em) * 1000 > $3
        and conteudo not like $4
      limit 1`,
    [negocioId, clienteId, marcoMs, MARCA_REACAO + "%"],
  );
  return !!l;
}

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// Valida a assinatura do Meta (X-Hub-Signature-256 = HMAC do corpo com o App Secret).
// Se APP_SECRET não estiver setado ainda, não bloqueia (fase inicial de setup).
function assinaturaValida(req: NextRequest, corpoBruto: string): boolean {
  if (!APP_SECRET) return true;
  const recebida = req.headers.get("x-hub-signature-256") || "";
  const esperada = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(corpoBruto).digest("hex");
  return (
    recebida.length === esperada.length &&
    crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada))
  );
}

// O loop da IA (+ transcrição de áudio) pode passar de 10s. No Vercel: Hobby
// limita a 60s, Pro deixa subir. `after()` mantém o processamento vivo depois
// da resposta 200 (sem ele o serverless mata o trabalho e a msg se perde).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// --- Validação do webhook (Meta chama com hub.challenge) ---
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// --- Recebe mensagens ---
export async function POST(req: NextRequest) {
  // Lê o corpo CRU (pra validar a assinatura do Meta antes de confiar nele).
  const corpoBruto = await req.text();
  if (!assinaturaValida(req, corpoBruto)) {
    return new Response("invalid signature", { status: 401 });
  }
  let corpo: WebhookPayload;
  try {
    corpo = JSON.parse(corpoBruto) as WebhookPayload;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Responde 200 na hora (o Meta reenvia se demorar) e processa DEPOIS da resposta.
  // `after` mantém o trabalho vivo no Vercel serverless — sem ele, o processamento
  // seria morto quando a função retorna e a mensagem do cliente se perderia.
  after(async () => {
    try {
      await processar(corpo);
    } catch (e) {
      console.error("[whatsapp] erro ao processar:", e);
    }
  });
  return new Response("ok", { status: 200 });
}

async function processar(corpo: WebhookPayload) {
  for (const entry of corpo.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      const valor = ch.value;
      const msg = valor?.messages?.[0];
      // STATUS DE ENVIO: entregue, lida ou falhou. Antes isso era descartado,
      // e falha de entrega (janela de 24h fechada, numero errado) passava batido.
      if (!msg) {
        for (const st of valor?.statuses ?? []) {
          const id = st.id;
          const situacao = st.status;
          if (!id || !situacao) continue;
          if (situacao === "failed") {
            const erro = st.errors?.[0]?.title || st.errors?.[0]?.message || "falha no envio";
            console.error("[whatsapp] mensagem falhou:", id, erro);
            // Mensagem que nao chega e pior que mensagem nao enviada: a equipe
            // segue achando que avisou o cliente.
            avisarDono(
              "envio-falhou",
              "Uma mensagem nao chegou no cliente pelo WhatsApp. Motivo: " + String(erro).slice(0, 160) +
                ". Vale conferir no painel e falar com ele por outro caminho.",
            ).catch(() => {});
            await marcarStatusMensagem(id, "failed", erro).catch(() => {});
          } else if (situacao === "delivered" || situacao === "read") {
            await marcarStatusMensagem(id, situacao).catch(() => {});
          }
        }
        continue;
      }

      // Idempotência: se o Meta reenviou a MESMA mensagem, ignora (não responde 2x).
      if (msg.id && !(await marcarWebhookNovo(msg.id))) continue;

      const phoneNumberId = valor.metadata?.phone_number_id;
      const negocioId = await resolverNegocio(phoneNumberId);
      if (!negocioId) {
        console.error("[whatsapp] número não mapeado a nenhum negócio:", phoneNumberId);
        continue;
      }

      // Credenciais DESTE negócio (número conectado pelo botão). Responde pelo
      // número que recebeu a mensagem; token do tenant, com fallback no env.
      const credsTenant = await carregarCredsWhatsapp(negocioId);
      const creds = { phoneId: phoneNumberId ?? credsTenant.phoneId, token: credsTenant.token };

      const telefone = msg.from;

      // O próprio Meta manda recado no número (aviso de configuração da conta,
      // em inglês). A Dora respondeu um deles como se fosse cliente, oferecendo
      // salgadinho pro robô da Meta. Recado do Meta não é atendimento: ignora.
      if (recadoDoMeta(msg)) {
        console.log("[whatsapp] recado do Meta ignorado:", msg.text?.body?.slice(0, 60));
        continue;
      }

      const nomePerfil = valor.contacts?.[0]?.profile?.name;
      const clienteId = await acharOuCriarCliente(negocioId, telefone, nomePerfil);

      // Monta a entrada do cliente: texto puro, áudio transcrito, imagem/documento
      // (baixados e guardados em base64 pra aparecerem no chat do painel, que
      // agora SUBSTITUI o WhatsApp da dona).
      // ANUNCIO DE ORIGEM: a Meta so conta na mensagem que abriu a conversa.
      // Perdeu essa, nunca mais se sabe que o pedido veio de anuncio pago.
      if (msg.referral) {
        guardarOrigemAnuncio(negocioId, clienteId, {
          titulo: msg.referral.headline ?? null,
          corpo: msg.referral.body ?? null,
          url: msg.referral.source_url ?? null,
          tipo: msg.referral.source_type ?? null,
          anuncio_id: msg.referral.source_id ?? null,
          clique: msg.referral.ctwa_clid ?? null,
        }).catch((e) => console.error("[whatsapp] falha ao guardar origem do anuncio:", e));
      }

      const entrada = await montarEntrada(msg, creds, negocioId, clienteId);

      if (!entrada.texto) {
        // Mídia sem texto aproveitável (ex: áudio que não transcreveu): guarda o
        // que veio pra equipe ver, e se for áudio pede pra escrever.
        if (entrada.midia) {
          try {
            await salvarMensagem(negocioId, clienteId, "user", entrada.rotulo ?? "[midia]", {
              tipo: entrada.midia.tipo, mime: entrada.midia.mime, dados: entrada.midia.dados, nome: entrada.midia.nome, wamid: msg.id,
            });
          } catch (e) {
            console.error("[whatsapp] falha ao salvar mídia sem texto:", e);
          }
        }
        if (msg.type === "audio" && credsTenant.iaAtiva) {
          // ESTE AVISO TAMBÉM ESPERA O CLIENTE.
          //
          // Quem manda áudio que não transcreveu quase sempre escreve logo em
          // seguida o que quis dizer. Disparando na hora, o "não consegui ouvir"
          // chegava por cima da frase que ele já tinha mandado, e ele lia como
          // se ninguém estivesse acompanhando. Espera o mesmo tanto do resto do
          // fluxo e só avisa se ele ficou calado.
          if (msg.id) {
            marcarLidaEDigitando(msg.id, creds).catch((e) =>
              console.error("[whatsapp] falha ao confirmar leitura do audio:", e),
            );
          }
          const antesDoAviso = await ultimaMsgClienteMs(negocioId, clienteId).catch(() => null);
          await pausa(ESPERA_MS);
          const jaEscreveu = await clienteFalouDepois(negocioId, clienteId, antesDoAviso).catch(() => false);
          if (jaEscreveu) {
            console.log("[whatsapp] audio nao transcrito, mas o cliente ja escreveu depois; nao aviso");
          } else {
            try {
              await enviarTexto(telefone, "Nao consegui ouvir seu audio, pode escrever pra mim?", creds);
            } catch (e) {
              console.error("[whatsapp] falha no fallback de audio:", e);
            }
          }
        }
        continue;
      }

      const texto = entrada.texto;
      try {
        await salvarMensagem(negocioId, clienteId, "user", texto, {
          tipo: entrada.midia?.tipo,
          mime: entrada.midia?.mime,
          dados: entrada.midia?.dados,
          nome: entrada.midia?.nome,
          wamid: msg.id,
        });
      } catch (e) {
        console.error("[whatsapp] falha ao salvar mensagem do cliente:", e);
      }

      // Reacao (joinha, coracao) entra no historico e para por aqui: ninguem
      // responde um emoji com um texto.
      //
      // Sai ANTES do 'digitando...': ligar o indicador aqui prometia uma
      // resposta que nunca vem, e o cliente ficava 25 segundos vendo a Glorinha
      // "digitar" um retorno pro joinha dele.
      if (entrada.semResposta) continue;

      // Tique azul e 'digitando...' na hora: do lado dele, silencio de 12
      // segundos com tique cinza parece atendimento que nao viu a mensagem.
      if (msg.id && credsTenant.iaAtiva) {
        marcarLidaEDigitando(msg.id, creds).catch((e) =>
          console.error("[whatsapp] falha ao confirmar leitura:", e),
        );
      }

      // IA desligada no painel: guarda a mensagem pra equipe ver, mas não
      // responde automático (a equipe assume pelo Atendimentos).
      if (!credsTenant.iaAtiva) continue;

      // ESPERA O CLIENTE TERMINAR DE FALAR.
      //
      // Gente manda a ideia em pedaços: "o que é topo de bolo?" e, dois
      // segundos depois, "a massa quero de chocolate". Cada uma disparava uma
      // resposta, e as duas explicavam a mesma coisa com outras palavras. Era a
      // "mensagem duplicada" que aparecia nos testes.
      //
      // Aqui a gente segura alguns segundos e confere se ainda é a última
      // mensagem dele. Se chegou outra no meio, esta desiste: a próxima chamada
      // responde com o histórico completo, uma vez só. A mensagem já foi salva
      // acima, então o painel mostra tudo mesmo quando a resposta é pulada.
      let marcoDoTurno: number | null = null;
      try {
        const antes = await ultimaMsgClienteMs(negocioId, clienteId);
        await pausa(ESPERA_MS);
        const depois = await ultimaMsgClienteMs(negocioId, clienteId);
        // Guarda o marco: qualquer mensagem depois desta hora e assunto novo.
        // O marco leva em conta ate a reacao, pra ela nao ser confundida com
        // fala nova na segunda conferida la embaixo.
        marcoDoTurno = depois ?? antes ?? null;
        if (await clienteFalouDepois(negocioId, clienteId, antes)) {
          console.log("[whatsapp] cliente ainda estava escrevendo; deixo a proxima mensagem responder");
          continue;
        }
      } catch (e) {
        console.error("[whatsapp] falha ao checar se o cliente terminou (segue respondendo):", e);
      }

      // Alguém da equipe assumiu ESTA conversa: a IA fica calada até devolverem.
      // Sem isto, a dona respondia e a IA respondia por cima dela — dois
      // atendentes falando com o mesmo cliente ao mesmo tempo.
      try {
        if (await iaPausada(negocioId, clienteId)) {
          // A equipe assumiu: a Dora nao responde, mas alguem precisa saber
          // que o cliente escreveu, senao ele fica falando sozinho.
          await definirHandoff(negocioId, clienteId, true).catch(() => {});
          continue;
        }
      } catch (e) {
        console.error("[whatsapp] falha ao checar pausa da IA (segue respondendo):", e);
      }


      // Pedido esperando o cliente aceitar o valor da equipe: a conversa
      // anterior ainda esta viva e o historico vai inteiro.
      const aguardando = await temPedidoAguardandoCliente(negocioId, clienteId).catch(() => false);
      const historico = await carregarHistorico(negocioId, clienteId, aguardando);
      // MENSAGEM MARCADA: ela responde AQUILO, nao a ultima coisa que falou.
      //
      // Sem isso, cliente que responde uma pergunta antiga (ou corrige um item
      // la de tras) recebe resposta sobre outro assunto.
      try {
        const marcado = msg.context?.id ? await mensagemPorWamid(negocioId, clienteId, msg.context.id) : null;
        if (marcado?.conteudo) {
          const ult = historico[historico.length - 1];
          if (ult && ult.role === "user" && typeof ult.content === "string") {
            const trecho = String(marcado.conteudo).slice(0, 220);
            const dequem = marcado.papel === "assistant" ? "voce disse" : "ele disse";
            ult.content =
              "[o cliente respondeu MARCANDO esta mensagem, onde " + dequem + ": \"" + trecho + "\". Responda em cima dela]\n" +
              ult.content;
          }
        }
      } catch (e) {
        console.error("[whatsapp] falha ao ler a mensagem marcada (segue sem ela):", e);
      }
      const tenant = await carregarTenant(negocioId); // cardápio/persona DESTE negócio

      // A IA tenta os provedores em cadeia (OpenAI, Gemini, ...). Se TODOS caírem,
      // responder() lança: não deixa o cliente no vácuo, avisa que já já responde.
      // O que já está anotado vai junto: é a memória do pedido. Sem isso ela
      // reconstrói tudo de cabeça a cada mensagem, e é aí que perde item, troca
      // bolo por docinho e pergunta de novo o que o cliente já respondeu.
      const montado = await lerMontagem(negocioId, clienteId).catch(() => null);
      // O pedido que ele ja fez e que ainda esta andando. Enquanto o ticket nao
      // imprime, toda mensagem dele chega em cima DESTE pedido, nao no vazio.
      const emAberto = await pedidoEmAberto(negocioId, clienteId).catch(() => null);

      // PEDIDO AINDA NAO IMPRESSO VOLTA PRO RASCUNHO QUANDO ELE QUER MUDAR.
      //
      // Ao registrar, o rascunho e limpo. Se o cliente emenda 'da pra mudar pra
      // 250?', ela ficava sem o pedido na mao e recomecava do zero, perguntando
      // o que ele ja tinha respondido. Enquanto nao imprimiu, o pedido gravado
      // volta a ser editavel e ela mexe em cima dele.
      try {
        const querMudar = /\b(mudar|muda|trocar|troca|alterar|altera|aumentar|aumenta|diminuir|diminui|acrescentar|acrescenta|tirar|tira|incluir|inclui|adicionar|adiciona)\b/i.test(
          String(texto || ""),
        );
        const naoImpresso = emAberto && !emAberto.impresso && emAberto.status !== "aprovado";
        const rascunhoVazio = (montado?.itens?.length ?? 0) === 0;
        if (querMudar && naoImpresso && rascunhoVazio && emAberto) {
          console.log("[whatsapp] cliente quer mudar pedido ainda nao impresso; devolvendo pro rascunho");
          for (const it of emAberto.itens) {
            await anotarItem(negocioId, clienteId, {
              produto: it.produto,
              // O pedido em aberto nao guarda a categoria do item; o cardapio
              // decide, que e a mesma fonte do preco e da unidade.
              categoria: (categoriaDoProduto(it.produto) || "outro") as never,
              qtd: Number(it.qtd) || 0,
              unidade: (it.unidade === "kg" ? "kg" : "un") as "kg" | "un",
              obs: it.obs ?? null,
            }).catch(() => {});
          }
          await anotarDados(negocioId, clienteId, {
            retirada_data: emAberto.retiradaData ?? undefined,
            retirada_hora: emAberto.retiradaHora ?? undefined,
            forma_pagamento: emAberto.formaPagamento ?? undefined,
            cliente_nome: emAberto.quemRetira ?? undefined,
          }).catch(() => {});
        }
      } catch (e) {
        console.error("[whatsapp] falha ao devolver o pedido pro rascunho:", e);
      }
      const pedidoAnterior = await resumoPedidoFechado(negocioId, clienteId).catch(() => null);

      // RENOVA O 'DIGITANDO...' ANTES DE PENSAR.
      //
      // A Meta apaga o indicador sozinha em ~25s, e a espera de 12s ja comeu
      // metade disso antes da IA comecar. Com a IA levando os 30s dela, o
      // indicador morria e o cliente ficava olhando pra uma conversa parada,
      // que e exatamente a hora em que ele manda "oi?" e atropela a resposta.
      // Uma renovacao so: a Meta zera os 25s a cada chamada e isso cobre o que
      // falta do turno. Mesma funcao do inicio, sem endpoint novo.
      if (msg.id) {
        marcarLidaEDigitando(msg.id, creds).catch((e) =>
          console.error("[whatsapp] falha ao renovar o 'digitando':", e),
        );
      }

      let resp;
      try {
        // clienteId (o mesmo do acharOuCriarCliente/salvarMensagem) amarra o
        // custo de IA a ESTA conversa — pra o painel mostrar o custo por atendimento.
        resp = await responder(historico, tenant, "whatsapp", clienteId, montado, aguardando, pedidoAnterior, emAberto);
      } catch (e) {
        console.error("[whatsapp] IA falhou (todos os provedores):", e);
        // O dono precisa saber na hora: sem isto, quem descobre e o cliente.
        avisarDono(
          "ia-caiu",
          "A Dora nao conseguiu responder um cliente agora e pediu ajuda da equipe. " +
            "Motivo: " + String((e as Error)?.message ?? e).slice(0, 160),
          creds,
        ).catch(() => {});
        // A DESCULPA TAMBEM PODE CHEGAR POR CIMA DELE.
        //
        // A IA leva ate 30s pra desistir, e nesse tempo o cliente completa o
        // raciocinio. Quem falou de novo ja vai ser atendido pela proxima
        // execucao; mandar "tive um probleminha" agora so interrompe ele.
        // O handoff continua valendo: a IA caiu de verdade e a conversa precisa
        // de gente, tendo saido desculpa ou nao.
        const falouDeNovo = await clienteFalouDepois(negocioId, clienteId, marcoDoTurno).catch(() => false);
        if (falouDeNovo) {
          console.log("[whatsapp] a IA caiu, mas o cliente ja falou de novo; a proxima execucao responde");
        } else {
          const desculpa = "Tive um probleminha aqui agora, ja ja te respondo, ta?";
          try {
            await enviarTexto(telefone, desculpa, creds);
          } catch {
            // se nem isso enviar, a equipe ve a conversa parada no painel
          }
          // A desculpa TAMBÉM entra no histórico. Sem isso a dona abre a conversa,
          // vê o cliente esperando e não entende por que a Dora parou: a mensagem
          // existe no WhatsApp dele e não existe no painel dela.
          try {
            await salvarMensagem(negocioId, clienteId, "assistant", desculpa, { autor: "ia" });
          } catch (e2) {
            console.error("[whatsapp] falha ao salvar a desculpa no historico:", e2);
          }
        }
        // A conversa precisa de gente: a IA caiu e o cliente ficou esperando.
        try {
          await definirHandoff(negocioId, clienteId, true);
        } catch {
          // destaque na lista é conforto; não pode derrubar o webhook
        }
        continue;
      }

      // Registra o pedido ANTES de confirmar pro cliente (durabilidade primeiro).
      // Se falhar, NÃO manda a confirmação de "pedido salvo" (evita pedido fantasma).
      // Aplica no pedido em montagem o que a IA anotou neste turno. Cada
      // chamada mexe numa linha ou num campo; o resto fica como estava. É isso
      // que substitui a remontagem do pedido inteiro a cada mensagem.
      for (const mud of resp.montagem ?? []) {
        try {
          if (mud.tipo === "item") {
            // A unidade vem do cardapio, que e a mesma fonte do preco.
            await anotarItem(negocioId, clienteId, {
              produto: mud.produto,
              categoria: mud.categoria as never,
              qtd: mud.qtd,
              unidade: unidadeDoProduto(mud.produto, mud.categoria),
              obs: mud.obs ?? null,
            });
          } else if (mud.tipo === "remover") {
            await removerItem(negocioId, clienteId, mud.produto, mud.categoria as never);
          } else if (mud.tipo === "dados") {
            await anotarDados(negocioId, clienteId, mud.dados);
          }
        } catch (e) {
          console.error("[whatsapp] falha ao anotar no pedido em montagem:", e);
        }
      }

      // Quem decide se o cliente aceitou é a IA, não uma lista de palavras.
      // Antes era um regex com "sim", "ok", "isso" e alguns emojis, e o cliente
      // mandou 👍 e nada aconteceu. Lista nunca cobre tudo: falta o "fechou
      // então", o "pode mandar", o joinha duplo. Entender o que a pessoa quis
      // dizer é justamente o que o modelo faz bem — diferente de calcular
      // preço, que é onde código ganha.
      if (resp.aceitouOrcamento) {
        try {
          if (await registrarAceiteCliente(negocioId, clienteId)) {
            console.log("[whatsapp] a IA entendeu que o cliente aceitou; pedido liberado pra aprovacao");
          }
        } catch (e) {
          console.error("[whatsapp] falha ao registrar aceite do cliente:", e);
        }
      }

      if (resp.pedidoRegistrado) {
        try {
          await registrarPedido(negocioId, clienteId, resp.pedidoRegistrado);
          // A montagem cumpriu o papel: o pedido existe de verdade agora.
          await limparMontagem(negocioId, clienteId).catch(() => {});
        } catch (e) {
          console.error("[whatsapp] falha ao registrar pedido:", e);
          // Este aviso sai depois da IA ter pensado, entao ele corre o mesmo
          // risco da resposta normal: se o cliente falou nesse meio tempo, ele
          // chega por cima. A proxima execucao trata a conversa inteira.
          const falouDeNovo = await clienteFalouDepois(negocioId, clienteId, marcoDoTurno).catch(() => false);
          if (falouDeNovo) {
            console.log("[whatsapp] pedido nao gravou, mas o cliente ja falou de novo; deixo a proxima responder");
            continue;
          }
          try {
            await enviarTexto(telefone, "Recebi seu pedido, so vou confirmar com a equipe e ja te aviso, ta?", creds);
          } catch {
            // idem: equipe assume pelo painel
          }
          continue;
        }
      }

      // Guard contra resposta vazia (modelo devolveu nada): manda algo, não body vazio.
      // A peca da etapa vai sozinha quando ela nao pediu: mandada a mandar o
      // cardapio, ela digitava a lista de sabores em texto e o cliente tinha
      // que pedir a foto. Peca ja enviada nesta conversa nao repete.
      try {
        const falaToda = historico
          .filter((m) => m.role === "user" && typeof m.content === "string")
          .map((m) => m.content as string)
          .join("  ");
        // So manda a peca da familia que o CLIENTE ja citou. Sem isso ela
        // despejava o cardapio de salgados em quem so perguntou "voces fazem
        // festa?", antes de qualquer conversa.
        const citou: Record<string, boolean> = {
          salgados: /salgad|frito|assado|coxinha|esfirra|empadinha|risolis|ris[óo]lis/i.test(falaToda),
          docinhos: /docinho|doce|brigadeiro|beijinho|trufa/i.test(falaToda),
          "bolos-festa": /bolo/i.test(falaToda),
        };
        if (ehFestaNaFala(falaToda) && !resp.pedidoRegistrado && !aguardando) {
          // A recusa vale JA neste turno: o que estava gravado, o que a IA
          // acabou de anotar e o que o cliente escreveu agora.
          const anotadoAgora = (resp.montagem ?? [])
            .map((m) => (m.tipo === "dados" ? String(m.dados?.nao_quer ?? "") : ""))
            .join(" ");
          const recusaNaFala = [
            /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}salgad/i.test(String(texto || "")) ? "salgado" : "",
            /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}(docinho|doce)/i.test(String(texto || "")) ? "docinho" : "",
            /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}bolo/i.test(String(texto || "")) ? "bolo" : "",
          ].filter(Boolean).join(", ");
          const naoQuerAgora = [String(montado?.dados?.nao_quer ?? ""), anotadoAgora, recusaNaFala]
            .filter(Boolean)
            .join(", ");
          const peca = pecaDaEtapa(montado?.itens ?? [], naoQuerAgora);
          if (peca && citou[peca] && !(resp.cardapiosParaEnviar ?? []).includes(peca)) {
            resp.cardapiosParaEnviar = [...(resp.cardapiosParaEnviar ?? []), peca];
          }
        }
      } catch (e) {
        console.error("[whatsapp] falha ao escolher a peca da etapa:", e);
      }

      const textoResp = (resp.texto || "").trim() || "Ja recebi sua mensagem, so um instante.";
      // Cardápio pedido: manda a peça pronta depois do texto. Uma imagem custa
      // zero token e não corre o risco de a IA errar preço redigitando a lista.
      // Falha de imagem nunca derruba a resposta — o texto já foi entregue.
      const mandarCardapios = async () => {
        // PEÇA JÁ MANDADA NÃO VAI DE NOVO.
        //
        // A IA repetiu enviar_cardapio em dois turnos seguidos e o cliente
        // recebeu os três cardápios duas vezes em vinte segundos. Vira spam, e
        // spam num número comercial é o caminho mais curto pra ele bloquear a
        // padaria. O histórico já sabe o que foi enviado; basta perguntar.
        let jaEnviados: string[] = [];
        try {
          const { query } = await import("@/lib/banco/db");
          const linhas = await query<{ conteudo: string }>(
            `select conteudo from mensagens
              where negocio_id = $1 and cliente_id = $2 and tipo = 'imagem'
                and midia_url is not null and criado_em > now() - interval '2 hours'`,
            [negocioId, clienteId],
          );
          jaEnviados = linhas.map((l) => (l.conteudo || "").toLowerCase());
        } catch (e) {
          console.error("[whatsapp] falha ao checar cardapios ja enviados:", e);
        }

        for (const c of resp.cardapiosParaEnviar ?? []) {
          const rotulo = `cardápio de ${c.replace(/-/g, " ")}`.toLowerCase();
          if (jaEnviados.some((j) => j.includes(rotulo))) {
            console.log("[whatsapp] cardapio", c, "ja foi enviado nesta conversa; nao repito");
            continue;
          }
          const urlPeca = urlDoCardapio(c);
          // A peça entra no histórico ANTES do envio, e fora do try do envio.
          // Estava depois: quando o envio falhava (token vencido, número
          // errado), a mensagem nunca era gravada e a dona abria a conversa
          // vendo a Dora dizer "te mandei o cardápio" sem cardápio nenhum,
          // sem pista de que o problema tinha sido no envio.
          try {
            await salvarMensagem(negocioId, clienteId, "assistant", `Cardápio de ${c.replace(/-/g, " ")}`, {
              tipo: "imagem", mime: "image/jpeg", url: urlPeca, autor: "ia",
            });
          } catch (e) {
            console.error("[whatsapp] falha ao salvar cardapio no historico:", e);
          }
          try {
            await enviarImagemPorLink(telefone, urlPeca, undefined, creds);
            // A imagem vai por LINK: a Meta ainda precisa baixar a URL antes de
            // entregar, e um texto mandado na sequência passa na frente dela.
            // Era por isso que o recado do bolo aparecia colado no cardápio de
            // salgados. A pausa dá tempo da peça chegar antes da próxima.
            await pausa(2200);
            for (const r of RECADOS_CARDAPIO[c] ?? []) {
              await enviarTexto(telefone, r, creds);
              await pausa(900);
            }
          } catch (e) {
            console.error("[whatsapp] falha ao enviar cardapio", c, e);
          }
        }
      };
      // CHEGOU MENSAGEM NOVA ENQUANTO ELA PENSAVA? ENTAO ESTA RESPOSTA NAO SAI.
      //
      // Montar a resposta leva segundos. Nesse meio tempo o cliente completa o
      // raciocinio ("...e sem cebola"), e a resposta pronta ja nasceu velha.
      // Descartar aqui custa uma volta; responder por cima custa a conversa.
      try {
        if (await clienteFalouDepois(negocioId, clienteId, marcoDoTurno)) {
          console.log("[whatsapp] chegou mensagem nova enquanto eu pensava; deixo a proxima responder");
          continue;
        }
      } catch (e) {
        console.error("[whatsapp] falha ao conferir mensagem nova (segue enviando):", e);
      }

      // O id que o Meta devolve identifica esta resposta quando o cliente a marcar.
      let wamidResposta: string | null = null;
      try {
        // Imagem ANTES do texto: a IA diz "te mandei o cardápio aqui", e se o
        // texto chega primeiro o cliente lê a frase olhando pra uma conversa
        // sem cardápio nenhum.
        await mandarCardapios();
        // Tempo de "digitação": responder no mesmo segundo entrega que é robô.
        // Proporcional ao tamanho da resposta, com teto — ninguém espera 20s
        // por uma frase, e o webhook tem prazo pra terminar.
        await pausa(tempoDeDigitar(textoResp));
        wamidResposta = await enviarTexto(telefone, textoResp, creds);
      } catch (e) {
        console.error("[whatsapp] falha ao enviar resposta:", e);
      }
      try {
        // O id do WhatsApp vem junto: sem ele nao da pra reconhecer quando o
        // cliente responde marcando esta mensagem.
        await salvarMensagem(negocioId, clienteId, "assistant", textoResp, { wamid: wamidResposta ?? undefined });
      } catch (e) {
        console.error("[whatsapp] falha ao salvar resposta:", e);
      }

      // Handoff: a IA pediu a equipe -> marca a conversa como "precisa de você"
      // (destaque na lista do painel até alguém assumir/responder).
      if (resp.precisaHumano) {
        try {
          await definirHandoff(negocioId, clienteId, true);
        } catch (e) {
          console.error("[whatsapp] falha ao marcar handoff:", e);
        }
      }
    }
  }
}

// Entrada do cliente já normalizada pro painel: o texto que a IA lê + a mídia
// (base64) que o chat mostra. Uma imagem também vira "foto de referência" do
// pedido (mantém o fluxo antigo), além de virar mensagem com mídia na conversa.
type MidiaEntrada = { tipo: "imagem" | "audio" | "documento" | "video"; mime: string; dados: string; nome?: string | null };
// semResposta: entra no historico e no painel, mas nao puxa resposta da IA
// (reacao, por exemplo: ninguem responde um joinha com um texto).
type Entrada = { texto: string | null; rotulo?: string; midia?: MidiaEntrada; semResposta?: boolean };

async function montarEntrada(
  msg: WhatsAppMessage,
  creds: CredsEnvio,
  negocioId: string,
  clienteId: string,
): Promise<Entrada> {
  if (msg.type === "text") return { texto: msg.text?.body ?? null };

  // Áudio: baixa, guarda (pra equipe reouvir) e transcreve (a IA responde texto).
  if (msg.type === "audio" && msg.audio?.id) {
    let dados: string | undefined;
    let transcricao: string | null = null;
    const mime = msg.audio.mime_type || "audio/ogg";
    try {
      const bin = await baixarMidia(msg.audio.id, creds);
      dados = Buffer.from(bin).toString("base64");
      try {
        transcricao = await transcrever(bin, { negocioId, clienteId, contato: msg.from });
      } catch (e) {
        console.error("[whatsapp] falha ao transcrever audio:", e);
      }
    } catch (e) {
      console.error("[whatsapp] falha ao baixar audio:", e);
    }
    return { texto: transcricao, rotulo: "Áudio", midia: dados ? { tipo: "audio", mime, dados } : undefined };
  }

  // Imagem: baixa, guarda como foto de referência do pedido E como mídia do chat.
  if (msg.type === "image" && msg.image?.id) {
    const legenda = msg.image.caption?.trim();
    const nota = "[o cliente enviou uma foto de referência para o pedido]";
    const mime = msg.image.mime_type || "image/jpeg";
    let dados: string | undefined;
    try {
      const bin = await baixarMidia(msg.image.id, creds);
      dados = Buffer.from(bin).toString("base64");
      await salvarFotoPendente(negocioId, clienteId, dados, mime); // mantém a foto no pedido
    } catch (e) {
      console.error("[whatsapp] falha ao salvar foto de referência:", e);
    }
    const texto = legenda ? `${legenda}\n${nota}` : nota;
    return { texto, rotulo: legenda || "Foto", midia: dados ? { tipo: "imagem", mime, dados } : undefined };
  }

  // Documento: baixa e guarda; a IA fica sabendo pelo nome do arquivo.
  if (msg.type === "document" && msg.document?.id) {
    const nome = msg.document.filename || "documento";
    const legenda = msg.document.caption?.trim();
    const mime = msg.document.mime_type || "application/octet-stream";
    let dados: string | undefined;
    try {
      const bin = await baixarMidia(msg.document.id, creds);
      dados = Buffer.from(bin).toString("base64");
    } catch (e) {
      console.error("[whatsapp] falha ao baixar documento:", e);
    }
    const texto = `[o cliente enviou um documento: ${nome}]${legenda ? `\n${legenda}` : ""}`;
    return { texto, rotulo: nome, midia: dados ? { tipo: "documento", mime, dados, nome } : undefined };
  }

  // Video: guarda igual imagem. Em festa vem video do tema do bolo.
  if (msg.type === "video" && msg.video?.id) {
    const legenda = msg.video.caption?.trim();
    const mime = msg.video.mime_type || "video/mp4";
    let dados: string | undefined;
    try {
      const bin = await baixarMidia(msg.video.id, creds);
      dados = Buffer.from(bin).toString("base64");
    } catch (e) {
      console.error("[whatsapp] falha ao baixar video:", e);
    }
    const texto = "[o cliente enviou um vídeo]" + (legenda ? "\n" + legenda : "");
    return { texto, rotulo: legenda || "Vídeo", midia: dados ? { tipo: "video", mime, dados } : undefined };
  }

  // Figurinha nao muda o pedido, mas some do painel se a gente ignorar.
  if (msg.type === "sticker") {
    return { texto: "[o cliente mandou uma figurinha]", rotulo: "Figurinha" };
  }

  // Localizacao: normalmente e alguem perguntando onde retirar, ou mandando
  // o endereco de entrega. Os dois casos precisam chegar legiveis.
  if (msg.type === "location" && msg.location) {
    const l = msg.location;
    const onde = [l.name, l.address].filter(Boolean).join(" - ");
    const coord = l.latitude != null && l.longitude != null ? l.latitude + ", " + l.longitude : "";
    return {
      texto: "[o cliente enviou uma localização" + (onde ? ": " + onde : "") + (coord ? " (" + coord + ")" : "") + "]",
      rotulo: "Localização",
    };
  }

  // Contato: quase sempre e quem vai retirar o pedido no lugar dele.
  if (msg.type === "contacts" && msg.contacts?.length) {
    const c = msg.contacts[0];
    const nome = c.name?.formatted_name || "sem nome";
    const fone = c.phones?.[0]?.phone || "";
    return {
      texto: "[o cliente enviou um contato: " + nome + (fone ? " " + fone : "") + "]",
      rotulo: nome,
    };
  }

  // Botao ou lista: o titulo escolhido vale como se ele tivesse digitado.
  if (msg.type === "interactive" && msg.interactive) {
    const escolhido =
      msg.interactive.button_reply?.title ||
      msg.interactive.list_reply?.title ||
      "";
    const detalhe = msg.interactive.list_reply?.description;
    if (escolhido) return { texto: escolhido + (detalhe ? " (" + detalhe + ")" : "") };
  }
  if (msg.type === "button" && msg.button?.text) return { texto: msg.button.text };

  // Reacao nao e pergunta: entra no historico e nao puxa resposta.
  if (msg.type === "reaction") {
    return {
      texto: "[o cliente reagiu com " + (msg.reaction?.emoji || "uma reação") + "]",
      rotulo: "Reação",
      semResposta: true,
    };
  }

  // Tipo que a Meta marca como nao suportado (enquete, contato ao vivo).
  if (msg.type === "unsupported" || msg.errors?.length) {
    return {
      texto: "[o cliente mandou algo que o WhatsApp não entrega por aqui; peça pra ele escrever ou mandar áudio]",
      rotulo: "Não suportado",
    };
  }

  return { texto: "[o cliente mandou uma mensagem do tipo " + msg.type + ", que ainda não sei ler]" };
}

// Multi-tenant: mapeia o phone_number_id (do Meta) pro negócio. É uma CONSULTA
// determinística no banco (zero token, a IA nunca adivinha o cliente). Só depois
// de resolver o tenant aqui é que o LLM é chamado, com o cérebro DELE pronto.
// Número desconhecido = null (o webhook loga e descarta).
async function resolverNegocio(phoneNumberId?: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  const n = await queryUm<{ id: string }>(
    "select id from negocios where config->>'whatsapp_phone_id' = $1 and ativo = true",
    [phoneNumberId],
  );
  if (n) return n.id;
  // Transição: o número de TESTE do env (antes do cliente conectar pelo Embedded
  // Signup) cai no NEGOCIO_PADRAO. Qualquer OUTRO número desconhecido = descarta.
  //
  // Mas SÓ enquanto o tenant padrão ainda não tem número próprio. Depois que ele
  // conecta, este atalho vira um ponteiro pro número ANTIGO que ficou no env — e
  // a Meta recicla id de número de teste. Sem esta checagem, mensagem de uma
  // empresa estranha que herdasse aquele id cairia dentro deste cliente.
  if (
    process.env.NEGOCIO_PADRAO_ID &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    const jaConectado = await queryUm<{ id: string }>(
      "select id from negocios where id = $1 and config->>'whatsapp_phone_id' is not null",
      [process.env.NEGOCIO_PADRAO_ID],
    );
    if (jaConectado) {
      console.error(
        "[whatsapp] numero do env (" + phoneNumberId + ") esta velho: o tenant ja tem numero proprio. Mensagem descartada.",
      );
      return null;
    }
    return process.env.NEGOCIO_PADRAO_ID;
  }
  return null;
}

// --- Tipos mínimos do payload do WhatsApp (só o que a gente usa) ---
type WhatsAppMessage = {
  id?: string;
  from: string;
  type: string;
  // Vem quando o cliente responde marcando uma mensagem: id da marcada.
  context?: { id?: string; from?: string };
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  sticker?: { id: string; mime_type?: string; animated?: boolean };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string; wa_id?: string }[] }[];
  // Resposta de botao ou de lista que a gente mandou.
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  button?: { text?: string; payload?: string };
  reaction?: { message_id?: string; emoji?: string };
  // Anuncio Click-to-WhatsApp: diz de onde o cliente veio.
  referral?: {
    source_url?: string;
    source_type?: string;
    source_id?: string;
    headline?: string;
    body?: string;
    ctwa_clid?: string;
  };
  errors?: { code?: number; title?: string; message?: string }[];
};
type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string } }[];
        messages?: WhatsAppMessage[];
        // Confirmacoes de envio das mensagens que a gente mandou.
        statuses?: {
          id?: string;
          status?: string;
          errors?: { title?: string; message?: string }[];
        }[];
      };
    }[];
  }[];
};
