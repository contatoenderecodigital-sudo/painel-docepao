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
      const registrado = await pedidoRegistradoDoCliente(sessao.negocioId, clienteId).catch((e) => {
        // Catch mudo aqui escondeu uma consulta quebrada: a tela dizia "nada
        // anotado" com o pedido do lado e nao sobrava pista nenhuma.
        console.error("[montagem] falha ao ler o pedido registrado:", e);
        return null;
      });
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
      // Nome do cardapio e nome da tela nao sao iguais (a cotacao devolve o nome
      // oficial), entao o casamento e por aproximacao, e cada item da tela so
      // casa uma vez.
      const norm = (t: string) => String(t || "").trim().toLowerCase().replace(/^bolo (de |do |da )/, "bolo ");
      const usados = new Set<number>();
      const casar = (nome: string) => {
        const a = norm(nome);
        for (let k = 0; k < brutos.length; k++) {
          if (usados.has(k)) continue;
          const b = norm(brutos[k].produto);
          if (a === b || a.includes(b) || b.includes(a)) {
            usados.add(k);
            return brutos[k];
          }
        }
        return null;
      };
      const precificados = cot.linhas.map((l) => {
        const dela = casar(l.item);
        return {
          produto: l.item,
          categoria: dela?.categoria || l.categoria,
          qtd: l.qtd,
          unidade: dela?.unidade || l.unidade || "un",
          obs: dela?.obs ?? l.obs ?? null,
          unitCentavos: Math.round(l.unit * 100),
          subtotalCentavos: Math.round(l.subtotal * 100),
        };
      });
      // Item que a equipe deixou na tela e o cardapio nao reconhece nao pode
      // sumir calado: sem preco ele viraria um pedido menor do que o combinado.
      const semPreco = brutos.filter((_, k) => !usados.has(k)).map((i) => i.produto);
      if (semPreco.length > 0) {
        return Response.json({ erro: "sem_preco", produtos: semPreco }, { status: 400 });
      }
      const total = await salvarItensDoPedido(sessao.negocioId, corpo.pedidoId, precificados);

      // O CLIENTE PRECISA SABER QUE MUDOU.
      //
      // Sem isso ele fica com o resumo antigo no WhatsApp, com outro total, e
      // descobre na retirada, discutindo preco no balcao. A mensagem tambem
      // entra no historico, pra equipe e a Dora lerem o mesmo que ele leu.
      try {
        const { carregarCredsWhatsapp } = await import("@/lib/banco/negocios");
        const { enviarTexto } = await import("@/lib/whatsapp/api");
        const { salvarMensagem } = await import("@/lib/banco/conversas");
        const { telefoneDoCliente } = await import("@/lib/banco/atendimentos");
        const creds = await carregarCredsWhatsapp(sessao.negocioId);
        const telefone = await telefoneDoCliente(sessao.negocioId, corpo.clienteId);
        if (telefone) {
          const linhas = precificados.map(
            (i) =>
              (i.unidade === "kg" ? String(i.qtd).replace(".", ",") + " kg" : i.qtd + " un") +
              " de " + i.produto + (i.obs ? " (" + i.obs + ")" : ""),
          );
          const texto =
            "Passando pra confirmar: a equipe ajustou seu pedido aqui.\n\n" +
            linhas.join("\n") +
            "\n\nTotal: " + (total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) +
            "\n\nSe alguma coisa nao estiver certa, me avisa que a gente acerta.";
          await enviarTexto(telefone, texto, { token: creds.token, phoneId: creds.phoneId }).catch((e) => console.error("[montagem] falha ao avisar o cliente:", e));
          await salvarMensagem(sessao.negocioId, corpo.clienteId, "assistant", texto, {
            autor: "equipe",
          }).catch(() => {});
        }
      } catch (e) {
        console.error("[montagem] nao consegui avisar o cliente da correcao:", e);
      }

      // A partir daqui quem fala com o cliente e a equipe: a Dora nao pode
      // conversar por cima de uma correcao que ela nao fez.
      let assumiu = false;
      try {
        const { definirPausaIA } = await import("@/lib/banco/atendimentos");
        await definirPausaIA(sessao.negocioId, corpo.clienteId, true);
        assumiu = true;
      } catch (e) {
        console.error("[montagem] nao consegui pausar a IA depois da correcao:", e);
      }
      return Response.json({ ok: true, totalCentavos: total, assumiu });
    }
    const { salvarMontagemInteira } = await import("@/lib/banco/montagem");
    await salvarMontagemInteira(sessao.negocioId, corpo.clienteId, {
      itens: (corpo.itens ?? []) as never,
      dados: corpo.dados ?? {},
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[montagem] POST", e);
    // Pedido ja aprovado nao e falha de sistema: e regra. Sem dizer isso, a
    // equipe le "tente de novo" e fica tentando o que nunca vai funcionar.
    const msg = String((e as Error)?.message ?? "");
    if (/ja aprovado|impresso/i.test(msg)) {
      return Response.json({ erro: "ja_aprovado" }, { status: 409 });
    }
    return Response.json({ erro: "falha" }, { status: 500 });
  }
}
