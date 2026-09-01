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

import OpenAI from "openai";
import { clienteDoCerebro, modeloDoCerebro } from "@/lib/ia/cliente-do-cerebro";
import { registrarUsoIA } from "@/lib/ia/uso";
import { atenderComFluxoNovo, ehDoFluxoNovo } from "@/lib/ia/fluxo/atender";
import { NextRequest, after } from "next/server";
import { unidadeDoPedido as unidadeDoProduto, categoriaDoPedido as categoriaDoProduto } from "@/lib/ia/dados/produtos";
import { enviarTexto, enviarImagemPorLink, urlDoCardapio, RECADOS_CARDAPIO, baixarMidia, marcarLidaEDigitando, type CredsEnvio,
  enviarBotoes,
} from "@/lib/whatsapp/api";
import { statusesDoWebhook } from "@/lib/whatsapp/status";
import { avisarDono, avisarDona } from "@/lib/alertas";
import { transcrever } from "@/lib/whatsapp/transcrever";
import {
  acharOuCriarCliente,
  padariaJaFalouNaConversa,
  salvarMensagem,
  marcarWebhookNovo,
  salvarFotoPendente,
  marcarFotoComoComprovante,
  falasSemResposta,
  mensagemPorWamid,
  marcarStatusMensagem,
  guardarOrigemAnuncio,
} from "@/lib/banco/conversas";
import { definirHandoff, iaPausada, ultimaMsgClienteMs } from "@/lib/banco/atendimentos";
import { pedidoEmAberto } from "@/lib/banco/pedidos";
import { anotarItem, anotarDados, lerMontagem } from "@/lib/banco/montagem";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { queryUm } from "@/lib/banco/db";
import crypto from "node:crypto";
import { RECADO_DE_FOTO } from "@/lib/ia/texto";
import { avisoDeProblema } from "@/lib/padaria-aberta";

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

function logWhatsapp(onde: string, e: unknown) {
  console.error("[whatsapp] " + onde + ":", e);
}

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
// O teto era 7s e não cabe no turno inteiro: o turno roda dentro do maxDuration
// de 60s (a espera + até 30s de IA + cardápio + envio). Com 7s aqui, o turno
// pesado passava de 60s e o Vercel matava a função DEPOIS da IA ter rodado e
// cobrado, sem o cliente receber nada.
//
// A conta ficou folgada em 27/08/2026, quando a espera duplicada saiu: eram 22
// segundos parados, hoje são 10. O número aqui embaixo não mudou por isso; o
// que mudou foi a margem.
function tempoDeDigitar(texto: string): number {
  const ms = 1500 + texto.length * 28;
  return Math.min(4000, Math.max(1500, ms));
}

/**
 * QUANTO ELA ESPERA ANTES DE RESPONDER.
 *
 * Tempo suficiente pra quem esta escrevendo terminar a frase seguinte, e curto
 * o bastante pra nao parecer que ninguem viu.
 *
 * DEZ SEGUNDOS, decidido pelo dono em 23/08/2026 depois de ver a conversa: ele
 * comecou em sete e mandou aumentar. Quem escreve no celular digita devagar, e
 * a Dora cortando a pessoa no meio do raciocinio e pior que a Dora demorando um
 * pouco: a mensagem seguinte quase sempre e o pedido de verdade.
 *
 * Da pra mexer sem deploy pela variavel ESPERA_SEGUNDOS.
 *
 * E ESTA E A UNICA ESPERA. HAVIA DUAS, E O CLIENTE ESPERAVA AS DUAS.
 *
 * Existia um `ESPERA_MS = 12000` chumbado aqui em cima fazendo o MESMO
 * trabalho: segurar alguns segundos e desistir se chegou outra mensagem. As
 * duas rodavam no mesmo caminho, uma depois da outra:
 *
 *     12s antes de carregar o historico  +  10s antes de chamar a IA  =  22s
 *
 * Vinte e dois segundos de silencio pra toda mensagem de texto. Do lado do
 * cliente e atendimento que sumiu.
 *
 * E era perigoso alem de lento: o turno inteiro tem 60s antes do Vercel matar a
 * funcao, e o proprio comentario do `tempoDeDigitar` ja avisava disso. Vinte e
 * dois segundos parado mais ate 30s de IA chega no teto, e quando estoura a IA
 * ja foi chamada e cobrada, e o cliente nao recebe nada.
 *
 * As duas nasceram em datas diferentes pro mesmo problema, com valores
 * diferentes (12 e 10) e explicacoes que se contradiziam. E o defeito de sempre
 * deste projeto: o mesmo assunto decidido em dois lugares.
 *
 * Fica a do dono, que ele decidiu em 23/08/2026 e da pra ajustar sem deploy. O
 * aviso de audio nao transcrito usa a mesma, que e o que o comentario dele ja
 * pedia: "espera o mesmo tanto do resto do fluxo".
 */
