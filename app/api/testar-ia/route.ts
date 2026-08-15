// ============================================================================
//  CHAT DE TESTE — o dono conversa com a IA pelo navegador, sem WhatsApp.
//  Usa o MESMO cérebro da produção (o webhook): carrega o tenant, monta o
//  histórico no formato que responder() espera e chama responder(). Nada de mock.
//
//  Diferenças do webhook (de propósito): NÃO grava a conversa no banco (é teste),
//  então não chama salvarMensagem/carregarHistorico — o histórico vem do próprio
//  navegador. MAS se a IA fechar o pedido (registrar_pedido), ele cai na fila de
//  aprovação de verdade, igual à produção, pra o dono validar o fluxo inteiro.
//
//  Protegido pela sessão do painel (lerSessao), como as outras rotas do painel.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { carregarTenant } from "@/lib/ia/tenant";
import { responder, type Mensagem } from "@/lib/ia/cerebro";
import { acharOuCriarCliente, registrarPedido } from "@/lib/banco/conversas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cliente "sintético" pra pendurar os pedidos de teste que a IA fechar. Assim o
// pedido cai na fila de aprovação (que exige cliente_id) sem sujar clientes reais,
// e o dono reconhece na fila que veio do chat de teste.
const TESTE_TELEFONE = "5500000000000";
const TESTE_NOME = "Cliente de teste (painel)";

type MsgEntrada = { de: "cliente" | "ia"; texto: string };

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });

  let corpo: { mensagens?: MsgEntrada[] };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const negocioId = sessao.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) {
    return Response.json({ erro: "Nenhum negócio associado à sua sessão." });
  }

  // Espelha o webhook: carrega o tenant (persona + cardápio DESTE negócio) e monta
  // o histórico no MESMO formato que responder() espera ({ role, content }).
  // No webhook, esse histórico vem de carregarHistorico (banco); aqui vem das
  // mensagens do navegador — cliente => user, ia => assistant. A última mensagem
  // do array é a nova pergunta do cliente, igual ao webhook.
  const tenant = await carregarTenant(negocioId);
  const historico: Mensagem[] = (corpo.mensagens ?? [])
    .filter((m) => m && typeof m.texto === "string" && m.texto.trim())
    .map((m) => ({
      role: m.de === "ia" ? "assistant" : "user",
      content: m.texto,
    }));

  if (historico.length === 0) {
    return Response.json({ erro: "Envie uma mensagem pra IA responder." });
  }

  let resp;
  try {
    resp = await responder(historico, tenant);
  } catch (e) {
    // Erro real dos provedores (ex: sem crédito/chave na Anthropic/OpenAI). Devolve
    // 200 com a mensagem crua pra UI mostrar o motivo — é útil o dono saber.
    const msg = (e as Error)?.message || String(e);
    return Response.json({ erro: msg });
  }

  // Igual ao webhook: se a IA fechou o pedido, registra ANTES de responder pro
  // cliente. Cai na fila de aprovação (status 'confirmado'). Se falhar o registro,
  // avisa mas não derruba o teste.
  if (resp.pedidoRegistrado) {
    try {
      const clienteId = await acharOuCriarCliente(negocioId, TESTE_TELEFONE, TESTE_NOME);
      await registrarPedido(negocioId, clienteId, resp.pedidoRegistrado);
    } catch (e) {
      console.error("[testar-ia] falha ao registrar pedido de teste:", e);
      return Response.json({
        resposta: resp.texto,
        aviso: "A IA fechou o pedido, mas houve uma falha ao lançá-lo na fila de aprovação.",
      });
    }
  }

  return Response.json({
    resposta: resp.texto,
    pedidoRegistrado: !!resp.pedidoRegistrado,
    precisaHumano: resp.precisaHumano,
  });
}
