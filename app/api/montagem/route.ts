// O pedido em montagem de uma conversa, pro painel mostrar e editar enquanto o
// cliente ainda está falando. GET lê; POST grava a edição da equipe.
import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  const clienteId = req.nextUrl.searchParams.get("cliente");
  if (!clienteId || !bancoConfigurado) return Response.json({ itens: [], dados: {} });
  try {
    const { lerMontagem } = await import("@/lib/banco/montagem");
    const m = await lerMontagem(sessao.negocioId, clienteId);
    // Sem nada em montagem, mas com pedido ja registrado: o painel mostra o
    // pedido fechado em vez de dizer que nao tem nada.
    if ((m.itens?.length ?? 0) === 0) {
      const { pedidoRegistradoDoCliente } = await import("@/lib/banco/pedidos");
      const registrado = await pedidoRegistradoDoCliente(sessao.negocioId, clienteId).catch(() => null);
      if (registrado) return Response.json({ ...m, registrado });
    }
    return Response.json(m);
  } catch (e) {
    console.error("[montagem] GET", e);
    return Response.json({ itens: [], dados: {} });
  }
}

// A equipe corrigindo direto na tela. Grava no MESMO lugar que a IA lê, então a
// correção dela passa a valer pra conversa também: se a dona arruma o sabor do
// bolo, a IA já conversa com o sabor certo daí pra frente.
export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  let corpo: { clienteId?: string; itens?: unknown[]; dados?: Record<string, string | null> };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!corpo.clienteId) return Response.json({ erro: "sem_cliente" }, { status: 400 });
  try {
    const { salvarMontagemInteira } = await import("@/lib/banco/montagem");
    await salvarMontagemInteira(sessao.negocioId, corpo.clienteId, {
      itens: (corpo.itens ?? []) as never,
      dados: corpo.dados ?? {},
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[montagem] POST", e);
    return Response.json({ erro: "falha" }, { status: 500 });
  }
}
