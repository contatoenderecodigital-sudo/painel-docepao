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
import { unidadeDoPedido as unidadeDoProduto } from "@/lib/ia/dados/produtos";
import { lerMontagem, anotarItem, removerItem, anotarDados, limparMontagem } from "@/lib/banco/montagem";
import { pedidoEmAberto } from "@/lib/banco/pedidos";
import type { Mensagem } from "@/lib/banco/tipos-da-conversa";
import { comORecadoDaFoto } from "@/lib/ia/texto";
import { acharOuCriarCliente, salvarFotoPendente } from "@/lib/banco/conversas";
import { atenderComFluxoNovo } from "@/lib/ia/fluxo/atender";
import OpenAI from "openai";

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
  // botaoId: o toque no botao, que no WhatsApp chega como id e nao como frase.
  // Sem ele a tela de teste nao consegue exercitar as respostas fechadas, que
  // sao metade da conversa.
  let corpo: { mensagens?: MsgEntrada[]; imagem?: string; imagemMime?: string; reiniciar?: boolean; botaoId?: string | null };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Normaliza a imagem (tira o prefixo "data:...;base64," se veio do FileReader).
  const foto = normalizarImagem(corpo.imagem, corpo.imagemMime);

  const negocioId = sessao.negocioId;
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

  // AQUI O RECADO DA FOTO IA PRO HISTORICO, E O CEREBRO LE O TEXTO.
  //
  // O comentario dizia "igual ao webhook", e nao era. O webhook gruda o recado
  // no TEXTO da mensagem, que e o que chega no cerebro; aqui ele era injetado no
  // array `historico`, que serve so pra saber se a padaria ja falou.
  //
  // O cerebro procura esse recado (o `falaDeFotoRecebida`, no `fluxo.ts`) pra
  // decidir que o TEMA da peca veio pela foto: "quem manda a foto do Homem
  // Aranha ja disse o tema". Como o recado nunca chegava, a tela de teste
  // deixava de exercitar justamente o caminho da foto, e este arquivo diz com
  // todas as letras que "uma tela de teste que testa outra coisa e pior do que
  // nao ter tela de teste".
  //
  // Agora o recado entra no texto que vai pro cerebro, la embaixo, com a mesma
  // constante que o webhook usa.
  //
  // Achado na leitura do `app/`, 28/08/2026.
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

  // ==========================================================================
  //  O CHAT DE TESTE USA O CEREBRO QUE O CLIENTE RECEBE.
  //
  //  Ate 26/08/2026 esta rota chamava `responder()`, do cerebro antigo, e o
  //  cabecalho dela dizia com todas as letras "usa o MESMO cerebro da
  //  producao". Nao usava mais: a producao passou pro fluxo e esta tela ficou
  //  para tras.
  //
  //  Entao o dono testava aqui, via um comportamento, e o cliente no WhatsApp
  //  recebia outro. Uma tela de teste que testa outra coisa e pior do que nao
  //  ter tela de teste.
  //
  //  O fluxo grava o pedido sozinho (em `fluxo/gravar.ts`), entao aqui nao ha
  //  mais o que aplicar depois: o que ele devolve ja e o resultado.
  // ==========================================================================
  let resp;
  try {
    // Cada cenario do teste comeca do zero: sem isso o pedido de um vaza no
    // outro e o resultado nao quer dizer nada.
    if (clienteId && corpo?.reiniciar) {
      await limparMontagem(negocioId, clienteId).catch(() => {});
      // O PEDIDO DA RODADA ANTERIOR TAMBEM PRECISA SAIR.
      //
      // A bateria do painel usa sempre este mesmo cliente de teste, entao
      // registrar_pedido ATUALIZA o pedido da rodada passada em vez de criar um
      // novo. O pedido velho ja tinha sido liberado pelo proprio teste, e o
      // atualizado nascia sem a pendencia de topo.
      //
      // O recorte e o telefone fixo do cliente de teste do painel, que nao e
      // pessoa nenhuma. Em 20/08/2026 um teste apagou banco demais e levou
      // junto o pedido que o dono ia usar: limpeza de teste mexe no que o teste
      // criou, e em mais nada.
      try {
        const { query } = await import("@/lib/banco/db");
        await query(
          `delete from pedido_itens where pedido_id in (
             select p.id from pedidos p join clientes c on c.id = p.cliente_id
              where p.negocio_id = $1 and c.telefone = $2)`,
          [negocioId, TESTE_TELEFONE],
        );
        await query(
          `delete from pedidos p using clientes c
            where p.cliente_id = c.id and p.negocio_id = $1 and c.telefone = $2`,
          [negocioId, TESTE_TELEFONE],
        );
      } catch (e) {
        console.error("[testar-ia] falha ao limpar o pedido do cliente de teste:", e);
      }
    }

    if (!clienteId) {
      return Response.json({ erro: "Nao consegui resolver o cliente de teste no banco." });
    }

    // A ultima fala do cliente e o turno. O historico do navegador serve so pra
    // saber se a padaria JA falou nesta conversa, que e o que decide se ela
    // cumprimenta: o estado do pedido o fluxo le do banco sozinho.
    const ultima = [...(corpo.mensagens ?? [])].reverse().find((m) => m?.de === "cliente");
    // O recado da foto vai GRUDADO no texto, igual ao webhook: e nele que o
    // cerebro procura.
    const textoDoTurno = foto
      ? comORecadoDaFoto(String(ultima?.texto ?? ""))
      : String(ultima?.texto ?? "").trim();
    const jaAtendeu = (corpo.mensagens ?? []).some((m) => m?.de === "ia");

    resp = await atenderComFluxoNovo(
      new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      negocioId,
      clienteId,
      { texto: textoDoTurno, botaoId: corpo.botaoId ?? null },
      jaAtendeu,
    );
  } catch (e) {
    // Erro real do provedor (sem credito, sem chave). Devolve 200 com a
    // mensagem crua pra tela mostrar o motivo: e util o dono saber.
    const msg = (e as Error)?.message || String(e);
    return Response.json({ erro: msg });
  }

  return Response.json({
    resposta: resp.texto,
    // Os botoes que o WhatsApp mostraria. Sem eles a tela de teste nao consegue
    // exercitar as respostas fechadas, que sao metade da conversa.
    botoes: resp.botoes,
    etapa: resp.etapa,
    pedidoRegistrado: !!resp.pedidoId,
    precisaHumano: !!resp.precisaHumano,
    rastro: resp.rastro,
    // A mesma peca que o WhatsApp mandaria.
    cardapios: resp.cardapio ? [urlDoCardapio(resp.cardapio as never)] : [],
    // O pedido como ficou depois deste turno: e o que o teste automatico cobra.
    itens: (await lerMontagem(negocioId, clienteId).catch(() => ({ itens: [] }))).itens,
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