const ESPERA_ANTES_DE_RESPONDER = Math.max(0, Number(process.env.ESPERA_SEGUNDOS ?? 10) * 1000);

/**
 * O CLIENTE FALOU DE NOVO DEPOIS DESTE MARCO?
 *
 * REAÇÃO NÃO CONTA. Ela entra no histórico como mensagem do cliente e, sozinha,
 * bastava pra a resposta pronta ser descartada: o cliente perguntava o preço e
 * mandava um joinha na mensagem anterior enquanto esperava. A execução da
 * pergunta desistia por causa do joinha, a execução do joinha não responde nada
 * por natureza, e a pergunta ficava sem resposta nenhuma.
 *
 * Este texto estava ÓRFÃO: ele descrevia esta função e alguém encaixou a
 * constante da espera entre os dois. Quem lia o comentário achava que estava
 * lendo sobre a espera, e quem lia a função não achava explicação nenhuma.
 */
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
      // STATUS DE ENVIO: entregue, lida ou falhou. Antes isso era descartado,
      // e falha de entrega (janela de 24h fechada, numero errado) passava batido.
      //
      // O recibo vinha num webhook proprio. Quando a Meta junta status e
      // mensagem no mesmo pacote, olhar `statuses` so se `messages` estiver
      // vazio pulava o UPDATE. Recibo nao se inventa: so deixa de jogar fora.
      for (const st of statusesDoWebhook(valor)) {
        const id = st.id;
        const situacao = st.situacao;
        if (situacao === "failed") {
          const erro = st.erro || "falha no envio";
          console.error("[whatsapp] mensagem falhou:", id, erro);
          avisarDono(
            "envio-falhou",
            "Uma mensagem nao chegou no cliente pelo WhatsApp. Motivo: " + String(erro).slice(0, 160) +
              ". Vale conferir no painel e falar com ele por outro caminho.",
          ).catch((e) => logWhatsapp("aviso de envio falhou", e));
          await marcarStatusMensagem(id, "failed", erro).catch((e) => logWhatsapp("gravar falha de envio", e));
        } else if (situacao === "delivered" || situacao === "read") {
          await marcarStatusMensagem(id, situacao).catch((e) => logWhatsapp("gravar status " + situacao, e));
        } else {
          console.error("[whatsapp] status ignorado (nao e recibo de entrega/lida/falha):", situacao, id);
        }
      }
      if (!valor?.messages?.length) {
        continue;
      }

      // TODA MENSAGEM DO PACOTE, E NAO SO A PRIMEIRA.
      //
      // Aqui estava `const msg = valor?.messages?.[0]`, e o resto do pacote era
      // jogado fora. O Meta entrega `messages` como LISTA e junta o que chega
      // perto: e exatamente o caso de quem escreve picado, que e a razao de
      // existir metade deste arquivo.
      //
      //     cliente >> quero 100 coxinha
      //     cliente >> e 50 brigadeiro
      //
      // Se as duas viessem no mesmo pacote, a segunda nao era respondida NEM
      // SALVA: sumia antes de existir, entao nem a juncao das falas pendentes
      // podia recupera-la. O cliente via metade do pedido anotado e nao tinha
      // como saber por que.
      //
      // Achado na releitura de 27/08/2026, na segunda passada pelo arquivo. Na
      // primeira eu li esta linha e nao vi.
      for (const msg of valor.messages) {
        // SO A ULTIMA DO PACOTE RESPONDE. AS OUTRAS SAO SALVAS.
        //
        // E a mesma regra que o arquivo ja aplica pra mensagens que chegam em
        // chamadas separadas: "so a ultima responde, e responde tudo". Sem isto,
        // um pacote com tres mensagens faria TRES esperas de dez segundos e TRES
        // respostas, que e o oposto do que este arquivo inteiro tenta fazer.
        //
        // As anteriores ficam gravadas e entram na juncao das falas pendentes,
        // entao a resposta da ultima ja leva o que elas disseram.
        const ehUltimaDoPacote = msg === valor.messages[valor.messages.length - 1];

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
          await pausa(ESPERA_ANTES_DE_RESPONDER);
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

      // A mensagem ja esta salva e aparece no painel. Quem responde e a ultima
      // do pacote, com a juncao das falas pendentes levando esta junto.
      if (!ehUltimaDoPacote) {
        console.log("[whatsapp] mensagem do meio do pacote: salvei, quem responde e a ultima");
        continue;
      }

      // Tique azul e 'digitando...' na hora: do lado dele, silencio com tique
      // cinza parece atendimento que nao viu a mensagem.
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
        await pausa(ESPERA_ANTES_DE_RESPONDER);
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
          await definirHandoff(negocioId, clienteId, true).catch((e) => logWhatsapp("handoff da equipe", e));
          continue;
        }
      } catch (e) {
        console.error("[whatsapp] falha ao checar pausa da IA (segue respondendo):", e);
      }


      // A PADARIA JA FALOU COM ELE NESTA CONVERSA?
      //
      // E a unica coisa que o cerebro precisa saber do passado: se ja falou,
      // nao cumprimenta de novo. Aqui se carregavam as 40 ultimas mensagens
      // INTEIRAS pra responder esse sim ou nao, e mais uma ida ao banco
      // (`temPedidoAguardandoCliente`) cujo resultado ia pra um parametro que o
      // `carregarHistorico` jogava fora com um `void`. Duas consultas por
      // mensagem, e a segunda o `atender` refazia logo depois.
      //
      // Achado na leitura da camada de banco, 28/08/2026.
      const jaFalou = await padariaJaFalouNaConversa(negocioId, clienteId).catch(() => false);

      // MENSAGEM MARCADA: ELA RESPONDE AQUILO -- E ISSO ESTAVA MORTO.
      //
      // Quando o cliente responde CITANDO uma mensagem antiga, o WhatsApp manda
      // o id dela em `msg.context.id`. Este bloco lia a mensagem citada e
      // escrevia o aviso dentro do array `historico` -- que, depois que o
      // cerebro novo entrou, so era perguntado se tinha alguma fala da padaria.
      // O texto que o modelo recebe e o `textoJunto`, e nele nunca entrou nada
      // disto.
      //
      // O comentario prometia que "cliente que responde uma pergunta antiga nao
      // recebe resposta sobre outro assunto", e era exatamente o que continuava
      // acontecendo. O aviso agora e montado aqui e grudado no `textoJunto` la
      // embaixo, depois que ele fica pronto.
      let avisoDaMarcada = "";
      try {
        const marcado = msg.context?.id ? await mensagemPorWamid(negocioId, clienteId, msg.context.id) : null;
        if (marcado?.conteudo) {
          const trecho = String(marcado.conteudo).slice(0, 220);
          const dequem = marcado.papel === "assistant" ? "voce disse" : "ele disse";
          avisoDaMarcada =
            "[o cliente respondeu MARCANDO esta mensagem, onde " + dequem + ": " +
            JSON.stringify(trecho) + ". Responda em cima dela]" + String.fromCharCode(10);
        }
      } catch (e) {
        console.error("[whatsapp] falha ao ler a mensagem marcada (segue sem ela):", e);
      }
      // AQUI SAIU UMA IDA AO BANCO QUE NAO SERVIA MAIS PRA NADA.
      //
      // `carregarTenant` trazia o cardapio e a persona DAQUELE negocio, e o
      // cerebro antigo montava a carta dele com isso. O cerebro foi apagado em
      // 26/08/2026 e a chamada ficou: consultava o banco em TODA mensagem e o
      // resultado nao era lido por ninguem.
      //
      // O TypeScript nao reclama de variavel sem uso com a configuracao atual,
      // entao ela sobreviveu calada. Achada lendo o arquivo linha por linha.
      //
      // O pedido em montagem, esse sim, e lido: e a memoria do pedido, e sem ele
      // a IA reconstroi tudo de cabeca a cada mensagem, que e onde ela perde
      // item e pergunta de novo o que o cliente ja respondeu.
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
      // AQUI HAVIA UMA LISTA DE DEZESSEIS VERBOS MINHA.
      //
      //   mudar|muda|trocar|troca|alterar|altera|aumentar|aumenta|diminuir|
      //   diminui|acrescentar|acrescenta|tirar|tira|incluir|inclui|adicionar
      //
      // Ela tentava adivinhar, ANTES de chamar a IA, se o cliente queria mexer
      // no pedido. Errava em "coloca mais 50", "em vez de 200", "deixa 100" e em
      // qualquer jeito de falar que nao estivesse escrito ali. Quando errava, o
      // pedido nao voltava pro rascunho e a padaria recomecava do zero,
      // perguntando o que o cliente ja tinha respondido.
      //
      // Regra do dono: nada pode ser lista minha. E ele fez a pergunta certa:
      // "a IA nao tem capacidade de entender o que o cliente fala?".
      //
      // Tem. O problema era de ORDEM, e nao de capacidade: a IA so consegue
      // mexer no que ela ve, e quem decide o que ela ve roda antes dela. Entao a
      // saida nao e adivinhar melhor, e parar de adivinhar: o pedido em aberto
      // vai SEMPRE pro rascunho, e a IA decide o que fazer com ele.
      //
      // O QUE SEGURAVA ISSO ERA O MEDO DE REGISTRAR DUAS VEZES, e fui conferir
      // antes de mexer: `registrarPedido` e um pedido POR CONVERSA. Se ja existe
      // um esperando aprovacao, ele e ATUALIZADO, e nao duplicado. So depois que
      // a equipe aprova e que um novo nasce separado. A trava existe, entao
      // restaurar sempre nao cria pedido fantasma.
      try {
        const naoImpresso = emAberto && !emAberto.impresso && emAberto.status !== "aprovado";
        const rascunhoVazio = (montado?.itens?.length ?? 0) === 0;
        if (naoImpresso && rascunhoVazio && emAberto) {
          console.log("[whatsapp] pedido em aberto ainda nao impresso; devolvendo pro rascunho");
          for (const it of emAberto.itens) {
            // A UNIDADE VAZIA VIRAVA PECA, E BOLO SE VENDE POR QUILO.
            //
            // Estava `it.unidade === "kg" ? "kg" : "un"`: qualquer coisa que
            // nao fosse exatamente "kg" virava unidade, INCLUSIVE vazio e nulo.
            // Uma linha antiga sem unidade trazia o bolo de 2 kg de volta como
            // 2 PECAS, e o motor cobrava R$ 46,90 no lugar de R$ 93,80.
            //
            // O comentario que estava aqui ja dizia o certo, e o codigo nao
            // fazia: "o cardapio decide, que e a mesma fonte do preco e da
            // unidade". A funcao que responde isso estava importada neste
            // arquivo e nunca era chamada, entao eu a apaguei como morta na
            // primeira releitura de 27/08/2026. Ela nao estava morta: estava
            // esperando ser ligada nesta linha.
            const doCardapio = unidadeDoProduto(it.produto, categoriaDoProduto(it.produto));
            await anotarItem(negocioId, clienteId, {
              produto: it.produto,
              // O pedido em aberto nao guarda a categoria do item; o cardapio
              // decide, que e a mesma fonte do preco e da unidade.
              categoria: (categoriaDoProduto(it.produto) || "outro") as never,
              qtd: Number(it.qtd) || 0,
              unidade: (it.unidade === "kg" || it.unidade === "un" ? it.unidade : doCardapio) as "kg" | "un",
              obs: it.obs ?? null,
            }).catch((e) => logWhatsapp("devolver item pro rascunho", e));
          }
          await anotarDados(negocioId, clienteId, {
            retirada_data: emAberto.retiradaData ?? undefined,
            retirada_hora: emAberto.retiradaHora ?? undefined,
            forma_pagamento: emAberto.formaPagamento ?? undefined,
            cliente_nome: emAberto.quemRetira ?? undefined,
          }).catch((e) => logWhatsapp("devolver dados pro rascunho", e));
        }
      } catch (e) {
        console.error("[whatsapp] falha ao devolver o pedido pro rascunho:", e);
      }
      // AQUI SAIU A SEGUNDA IDA AO BANCO QUE NAO SERVIA MAIS PRA NADA.
      //
      // `resumoPedidoFechado` trazia o ultimo pedido ja fechado pra dar contexto
      // ao cerebro antigo. Ele foi apagado em 26/08/2026 e a consulta ficou,
      // rodando em TODA mensagem, com o resultado nao lido por ninguem.
      //
      // Junto com o `carregarTenant` logo acima, eram duas idas ao banco por
      // mensagem, pra nada. As duas achadas lendo o arquivo inteiro.

      // RENOVA O 'DIGITANDO...' ANTES DE PENSAR.
      //
      // A Meta apaga o indicador sozinha em ~25s, e a espera ja comeu parte
      // disso antes da IA comecar. Com a IA levando os 30s dela, o
      // indicador morria e o cliente ficava olhando pra uma conversa parada,
      // que e exatamente a hora em que ele manda "oi?" e atropela a resposta.
      // Uma renovacao so: a Meta zera os 25s a cada chamada e isso cobre o que
      // falta do turno. Mesma funcao do inicio, sem endpoint novo.
      if (msg.id) {
        marcarLidaEDigitando(msg.id, creds).catch((e) =>
          console.error("[whatsapp] falha ao renovar o 'digitando':", e),
        );
      }

      // ================================================================
      //  O FLUXO, QUE E O SISTEMA
      //
      //  Todo mundo cai aqui. `FLUXO_NOVO_PARA=off` desliga a IA em segundos,
      //  sem deploy, pro dia em que ela fizer besteira com cliente na linha.
      //
      //  O QUE ESTAVA ESCRITO AQUI ERA MENTIRA, e perigosa: dizia que sem a
      //  variavel "a Dora antiga atende como sempre". A Dora antiga foi apagada
      //  em 26/08/2026.
      //
      //  `off` agora significa o que o nome diz: nao chama modelo e nao manda
      //  resposta automatica. A mensagem do cliente ja foi salva no painel.
      // ================================================================
      if (!ehDoFluxoNovo(telefone)) {
        console.log("[fluxo] IA desligada; mensagem salva sem resposta automatica");
        continue;
      }

      try {
          // ================================================================
          //  ELA ESPERA VOCE TERMINAR DE FALAR
          //
          //  Pedido do dono, 23/08/2026, duas vezes: "tem que fazer ela esperar
          //  pra responder quando o cliente esta digitando ou mandou outra
          //  mensagem, ela pensar e mandar junto".
          //
          //  No teste dele:
          //
          //    Kemilly: Bom dia!        Dora: Bom dia, tudo bem? Como posso ajudar?
          //    Kemilly: Tudo bem?       Dora: Posso ajudar em algo?
          //
          //  Duas respostas pra uma pessoa que ainda nem tinha dito o que
          //  queria. Ninguem escreve no WhatsApp em paragrafo unico.
          //
          //  COMO FUNCIONA
          //
          //  Chega a mensagem, ela espera alguns segundos. Se nesse tempo
          //  chegar outra do mesmo cliente, ESTA execucao cala a boca e sai: a
          //  proxima responde, agora com as duas falas juntas. So a ultima
          //  responde, e responde tudo.
          //
          //  De quebra economiza: tres mensagens picadas viram UMA chamada de
          //  IA em vez de tres.
          //
          //  Botao nao espera: o toque e a fala inteira, nao tem continuacao.
          // ================================================================
          const botaoId = msg.interactive?.button_reply?.id ?? null;
          let textoJunto = texto ?? "";

          if (!botaoId) {
            // AQUI NAO SE ESPERA DE NOVO: a espera ja aconteceu la em cima.
            //
            // Havia um `await pausa(...)` nesta linha, e ele era a SEGUNDA
            // espera do mesmo turno. O cliente esperava as duas, 22 segundos,
            // pra toda mensagem de texto.
            //
            // A conferida continua, e continua barata: entre a espera la de cima
            // e este ponto passaram algumas leituras no banco, e uma mensagem
            // pode ter chegado no meio delas.
            //
            // O MARCO E O DO TURNO, e nao `Date.now()`. Sem espera nenhuma
            // entre um e outro, perguntar "chegou algo depois de agora?" e
            // perguntar o obvio: nunca chegou, e a conferida viraria enfeite. O
            // `marcoDoTurno` foi tirado logo depois da espera la em cima, entao
            // ele responde o que importa: chegou algo desde que eu parei de
            // esperar?
            const falouDeNovo = await clienteFalouDepois(negocioId, clienteId, marcoDoTurno).catch(() => false);
            if (falouDeNovo) {
              console.log("[fluxo-novo] o cliente ainda esta falando; quem responde e a proxima mensagem");
              continue;
            }
            // Junta tudo que ele falou e ainda nao foi respondido. Se a consulta
            // falhar, segue com a mensagem desta execucao: melhor responder uma
            // do que nao responder nenhuma.
            const pendentes = await falasSemResposta(negocioId, clienteId).catch(() => []);
            if (pendentes.length > 1) {
              textoJunto = pendentes.join(String.fromCharCode(10));
              console.log("[fluxo-novo] respondendo " + pendentes.length + " mensagens juntas");
            }
          }

          // O aviso da mensagem citada entra AQUI, no texto que o cerebro le, e
          // nao no historico que ninguem manda pro modelo. Depois do "juntar as
          // falas", porque o cliente cita uma mensagem e escreve mais duas
          // linhas: o aviso vale pro conjunto.
          if (avisoDaMarcada) textoJunto = avisoDaMarcada + textoJunto;

          const novo = await atenderComFluxoNovo(
            // O cerebro pode ser trocado pelo BANCO, sem deploy: e assim que
            // dois modelos sao comparados com as mesmas frases no mesmo dia.
            clienteDoCerebro({ url: credsTenant.iaBaseUrl, chave: credsTenant.iaApiKey }),
            negocioId,
            clienteId,
            { texto: textoJunto, botaoId },
            // A padaria ja falou com este cliente nesta conversa? Se falou, nao
            // cumprimenta de novo. Quem sabe disso e a tabela de mensagens: o
            // pedido em montagem nao guarda quem falou o que.
            jaFalou,
            credsTenant.modeloIa,
          );
          console.log("[fluxo-novo] " + novo.rastro.join(" / "));

          // O AVISO DO PAINEL SO ACENDE QUANDO A DORA CHAMA A EQUIPE.
          //
          // Regra do dono, 23/08/2026: "a IA nem tinha chamado o humano e tava
          // la o aviso; e so quando a IA chamou o humano pra aparecer ali".
          // Hoje isso acontece quando ela ja insistiu na mesma pergunta e nao
          // saiu do lugar: tem coisa que a padaria resolve numa frase e ela nao
          // resolve em dez.
          // A FOTO QUE ACABOU DE CHEGAR ERA O COMPROVANTE DO PIX.
          //
          // A imagem foi guardada antes de o fluxo rodar, como referencia da
          // peca, que e o que toda foto foi ate hoje. Agora que o fluxo leu a
          // conversa e reconheceu o comprovante, a linha e corrigida: sem isto o
          // comprovante seria a foto mais recente do pedido e cobriria a foto do
          // bolo na fila de aprovacao e na producao.
          if (novo.fotoEhComprovante && entrada.fotoId) {
            await marcarFotoComoComprovante(negocioId, entrada.fotoId).catch((e) =>
              logWhatsapp("marcar comprovante", e),
            );
          }

          if (novo.precisaHumano) {
            await definirHandoff(negocioId, clienteId, true, novo.motivoHumano).catch((e) => logWhatsapp("handoff humano", e));
            avisarDona(
              "cliente-esperando:" + clienteId,
              novo.motivoHumano
                ? "Um cliente esta esperando a padaria. " + novo.motivoHumano
                : "Um cliente esta esperando falar com alguem da padaria.",
            ).catch((e) => logWhatsapp("aviso dona humano", e));
          }
          await pausa(tempoDeDigitar(novo.texto));
          const wamid = novo.botoes.length
            ? await enviarBotoes(telefone, novo.texto, novo.botoes, creds)
            : await enviarTexto(telefone, novo.texto, creds);
          await salvarMensagem(negocioId, clienteId, "assistant", novo.texto, { wamid: wamid ?? undefined }).catch((e) => logWhatsapp("salvar resposta", e));
          await registrarUsoIA(
            negocioId,
            // O MODELO GRAVADO TEM QUE SER O QUE RESPONDEU.
            //
            // Aqui estava a variavel de ambiente lida direto, e com o cerebro
            // vindo do banco isso virou mentira na hora: a conta dizia
            // deepseek-v4-flash enquanto quem respondia era o pro. Custo de IA
            // se mede pelo que aconteceu, nao pelo que estava configurado.
            modeloDoCerebro(credsTenant.modeloIa),
            { tokensIn: novo.uso.tokensIn, tokensOut: novo.uso.tokensOut, cacheRead: novo.uso.cacheRead },
            "whatsapp-fluxo-novo",
            clienteId,
            telefone,
          ).catch((e) => logWhatsapp("registrar uso da IA", e));
          if (novo.cardapio) {
            // A peca vai DEPOIS do texto aqui, ao contrario do fluxo antigo: no
            // novo o texto ja diz "te mandei o cardapio", entao a imagem chega
            // logo atras e a conversa fica na ordem que o cliente le.
            await enviarImagemPorLink(telefone, urlDoCardapio(novo.cardapio as never), undefined, creds).catch(
              (e: unknown) => console.error("[fluxo-novo] falha ao mandar o cardapio:", e),
            );
            // O CARDAPIO TAMBEM E MENSAGEM DA CONVERSA.
            //
            // Teste da Kemilly, 23/08/2026: a peca chegou certinha no WhatsApp
            // dela e nao aparecia no painel. Pra dona, a Dora tinha perguntado
            // "quais salgados voce quer?" e nao mostrado cardapio nenhum, entao
            // ela nao entendia a resposta do cliente nem podia conferir se foi
            // mandada a peca certa.
            await salvarMensagem(
              negocioId,
              clienteId,
              "assistant",
              "Cardápio de " + String(novo.cardapio).replace(/-/g, " "),
              { tipo: "imagem", url: urlDoCardapio(novo.cardapio as never) },
            ).catch((e) => logWhatsapp("salvar cardapio na conversa", e));

            // O RECADO QUE ACOMPANHA A PECA, QUE ESTAVA MORTO.
            //
            // O dono pediu isto: que a regra do sabor misto e o valor do papel
            // de arroz saissem do rodape em letra miuda da imagem e virassem
            // MENSAGEM, porque "no celular ninguem le rodape de cardapio", e sao
            // justamente as duas coisas que mais geram duvida no bolo de festa.
            //
            // Foi construido, e quando o cerebro antigo foi apagado em
            // 26/08/2026 perdeu quem chamava: `RECADOS_CARDAPIO` continuava
            // importado aqui e NUNCA era usado. Achado lendo o arquivo linha por
            // linha em 27/08/2026.
            //
            // Os valores saem da tabela, e nao escritos a mao: isso foi
            // consertado no mesmo dia, e estava consertando codigo que nao
            // rodava.
            const recados: string[] =
              (RECADOS_CARDAPIO as Record<string, string[] | undefined>)[String(novo.cardapio)] ?? [];
            for (const recado of recados) {
              await enviarTexto(telefone, recado, creds).catch((e: unknown) =>
                console.error("[fluxo-novo] falha ao mandar o recado do cardapio:", e),
              );
              await salvarMensagem(negocioId, clienteId, "assistant", recado).catch((e) => logWhatsapp("salvar recado do cardapio", e));
            }
          }
          // CONTINUE, E NAO RETURN: com o laco das mensagens, `return` sairia do
          // `processar` inteiro e as outras mensagens do mesmo pacote ficariam
          // sem resposta. Era invisivel enquanto so a primeira era lida.
          continue;
        } catch (e) {
          // O FLUXO CAINDO NAO PODE DEIXAR O CLIENTE SEM RESPOSTA.
          //
          // Aqui havia uma queda automatica pro cerebro antigo. Ela fazia
          // sentido enquanto o fluxo estava em teste e a Dora antiga era o
          // que rodava. Em 26/08/2026 o antigo foi apagado, e o que sobra e a
          // unica coisa honesta: avisar o cliente e chamar a equipe.
          //
          // Cair calado seria pior que o erro: o cliente fica olhando pro
          // WhatsApp esperando resposta que nao vem.
          console.error("[fluxo] falhou:", e);
          avisarDono(
            "fluxo-caiu",
            "A Dora nao conseguiu responder um cliente agora. Motivo: " +
              String((e as Error)?.message ?? e).slice(0, 160),
            creds,
          ).catch((err) => logWhatsapp("aviso dono fluxo caiu", err));
          await definirHandoff(negocioId, clienteId, true).catch((err) => logWhatsapp("handoff fluxo caiu", err));
          avisarDona(
            "cliente-esperando:" + clienteId,
            "Um cliente esta esperando falar com alguem da padaria.",
          ).catch((err) => logWhatsapp("aviso dona fluxo caiu", err));
          // A DESCULPA SAI DO `avisoDeProblema`, E NAO DAQUI.
          //
          // Estava chumbada e prometia "daqui a pouco" a qualquer hora. Quando
          // a IA cai as 23h, ninguem responde ate de manha, e a promessa quebra
          // sozinha. O `avisoDeProblema` existe em `lib/padaria-aberta.ts` desde
          // sempre pra dizer a coisa certa nos dois casos, e nunca foi ligado.
          //
          // Achado em 30/08/2026, junto com o `avisoDeEspera`, alargando o
          // detector de codigo fantasma pra ver `lib/` na raiz.
          const desculpa = avisoDeProblema();
          await enviarTexto(telefone, desculpa, creds).catch((err) => logWhatsapp("desculpa ao cliente", err));
          await salvarMensagem(negocioId, clienteId, "assistant", desculpa).catch((err) => logWhatsapp("salvar desculpa", err));
          continue;
        }
      } // fim do laco das mensagens deste pacote
    }
  }
}

