"use server";

// ============================================================================
//  AÇÕES DO PAINEL (Server Actions) — rodam no servidor, mexem no banco.
//  Aprovar -> status 'aprovado' -> trigger cria a linha na fila de impressão
//  -> a ponte na padaria imprime. Recusar -> status 'recusado'.
//
//  REGRA DA DONA: nenhum pedido é confirmado sozinho pela IA. Quando a equipe
//  aprova OU recusa aqui no painel, o cliente é AVISADO no WhatsApp na hora
//  (a IA sempre disse que estava "aguardando a equipe"). O aviso é
//  fire-and-forget: se falhar (sem conexão, janela de 24h fechada), NÃO
//  bloqueia a mudança de status — a impressão/produção seguem normal.
//
//  Sem banco configurado (demo), são no-op: a animação da tela já resolve.
// ============================================================================

import { bancoConfigurado } from "@/lib/banco/db";
import { lerSessao } from "@/lib/auth";

// Avisa o cliente no WhatsApp que a equipe aprovou ou recusou o pedido.
// Tudo dentro de try/catch: um erro aqui nunca derruba a aprovação.
async function avisarCliente(
  negocioId: string,
  pedidoId: string,
  tipo: "aprovado" | "recusado",
): Promise<void> {
  try {
    const { dadosAvisoPedido } = await import("@/lib/banco/pedidos");
    const dados = await dadosAvisoPedido(pedidoId, negocioId);
    if (!dados) return; // pedido sem cliente/telefone: não há como avisar

    const { carregarCredsWhatsapp } = await import("@/lib/banco/negocios");
    const creds = await carregarCredsWhatsapp(negocioId);
    if (!creds.phoneId || !creds.token) return; // WhatsApp não conectado

    const primeiro = dados.nome && dados.nome !== "Cliente" ? dados.nome.split(" ")[0] : "";
    const ola = primeiro ? `Oi ${primeiro}, ` : "Oi, ";

    let texto: string;
    if (tipo === "aprovado") {
      const hora =
        dados.retiradaHora && /^\d{1,2}:\d{2}/.test(dados.retiradaHora)
          ? ` às ${dados.retiradaHora.slice(0, 5)}`
          : "";
      const quando = dados.retiradaFmt ? `\n\nFica pra ${dados.retiradaFmt}${hora}.` : "";
      texto = `${ola}tudo certo!\n\nA nossa equipe confirmou o seu pedido.${quando}\n\nQualquer coisa é só chamar por aqui.`;
    } else {
      texto = `${ola}sobre o seu pedido:\n\na nossa equipe precisa acertar alguns detalhes com você antes de confirmar.\n\nJá já a gente te chama por aqui.`;
    }

    const { enviarTexto } = await import("@/lib/whatsapp/api");
    await enviarTexto(dados.telefone, texto, { phoneId: creds.phoneId, token: creds.token });

    // Registra no histórico pra aparecer no Atendimentos (como mensagem da equipe).
    const { salvarMensagem } = await import("@/lib/banco/conversas");
    await salvarMensagem(negocioId, dados.clienteId, "assistant", texto, { autor: "equipe" });
  } catch (e) {
    console.error("[avisarCliente] aviso ao cliente falhou (não bloqueia o status):", e);
  }
}

export async function aprovarPedido(pedidoId: string): Promise<{ ok: boolean }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false };
  const { mudarStatus } = await import("@/lib/banco/pedidos");
  await mudarStatus(pedidoId, "aprovado", sessao.negocioId);
  await avisarCliente(sessao.negocioId, pedidoId, "aprovado");
  return { ok: true };
}

export async function recusarPedido(pedidoId: string): Promise<{ ok: boolean }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false };
  const { mudarStatus } = await import("@/lib/banco/pedidos");
  await mudarStatus(pedidoId, "recusado", sessao.negocioId);
  await avisarCliente(sessao.negocioId, pedidoId, "recusado");
  return { ok: true };
}

// Reimprime um pedido JÁ APROVADO: recoloca um job 'pendente' na fila de
// impressão (mesmo formato do trigger on_pedido_aprovado), e a ponte imprime de
// novo no próximo poll. Em demo (sem banco) é no-op de sucesso.
export async function reimprimirPedido(pedidoId: string): Promise<{ ok: boolean }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false };
  const { reenfileirarImpressao } = await import("@/lib/banco/fila");
  const ok = await reenfileirarImpressao(sessao.negocioId, pedidoId);
  return { ok };
}

// Acrescenta um item ao pedido ANTES de aprovar e recalcula o total.
//
// Existia um beco sem saída: a IA avisava o cliente que "a equipe vai informar
// o valor do topo", o card pedia "confirme antes de aprovar" — e a fila só
// tinha aprovar e recusar. Não havia onde lançar o valor. Aprovar mandava o
// pedido sem o item mais caro; recusar perdia a venda.
//
// Aqui a equipe lança o que faltava (topo de bolo, taxa de entrega, um item que
// o cliente pediu por fora) e o total volta a bater com o que vai ser cobrado.
export async function adicionarItemPedido(
  pedidoId: string,
  item: { produto: string; qtd: number; valorUnitario: number },
): Promise<{ ok: boolean; erro?: string }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: "sem sessao" };

  const produto = (item.produto || "").trim();
  const qtd = Number(item.qtd);
  const unit = Number(item.valorUnitario);
  if (produto.length < 2) return { ok: false, erro: "Descreva o item." };
  if (!Number.isFinite(qtd) || qtd <= 0) return { ok: false, erro: "Quantidade inválida." };
  if (!Number.isFinite(unit) || unit < 0) return { ok: false, erro: "Valor inválido." };

  const { adicionarItem } = await import("@/lib/banco/pedidos");
  try {
    await adicionarItem(pedidoId, sessao.negocioId, {
      produto,
      qtd,
      unitCentavos: Math.round(unit * 100),
    });
    return { ok: true };
  } catch (e) {
    console.error("[adicionarItemPedido]", e);
    return { ok: false, erro: "Não consegui salvar o item." };
  }
}
