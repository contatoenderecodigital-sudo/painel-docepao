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
  let corpo: { clienteId?: string; pedidoId?: string; itens?: unknown[]; dados?: Record<string, string | null> };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!corpo.clienteId) return Response.json({ erro: "sem_cliente" }, { status: 400 });
  try {
    // Pedido ja fechado: a edicao vai pro pedido, nao pra montagem. Enquanto o
    // ticket nao imprime a cozinha nao sabe de nada, entao ainda da pra mudar.
    if (corpo.pedidoId) {
      const { carregarTenant } = await import("@/lib/ia/tenant");
      const { salvarItensDoPedido } = await import("@/lib/banco/pedidos");
      const tenant = await carregarTenant(sessao.negocioId);
      const brutos = (corpo.itens ?? []) as {
        produto: string; categoria: string; qtd: number; unidade: string; obs?: string | null;
      }[];
      const cot = tenant.motor.cotarPorItens(
        brutos.map((i) => ({ item: i.produto, qtd: Number(i.qtd) || 0, obs: i.obs ?? undefined })),
      );
      // A linha cotada manda no preco; o que a equipe escolheu na tela manda no
      // resto (categoria, unidade e observacao sao decisao dela, nao do motor).
      const precificados = cot.linhas.map((l, k) => ({
        produto: l.item,
        categoria: brutos[k]?.categoria || l.categoria,
        qtd: l.qtd,
        unidade: brutos[k]?.unidade || l.unidade || "un",
        obs: brutos[k]?.obs ?? l.obs ?? null,
        unitCentavos: Math.round(l.unit * 100),
        subtotalCentavos: Math.round(l.subtotal * 100),
      }));
      const total = await salvarItensDoPedido(sessao.negocioId, corpo.pedidoId, precificados);
      return Response.json({ ok: true, totalCentavos: total });
    }
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
