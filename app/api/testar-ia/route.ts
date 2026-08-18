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

import { urlDoCardapio } from "@/lib/whatsapp/api";
import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { carregarTenant } from "@/lib/ia/tenant";
import { unidadeDoProduto } from "@/lib/ia/cerebro";
import { lerMontagem, anotarItem, removerItem, anotarDados, limparMontagem } from "@/lib/banco/montagem";
import { pedidoEmAberto } from "@/lib/banco/pedidos";
import { responder, type Mensagem } from "@/lib/ia/cerebro";
import { acharOuCriarCliente, registrarPedido, anexarFotoAoPedido, salvarFotoPendente } from "@/lib/banco/conversas";

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

  // imagem: base64 (com ou sem prefixo data:) da foto de referência que o dono
  // anexou na última mensagem, pra testar o fluxo completo do /testar.
  let corpo: { mensagens?: MsgEntrada[]; imagem?: string; imagemMime?: string; reiniciar?: boolean };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Normaliza a imagem (tira o prefixo "data:...;base64," se veio do FileReader).
  const foto = normalizarImagem(corpo.imagem, corpo.imagemMime);

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

  // Igual ao webhook: quando há foto anexada, a IA recebe um recado de que chegou
  // uma foto de referência (pra acusar o recebimento e anotar no item). Cai na
  // última mensagem do cliente; se ele mandou só a foto sem texto, vira um turno.
  if (foto) {
    const nota = "[o cliente enviou uma foto de referência para o pedido]";
    const ult = historico[historico.length - 1];
    if (ult && ult.role === "user") ult.content = ult.content ? `${ult.content}\n${nota}` : nota;
    else historico.push({ role: "user", content: nota });
  }

  if (historico.length === 0) {
    return Response.json({ erro: "Envie uma mensagem pra IA responder." });
  }

  // Cliente sintético do /testar (idempotente: acha-ou-cria sempre o mesmo).
  // Resolvido ANTES de responder() pra amarrar o custo de IA do teste a ele —
  // assim o consumo do chat de teste não se mistura com o de clientes reais.
  // Se falhar (sem banco), segue sem clienteId (o log só cai como NULL).
  let clienteId: string | undefined;
  try {
    clienteId = await acharOuCriarCliente(negocioId, TESTE_TELEFONE, TESTE_NOME);
  } catch (e) {
    console.error("[testar-ia] falha ao resolver cliente sintetico (segue sem):", e);
  }

  // A foto vira "pendente" na hora, como na produção — e não só quando o pedido
  // fecha na MESMA mensagem. Quase nunca fecha: o cliente manda a foto do topo
  // no meio da conversa e só combina data e pagamento depois. Guardando aqui,
  // registrarPedido liga a foto ao pedido igual ao webhook faz.
  if (foto && clienteId) {
    try {
      await salvarFotoPendente(negocioId, clienteId, foto.dados, foto.mime);
    } catch (e) {
      console.error("[testar-ia] falha ao guardar foto de referência:", e);
    }
  }

  let resp;
  try {
    // Igual ao webhook: a IA precisa enxergar o pedido que ja esta montado,
    // senao o teste exercita um sistema que nao existe em producao.
    // Cada cenario do teste comeca do zero: sem isso o pedido de um vaza no
    // outro e o resultado nao quer dizer nada.
    if (clienteId && corpo?.reiniciar) await limparMontagem(negocioId, clienteId).catch(() => {});
    const montado = clienteId ? await lerMontagem(negocioId, clienteId).catch(() => null) : null;
    const emAberto = clienteId ? await pedidoEmAberto(negocioId, clienteId).catch(() => null) : null;
    resp = await responder(historico, tenant, "whatsapp", clienteId, montado, false, null, emAberto);
  } catch (e) {
    // Erro real dos provedores (ex: sem crédito/chave na Anthropic/OpenAI). Devolve
    // 200 com a mensagem crua pra UI mostrar o motivo — é útil o dono saber.
    const msg = (e as Error)?.message || String(e);
    return Response.json({ erro: msg });
  }

  // As mudancas do turno entram no pedido montado, como no webhook. Sem isto o
  // teste perde tudo entre uma mensagem e outra.
  if (clienteId) {
    for (const mud of resp.montagem ?? []) {
      try {
        if (mud.tipo === "item") {
          // Mesma fonte do preco, igual ao webhook.
          await anotarItem(negocioId, clienteId, {
            produto: mud.produto,
            categoria: mud.categoria as never,
            qtd: mud.qtd,
            unidade: unidadeDoProduto(mud.produto, mud.categoria),
            obs: mud.obs ?? null,
          });
        } else if (mud.tipo === "remover") {
          await removerItem(negocioId, clienteId, mud.produto, mud.categoria as never);
        } else {
          await anotarDados(negocioId, clienteId, mud.dados);
        }
      } catch (e) {
        console.error("[testar-ia] falha ao aplicar mudanca do pedido:", e);
      }
    }
  }

  // Igual ao webhook: se a IA fechou o pedido, registra ANTES de responder pro
  // cliente. Cai na fila de aprovação (status 'confirmado'). Se falhar o registro,
  // avisa mas não derruba o teste.
  if (resp.pedidoRegistrado) {
    try {
      // Reusa o cliente sintético já resolvido acima; se não resolveu (falha
      // pontual antes de responder), acha-ou-cria de novo (idempotente).
      const idCliente = clienteId ?? (await acharOuCriarCliente(negocioId, TESTE_TELEFONE, TESTE_NOME));
      // registrarPedido já liga as fotos pendentes deste cliente ao pedido; só
      // resta cobrir o caso em que a foto veio na MESMA mensagem que fechou o
      // pedido e o cliente sintético não pôde ser resolvido antes.
      const pedidoId = await registrarPedido(negocioId, idCliente, resp.pedidoRegistrado);
      await limparMontagem(negocioId, idCliente).catch(() => {});
      if (foto && pedidoId && !clienteId) {
        try {
          await anexarFotoAoPedido(negocioId, pedidoId, idCliente, foto.dados, foto.mime);
        } catch (e) {
          console.error("[testar-ia] falha ao anexar foto ao pedido de teste:", e);
        }
      }
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
    // Mesmas peças que o webhook mandaria no WhatsApp. Sem isto o /testar
    // mostrava só o texto e dava a impressão de que o cardápio não foi enviado.
    cardapios: (resp.cardapiosParaEnviar ?? []).map(urlDoCardapio),
    // O pedido como ficou depois deste turno: e o que o teste automatico cobra.
    itens: clienteId ? (await lerMontagem(negocioId, clienteId).catch(() => ({ itens: [] }))).itens : [],
  });
}

// Aceita a imagem em base64 puro ou como data URL ("data:image/png;base64,....").
// Devolve os dados sem o prefixo + o mime. Ignora entradas vazias ou inválidas.
function normalizarImagem(imagem?: string, imagemMime?: string): { dados: string; mime: string } | null {
  if (!imagem || typeof imagem !== "string") return null;
  const m = imagem.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) return { dados: m[2], mime: imagemMime || m[1] || "image/jpeg" };
  return { dados: imagem, mime: imagemMime || "image/jpeg" };
}
