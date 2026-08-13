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
import { responder } from "@/lib/ia/cerebro";
import { carregarTenant } from "@/lib/ia/tenant";
import { enviarTexto, baixarMidia, type CredsEnvio } from "@/lib/whatsapp/api";
import { transcrever } from "@/lib/whatsapp/transcrever";
import {
  acharOuCriarCliente,
  carregarHistorico,
  salvarMensagem,
  registrarPedido,
  marcarWebhookNovo,
} from "@/lib/banco/conversas";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { queryUm } from "@/lib/banco/db";
import crypto from "node:crypto";

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
      if (!msg) continue; // status/entrega, ignora

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
      const nomePerfil = valor.contacts?.[0]?.profile?.name;
      const clienteId = await acharOuCriarCliente(negocioId, telefone, nomePerfil);

      // Extrai o texto (ou transcreve o áudio).
      const texto = await extrairTexto(msg, creds);
      if (!texto) {
        // Áudio que não deu pra transcrever: não some em silêncio, pede pra escrever.
        if (msg.type === "audio") {
          try {
            await salvarMensagem(negocioId, clienteId, "user", "[audio nao transcrito]");
            if (credsTenant.iaAtiva) {
              await enviarTexto(telefone, "Nao consegui ouvir seu audio, pode escrever pra mim?", creds);
            }
          } catch (e) {
            console.error("[whatsapp] falha no fallback de audio:", e);
          }
        }
        continue;
      }

      try {
        await salvarMensagem(negocioId, clienteId, "user", texto);
      } catch (e) {
        console.error("[whatsapp] falha ao salvar mensagem do cliente:", e);
      }

      // IA desligada no painel: guarda a mensagem pra equipe ver, mas não
      // responde automático (a equipe assume pelo Atendimentos).
      if (!credsTenant.iaAtiva) continue;

      const historico = await carregarHistorico(negocioId, clienteId);
      const tenant = await carregarTenant(negocioId); // cardápio/persona DESTE negócio

      // A IA tenta os provedores em cadeia (OpenAI, Gemini, ...). Se TODOS caírem,
      // responder() lança: não deixa o cliente no vácuo, avisa que já já responde.
      let resp;
      try {
        resp = await responder(historico, tenant);
      } catch (e) {
        console.error("[whatsapp] IA falhou (todos os provedores):", e);
        try {
          await enviarTexto(telefone, "Tive um probleminha aqui agora, ja ja te respondo, ta?", creds);
        } catch {
          // se nem isso enviar, a equipe ve a conversa parada no painel
        }
        continue;
      }

      // Registra o pedido ANTES de confirmar pro cliente (durabilidade primeiro).
      // Se falhar, NÃO manda a confirmação de "pedido salvo" (evita pedido fantasma).
      if (resp.pedidoRegistrado) {
        try {
          await registrarPedido(negocioId, clienteId, resp.pedidoRegistrado);
        } catch (e) {
          console.error("[whatsapp] falha ao registrar pedido:", e);
          try {
            await enviarTexto(telefone, "Recebi seu pedido, so vou confirmar com a equipe e ja te aviso, ta?", creds);
          } catch {
            // idem: equipe assume pelo painel
          }
          continue;
        }
      }

      // Guard contra resposta vazia (modelo devolveu nada): manda algo, não body vazio.
      const textoResp = (resp.texto || "").trim() || "Ja recebi sua mensagem, so um instante.";
      try {
        await enviarTexto(telefone, textoResp, creds);
      } catch (e) {
        console.error("[whatsapp] falha ao enviar resposta:", e);
      }
      try {
        await salvarMensagem(negocioId, clienteId, "assistant", textoResp);
      } catch (e) {
        console.error("[whatsapp] falha ao salvar resposta:", e);
      }
      // resp.precisaHumano: o painel já mostra pela conversa; marcação fina depois.
    }
  }
}

// Texto puro, ou áudio transcrito. Outros tipos: pede pra escrever.
// Se a transcrição falhar (download/serviço fora), retorna null e o chamador
// pede pro cliente escrever, em vez de deixar a exceção matar o processamento.
async function extrairTexto(msg: WhatsAppMessage, creds: CredsEnvio): Promise<string | null> {
  if (msg.type === "text") return msg.text?.body ?? null;
  if (msg.type === "audio" && msg.audio?.id) {
    try {
      const bin = await baixarMidia(msg.audio.id, creds);
      return await transcrever(bin);
    } catch (e) {
      console.error("[whatsapp] falha ao transcrever audio:", e);
      return null;
    }
  }
  return "[cliente mandou uma mídia que não é texto nem áudio]";
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
  if (
    process.env.NEGOCIO_PADRAO_ID &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return process.env.NEGOCIO_PADRAO_ID;
  }
  return null;
}

// --- Tipos mínimos do payload do WhatsApp (só o que a gente usa) ---
type WhatsAppMessage = {
  id?: string;
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
};
type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string } }[];
        messages?: WhatsAppMessage[];
      };
    }[];
  }[];
};