// Entrada do cliente já normalizada pro painel: o texto que a IA lê + a mídia
// (base64) que o chat mostra. Uma imagem também vira "foto de referência" do
// pedido (mantém o fluxo antigo), além de virar mensagem com mídia na conversa.
type MidiaEntrada = { tipo: "imagem" | "audio" | "documento" | "video"; mime: string; dados: string; nome?: string | null };
// semResposta: entra no historico e no painel, mas nao puxa resposta da IA
// (reacao, por exemplo: ninguem responde um joinha com um texto).
// `fotoId` so existe quando a mensagem trouxe imagem: e a linha de
// `pedido_fotos` que acabou de nascer, guardada pra caso o fluxo diga que aquela
// foto era o comprovante do pix.
type Entrada = { texto: string | null; rotulo?: string; midia?: MidiaEntrada; semResposta?: boolean; fotoId?: string | null };

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
    const nota = RECADO_DE_FOTO;
    const mime = msg.image.mime_type || "image/jpeg";
    let dados: string | undefined;
    let fotoId: string | null = null;
    try {
      const bin = await baixarMidia(msg.image.id, creds);
      dados = Buffer.from(bin).toString("base64");
      // O id volta porque o fluxo pode dizer, logo depois, que esta foto era o
      // COMPROVANTE do pix. Sem guardar o id aqui, a unica forma de marcar
      // seria adivinhar "a ultima foto do cliente", e adivinhar em cima de
      // dinheiro nao e aceitavel.
      fotoId = await salvarFotoPendente(negocioId, clienteId, dados, mime);
    } catch (e) {
      console.error("[whatsapp] falha ao salvar foto de referência:", e);
    }
    const texto = legenda ? `${legenda}\n${nota}` : nota;
    return { texto, rotulo: legenda || "Foto", midia: dados ? { tipo: "imagem", mime, dados } : undefined, fotoId };
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
